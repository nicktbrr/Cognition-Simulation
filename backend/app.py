"""
Flask application for handling LLM evaluation and response analysis.

This application provides an API endpoint for evaluating LLM responses using various metrics
and storing the results in Supabase. It integrates with Google's Gemini API for LLM operations
and handles CORS for both development and production environments.
"""

from flask import Flask, Blueprint, request, jsonify
from flask_restful import Api, Resource
from dotenv import load_dotenv
from flask_cors import CORS
import os
from supabase import create_client, Client
from pathlib import Path
from langchain_core.messages import SystemMessage, HumanMessage
# from utils.cosine_sim import *
from utils.prompts import *
from utils.evaluate import *
from utils.llm import get_llm, resolve_model_name
from utils.progress import create_progress_updater
try:
    from utils.pricing import compute_prompt_and_eval_cost, compute_cost
except ModuleNotFoundError:
    # Fallback when utils.pricing is not deployed (e.g. missing from build context)
    _INPUT_PER_M = 0.10
    _OUTPUT_PER_M = 0.40
    def compute_cost(input_tokens: int, output_tokens: int) -> float:
        return (input_tokens * _INPUT_PER_M / 1e6) + (output_tokens * _OUTPUT_PER_M / 1e6)
    def compute_prompt_and_eval_cost(pi: int, po: int, ei: int, eo: int):
        return (round(compute_cost(pi, po), 6), round(compute_cost(ei, eo), 6))
from utils.used_prompts import (
    GENERATE_STEPS_SYSTEM_PROMPT,
    get_generate_steps_user_prompt
)
import threading
import uuid
import random
import json
import re
import logging
import typing_extensions as typing
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# Load environment variables from .env file
load_dotenv()

# Initialize Flask application
app = Flask(__name__)

# Determine if running in development or production mode
prod = os.environ.get("DEV") or 'production'

# Configure CORS based on environment
if prod == 'development':
    # Development CORS settings - allow localhost:3000
    CORS(app, resources={
        r"/api/*": {"origins": "http://localhost:3000",
                    "methods": ["GET", "POST", "OPTIONS"],
                    "allow_headers": ["Content-Type", "Authorization"]}})
else:
    # Production CORS settings - allow Vercel deployment and custom domains
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "https://cognition-simulation-e9on.vercel.app",
                "https://psycsim.com",
                "https://www.psycsim.com",
                "https://psycsim.org",
                "https://www.psycsim.org"
            ],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })

# Initialize API blueprint and RESTful API
api_bp = Blueprint("api", __name__)
api = Api(api_bp)


# Configure Supabase connection
url: str = os.environ.get("VITE_SUPABASE_URL")
key: str = os.environ.get("VITE_SUPABASE_KEY")

# Load environment variables from .env file
env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

# Function to create a Supabase client with optional JWT authentication
def get_supabase_client(jwt=None):
    """
    Create a Supabase client instance with optional JWT authentication.
    This ensures each request gets its own client to avoid concurrency issues.
    """
    client = create_client(url, key)
    if jwt:
        client.auth.set_session(jwt, "")
    return client

# Keep GEMINI_KEY available for reference; get_llm() reads it from env directly.
key_g = os.environ.get('GEMINI_KEY')


def parse_age_range(age_range_str):
    """
    Parse an age range string and return a random age within that range.
    
    Args:
        age_range_str: String like "18 - 35 years old" or "18-35"
    
    Returns:
        str: A random age within the range as a string, or the original string if parsing fails
    """
    try:
        # Extract numbers from the string using regex
        numbers = re.findall(r'\d+', age_range_str)
        if len(numbers) >= 2:
            min_age = int(numbers[0])
            max_age = int(numbers[1])
            # Select a random age within the range
            random_age = random.randint(min_age, max_age)
            return str(random_age)
        elif len(numbers) == 1:
            # Only one number found, return it as is
            return numbers[0]
        else:
            # No numbers found, return original string
            return age_range_str
    except Exception as e:
        logger.debug(f"Error parsing age range '{age_range_str}': {e}")
        return age_range_str


def generate_random_samples(attributes, num_samples=10):
    """
    Generate random samples from the attributes list.
    
    Args:
        attributes: List of dictionaries, each containing 'label', 'category', and 'values'
        num_samples: Number of samples to generate (default: 10)
    
    Returns:
        List of sample dictionaries, each containing randomly selected values for each attribute
        and a 'number' field (1-10) for consistent ordering
    
    Example input:
        [
            {'label': 'Age', 'category': 'demographics', 'values': ['18 - 35 years old']},
            {'label': 'Nationality (UK)', 'category': 'demographics', 'values': ['England']},
            {'label': 'Gender', 'category': 'demographics', 'values': ['Man (including Trans Male/Trans Man)']}
        ]
    
    Example output:
        [
            {
                'number': 1,
                'Age': '24',
                'Nationality (UK)': 'England',
                'Gender': 'Man (including Trans Male/Trans Man)'
            },
            {
                'number': 2,
                'Age': '31',
                'Nationality (UK)': 'England',
                'Gender': 'Man (including Trans Male/Trans Man)'
            },
            ...
        ]
    """
    samples = []
    
    for i in range(num_samples):
        sample = {'number': i + 1}  # Add number field (1-10)
        for attribute in attributes:
            label = attribute.get('label')
            values = attribute.get('values', [])
            
            # Randomly select one value from the available values
            if values:
                selected_value = random.choice(values)
                
                # Special handling for Age attribute: parse range and select random age
                if label == 'Age' and isinstance(selected_value, str):
                    selected_value = parse_age_range(selected_value)
                
                sample[label] = selected_value
        
        samples.append(sample)
    
    return samples


def run_evaluation(uuid, data, model_name, jwt=None):
    fn = None  # Initialize fn variable for cleanup
    try:
        # Create a new Supabase client for this request
        supabase = get_supabase_client(jwt)

        # Number of sample rows (personas) to use for this run: from request, clamped to 10-50
        num_samples = data.get('iters', 10)
        try:
            num_samples = max(10, min(50, int(num_samples)))
        except (TypeError, ValueError):
            num_samples = 10

        # Always maintain 50 unique personas; use only the first num_samples for this run.
        PERSONA_POOL_SIZE = 50

        sample_id = data.get('sample')['id']
        try:
            sample_response = supabase.table("samples").select("persona").eq("id", sample_id).execute()

            if sample_response.data and sample_response.data[0].get('persona') is not None:
                existing_personas = sample_response.data[0]['persona']
                if isinstance(existing_personas, list):
                    existing_personas = sorted(existing_personas, key=lambda x: x.get('number', 0))
                if len(existing_personas) >= PERSONA_POOL_SIZE:
                    random_samples = existing_personas[:num_samples]
                else:
                    attributes = data.get('sample')['attributes']
                    persona_pool = generate_random_samples(attributes, num_samples=PERSONA_POOL_SIZE)
                    if isinstance(persona_pool, list):
                        persona_pool = sorted(persona_pool, key=lambda x: x.get('number', 0))
                    random_samples = persona_pool[:num_samples]
                    if supabase and persona_pool:
                        try:
                            supabase.table("samples").update({"persona": persona_pool}).eq("id", sample_id).execute()
                        except Exception:
                            pass
            else:
                attributes = data.get('sample')['attributes']
                persona_pool = generate_random_samples(attributes, num_samples=PERSONA_POOL_SIZE)
                if isinstance(persona_pool, list):
                    persona_pool = sorted(persona_pool, key=lambda x: x.get('number', 0))
                random_samples = persona_pool[:num_samples]
                if supabase and persona_pool:
                    try:
                        supabase.table("samples").update({"persona": persona_pool}).eq("id", sample_id).execute()
                    except Exception:
                        pass
        except Exception as e:
            attributes = data.get('sample')['attributes']
            persona_pool = generate_random_samples(attributes, num_samples=PERSONA_POOL_SIZE)
            if isinstance(persona_pool, list):
                persona_pool = sorted(persona_pool, key=lambda x: x.get('number', 0))
            random_samples = persona_pool[:num_samples]

        # Update progress to 10% - Setup complete, starting baseline
        supabase.table("experiments").update({"progress": 10}).eq("experiment_id", uuid).execute()

        # Generate baseline prompt and get token usage (progress 10-30% via callback)
        sample = data.get('sample')
        # Add the generated personas to the sample object
        sample['persona'] = random_samples

        on_baseline_row = create_progress_updater(
            uuid, supabase, 10, 30, num_samples,
            get_client=get_supabase_client, jwt=jwt, no_throttle=True
        )
        df, prompt_tokens = baseline_prompt(data, model_name, sample, progress_callback=on_baseline_row)

        # Evaluate responses and get token usage (progress 30-80% via per-column callback, write every call)
        steps = data.get('steps', [])
        num_cols_per_row = max(1, df.shape[1] - 1)
        total_eval_units = df.shape[0] * num_cols_per_row
        on_eval_unit = create_progress_updater(
            uuid, supabase, 30, 80, total_eval_units,
            get_client=get_supabase_client, jwt=jwt, no_throttle=True
        )
        fn, eval_tokens = evaluate(df, model_name, steps, progress_callback=on_eval_unit)

        df = df.replace('\n', '', regex=True)
        # sim_matrix = create_sim_matrix(df)
        
        # Progress already at 80% from callback; post-process is fast
        
        # Calculate total token usage for prompts
        total_prompt_input_token = sum(token_dict.get('prompt_tokens', 0) for token_dict in (prompt_tokens or []))
        total_prompt_output_token = sum(token_dict.get('response_tokens', 0) for token_dict in (prompt_tokens or []))
        total_prompt_total_token = sum(token_dict.get('total_tokens', 0) for token_dict in (prompt_tokens or []))

        # Calculate total token usage for evaluation
        total_eval_input_token = sum(token_dict.get('gemini_prompt_tokens', 0) for token_dict in (eval_tokens or []))
        total_eval_output_token = sum(token_dict.get('gemini_response_tokens', 0) for token_dict in (eval_tokens or []))
        total_eval_total_token = sum(token_dict.get('gemini_total_tokens', 0) for token_dict in (eval_tokens or []))

        # Store token usage and cost in Supabase
        total_tokens = total_prompt_total_token + total_eval_total_token
        prompt_cost, eval_cost = compute_prompt_and_eval_cost(
            total_prompt_input_token,
            total_prompt_output_token,
            total_eval_input_token,
            total_eval_output_token,
            model_name=model_name,
        )
        total_cost = prompt_cost + eval_cost
        supabase.table("tokens").insert({
            "id": uuid,
            "experiment_id": uuid,
            "operation": "simulation",
            "user_id": data.get("user_id"),
            "prompt_input_token": total_prompt_input_token,
            "prompt_output_token": total_prompt_output_token,
            "prompt_total_token": total_prompt_total_token,
            "eval_input_token": total_eval_input_token,
            "eval_output_token": total_eval_output_token,
            "eval_total_token": total_eval_total_token,
            "total_tokens": total_tokens,
            "prompt_cost": prompt_cost,
            "eval_cost": eval_cost,
            "total_cost": total_cost,
        }).execute()

        # Upload evaluation results to Supabase storage
        bucket_name = "llm-responses"
        with open(fn, 'rb') as f:
            upload_response = supabase.storage.from_(bucket_name).upload(
                path=f'llm/{fn}',
                file=f,
            )
        os.remove(fn)
        public_url = supabase.storage.from_(bucket_name).get_public_url(
            f'llm/{fn}')
        # sim_matrix['public_url'] = public_url

        # Update progress to 90% - File uploaded
        supabase.table("experiments").update({
            "progress": 90,
        }).eq("experiment_id", uuid).execute()

        response = supabase.table("experiments").update({
            "url": public_url,
        }).eq("experiment_id", uuid).execute()

        # Update progress to 100% - Completed
        supabase.table("experiments").update({
            "progress": 100,
            "status": "Completed"
        }).eq("experiment_id", uuid).execute()
    except Exception as e:
        logger.exception("Evaluation failed")
        # Create a new Supabase client for error handling
        supabase = get_supabase_client(jwt)
        supabase.table("experiments").update({
            "status": "Failed",
        }).eq("experiment_id", uuid).execute()
        # Clean up temporary file
        try:
            if fn and os.path.exists(fn):
                os.remove(fn)
        except:
            pass

class Evaluation(Resource):
    """
    Resource for handling LLM evaluation requests with progress tracking (now async via threading).
    """
    def post(self):
        try:
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith("Bearer "):
                logger.debug("No Authorization header or invalid format")
                jwt = None
            else:
                jwt = auth_header.split("Bearer ")[1]
            uuid = request.get_json()['id']
            data = request.get_json()['data']
            model_name = resolve_model_name(data.get('model', 'gemini-2.0-flash'))

            supabase: Client = create_client(url, key)
            if jwt:
                supabase.auth.set_session(jwt, "")
            # Create progress tracking entry
            task_id = uuid
            response = supabase.table("experiments").insert({
                "experiment_id": uuid,
                "progress": 0,
                "status": "Started",
                "sample_name": data['sample']['name'],
                "user_id": data['user_id'],
                "simulation_name": data['title'],
                "experiment_data": data,
                "model": model_name,
            }).execute()
            # Start background thread for evaluation, pass model_name and jwt
            thread = threading.Thread(target=run_evaluation, args=(uuid, data, model_name, jwt))
            thread.start()
            # Return immediately with task_id
            return jsonify({"status": "started", "task_id": task_id})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)})


class Progress(Resource):
    """
    Resource for checking evaluation progress.
    """
    
    def get(self):
        """
        Handle GET requests for progress checking.
        
        Query parameters:
        - task_id: The task identifier
        - user_id: The user identifier
        
        Returns:
            JSON response containing progress information
        """
        try:
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith("Bearer "):
                jwt = None
            else:
                jwt = auth_header.split("Bearer ")[1]
            task_id = request.args.get('task_id')
            user_id = request.args.get('user_id')

            if not task_id or not user_id:
                return {"status": "error", "message": "Missing task_id or user_id"}, 400
            
            # Create a new Supabase client for this request
            supabase = get_supabase_client(jwt)
            response = supabase.table("experiments").select(
                "*").eq("experiment_id", task_id).execute()
            
            if response.data:
                progress_data = response.data[0]
                
                # Check if experiment is already completed - return early to avoid unnecessary processing
                status = progress_data.get('status', '').lower()
                progress = progress_data.get('progress', 0)
                
                # If completed or failed, log a warning if still being polled (this shouldn't happen)
                if status in ['completed', 'failed'] or (isinstance(progress, (int, float)) and progress >= 100):
                    logger.debug(f"Progress check for completed experiment {task_id} (status: {status}, progress: {progress})")
                
                return jsonify({
                    "status": "success",
                    "progress": progress_data
                })
            else:
                return {"status": "not_found", "message": "Progress not found"}, 404

        except Exception as e:
            logger.error(f"Error in Progress endpoint: {str(e)}")
            return {"status": "error", "message": str(e)}, 500


class GenerateSteps(Resource):
    """
    Resource for generating simulation steps from a user prompt using Gemini.
    """
    
    def post(self):
        """
        Handle POST requests for generating simulation steps.
        
        Request body:
        - prompt: The user's description of a cognitive task, behavior, or goal
        
        Returns:
            JSON response containing generated simulation steps in structured format
        """
        request_id = datetime.now().strftime('%Y%m%d%H%M%S%f')
        logger.info(f"[{request_id}] GenerateSteps POST request received")
        
        try:
            data = request.get_json()
            logger.debug(f"[{request_id}] Request data received: {json.dumps(data, indent=2)[:500]}")  # Log first 500 chars
            
            user_prompt = data.get('prompt')
            title = data.get('title', '')  # Optional: study title for context
            introduction = data.get('introduction', '')  # Optional: study introduction for context
            
            logger.info(f"[{request_id}] User prompt length: {len(user_prompt) if user_prompt else 0} characters")
            
            if not user_prompt:
                logger.warning(f"[{request_id}] Missing 'prompt' in request body")
                return {"status": "error", "message": "Missing 'prompt' in request body"}, 400
            
            # System prompt for the cognitive science researcher
            system_prompt = GENERATE_STEPS_SYSTEM_PROMPT

            # User prompt with title and introduction as context
            full_prompt = get_generate_steps_user_prompt(user_prompt, title=title, introduction=introduction)
            logger.debug(f"[{request_id}] Full prompt prepared (length: {len(full_prompt)} characters)")
            
            # Call LLM via LangChain
            logger.info(f"[{request_id}] Calling LLM (gemini-2.0-flash) via LangChain")
            try:
                llm = get_llm("gemini-2.0-flash", temperature=0.7)
                lc_response = llm.invoke([
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=full_prompt),
                ])
                # content may be a string or a list of parts depending on the provider/version
                raw_content = lc_response.content
                if isinstance(raw_content, list):
                    response_text = "".join(
                        part.get("text", "") if isinstance(part, dict) else str(part)
                        for part in raw_content
                    )
                else:
                    response_text = raw_content or ""
                logger.info(f"[{request_id}] LLM call successful")

                # Track token usage for generate_steps
                try:
                    usage_meta = lc_response.usage_metadata or {}
                    prompt_count = usage_meta.get("input_tokens", 0) or 0
                    output_count = usage_meta.get("output_tokens", 0) or 0
                    total_count = usage_meta.get("total_tokens", 0) or 0
                    auth_header = request.headers.get("Authorization")
                    jwt = auth_header.split("Bearer ")[1] if auth_header and auth_header.startswith("Bearer ") else None
                    supabase_client = get_supabase_client(jwt)
                    user_id = data.get("user_id")
                    if not user_id and jwt:
                        try:
                            user_response = supabase_client.auth.get_user()
                            if user_response and getattr(user_response, "user", None):
                                user_id = user_response.user.id
                        except Exception:
                            pass
                    if user_id is not None:
                        gen_prompt_cost = compute_cost(prompt_count, output_count)
                        supabase_client.table("tokens").insert({
                            "id": str(uuid.uuid4()),
                            "experiment_id": None,
                            "operation": "generate_steps",
                            "user_id": user_id,
                            "prompt_input_token": prompt_count,
                            "prompt_output_token": output_count,
                            "prompt_total_token": total_count,
                            "eval_input_token": 0,
                            "eval_output_token": 0,
                            "eval_total_token": 0,
                            "total_tokens": total_count,
                            "prompt_cost": gen_prompt_cost,
                            "eval_cost": 0.0,
                            "total_cost": gen_prompt_cost,
                        }).execute()
                except Exception as token_err:
                    logger.warning(f"[{request_id}] Failed to store token usage: {token_err}")
            except Exception as api_error:
                error_msg = str(api_error)
                error_type = type(api_error).__name__
                logger.error(f"[{request_id}] Error calling LLM: {error_type}: {error_msg}", exc_info=True)
                return {"status": "error", "message": f"Failed to call LLM: {error_msg}"}, 500

            # Parse JSON response
            logger.info(f"[{request_id}] Parsing LLM response")
            try:
                logger.info(f"[{request_id}] ========== FULL LLM RESPONSE ==========")
                logger.info(f"[{request_id}] Response text length: {len(response_text)} characters")
                logger.info(f"[{request_id}] Full response:\n{response_text}")
                logger.info(f"[{request_id}] ========================================")

                steps_data = json.loads(response_text)
                logger.info(f"[{request_id}] JSON parsing successful")
                logger.info(f"[{request_id}] Parsed data structure:")
                logger.info(f"[{request_id}] {json.dumps(steps_data, indent=2)}")
                logger.debug(f"[{request_id}] Parsed data keys: {list(steps_data.keys())}")
            except (AttributeError, KeyError, IndexError) as parse_error:
                error_msg = str(parse_error)
                error_type = type(parse_error).__name__
                logger.error(f"[{request_id}] Error accessing LLM response: {error_type}: {error_msg}", exc_info=True)
                return {"status": "error", "message": f"Failed to access LLM response: {error_msg}"}, 500
            except json.JSONDecodeError as parse_error:
                error_msg = str(parse_error)
                logger.error(f"[{request_id}] JSON decode error: {error_msg}", exc_info=True)
                logger.error(f"[{request_id}] Response text that failed to parse: {response_text[:500]}")
                return {"status": "error", "message": f"Failed to parse JSON response from LLM: {error_msg}"}, 500

            # Validate basic structure - just needs to be a dict with at least one step
            logger.info(f"[{request_id}] Validating response structure")
            if not isinstance(steps_data, dict):
                logger.error(f"[{request_id}] Invalid response format: expected dict, got {type(steps_data)}")
                return {"status": "error", "message": "Invalid response format: expected a JSON object"}, 500
            
            # Extract introduction and title if present
            generated_introduction = steps_data.get('introduction', '')
            generated_title = (steps_data.get('title') or '').strip()
            if generated_introduction:
                logger.info(f"[{request_id}] Generated introduction found (length: {len(generated_introduction)} characters)")
            if generated_title:
                logger.info(f"[{request_id}] Generated title found: {generated_title}")
            
            # Validate and normalize step structure - check for "description" vs "instructions"
            step_keys = [k for k in steps_data.keys() if k.startswith('step')]
            if not step_keys:
                logger.error(f"[{request_id}] No steps found in response")
                logger.error(f"[{request_id}] Available keys: {list(steps_data.keys())}")
                return {"status": "error", "message": "Response must contain at least one step (step01, step02, etc.)"}, 500
            logger.info(f"[{request_id}] Found {len(step_keys)} step(s)")
            logger.debug(f"[{request_id}] Step keys: {step_keys}")
            
            # Normalize any steps that use "description" instead of "instructions"
            # Also filter out introduction steps
            introduction_keywords = ['introduction', 'welcome', 'overview', 'context', 'background', 'purpose']
            filtered_steps = {}
            step_counter = 1
            
            for step_key in sorted(step_keys):  # Sort to maintain order
                step = steps_data[step_key]
                if isinstance(step, dict):
                    # Normalize "description" to "instructions"
                    if "description" in step and "instructions" not in step:
                        logger.warning(f"[{request_id}] Step {step_key} uses 'description' instead of 'instructions', normalizing...")
                        step["instructions"] = step.pop("description")
                    elif "description" in step and "instructions" in step:
                        logger.warning(f"[{request_id}] Step {step_key} has both 'description' and 'instructions', removing 'description'")
                        step.pop("description")
                    
                    # Check if this is an introduction step and filter it out
                    step_title = step.get('title', '').lower().strip()
                    is_introduction_step = any(keyword in step_title for keyword in introduction_keywords)
                    
                    if is_introduction_step:
                        logger.warning(f"[{request_id}] Filtering out introduction step: {step_key} with title '{step.get('title', '')}'")
                        continue  # Skip this step
                    
                    # Renumber the step
                    new_step_key = f"step{step_counter:02d}"
                    filtered_steps[new_step_key] = step
                    step_counter += 1
            
            if not filtered_steps:
                logger.error(f"[{request_id}] All steps were filtered out as introduction steps")
                return {"status": "error", "message": "No valid steps generated. Please ensure your prompt describes actual tasks, not just an introduction."}, 500
            
            # Build output dict with steps, introduction, and optional title
            output_dict = filtered_steps.copy()
            if generated_introduction:
                output_dict['introduction'] = generated_introduction
            if generated_title:
                output_dict['title'] = generated_title
            
            logger.info(f"[{request_id}] Response validated and normalized successfully. {len(filtered_steps)} step(s) after filtering out introduction steps.")
            if generated_introduction:
                logger.info(f"[{request_id}] Generated introduction included in response")
            
            # Return the structured data (output_dict contains steps and optionally introduction)
            logger.info(f"[{request_id}] Returning successful response")
            return jsonify({
                "status": "success",
                "data": output_dict
            })
            
        except Exception as e:
            # Catch-all for any unexpected errors
            error_msg = str(e)
            error_type = type(e).__name__
            logger.error(f"[{request_id}] Unexpected error in GenerateSteps: {error_type}: {error_msg}", exc_info=True)
            import traceback
            logger.error(f"[{request_id}] Traceback: {traceback.format_exc()}")
            return {"status": "error", "message": f"An unexpected error occurred: {error_msg}"}, 500


# Register the resources with the API
api.add_resource(Evaluation, "/evaluate")
api.add_resource(Progress, "/progress")
api.add_resource(GenerateSteps, "/generate-steps")

# Register the API blueprint with the Flask application
app.register_blueprint(api_bp, url_prefix="/api")

if __name__ == "__main__":
    # Configure and run the Flask application based on environment
    prod = os.environ.get("DEV") or 'production'
    if prod == 'development':
        app.run(debug=True, use_reloader=False)
    else:
        app.run(debug=True, host="0.0.0.0", port=int(
            os.environ.get("PORT", 8080)))
