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
import google.generativeai as genai
from utils.cosine_sim import *
from utils.prompts import *
from utils.evaluate import *
import threading
import uuid


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
    # Production CORS settings - allow Vercel deployment
    CORS(app, resources={
        r"/api/*": {
            "origins": "https://cognition-simulation-e9on.vercel.app",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
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

# Configure Google Gemini API
key_g = os.environ.get('GEMINI_KEY')
genai.configure(api_key=key_g)


def run_evaluation(uuid, data, key_g, jwt=None):
    fn = None  # Initialize fn variable for cleanup
    try:
        # Create a new Supabase client for this request
        supabase = get_supabase_client(jwt)
        metrics = data['metrics']

        response = supabase.table("experiments").insert({
            "experiment_id": uuid,
            "progress": 0,
            "status": "Started",
            "sample_name": "test",
            "user_id": data['user_id'],
            "simulation_name": data['title'],
            "experiment_data": data,
        }).execute()



        # Update progress to 10% - Starting evaluation
        response = supabase.table("experiments").update({
            "progress": 10,
        }).eq("experiment_id", uuid).execute()

        print("progress 10")

        # Generate baseline prompt and get token usage
        df, prompt_tokens = baseline_prompt(data, key_g)

        print("progress 10.5")

        # Update progress to 30% - Baseline prompt generated
        supabase.table("experiments").update({
            "progress": 30,
        }).eq("experiment_id", uuid).execute()

        print("progress 30")

        # Evaluate responses and get token usage
        fn, eval_tokens = evaluate(df, key_g, metrics, data['steps'])
        
        # Update progress to 60% - Evaluation completed
        supabase.table("experiments").update({
            "progress": 60,
        }).eq("experiment_id", uuid).execute()

        df = df.replace('\n', '', regex=True)
        sim_matrix = create_sim_matrix(df)
        
        # Update progress to 80% - Similarity matrix created
        supabase.table("experiments").update({
            "progress": 80,
        }).eq("experiment_id", uuid).execute()
        
        # Calculate total token usage for prompts
        # total_prompt_input_token = sum(token_dict['prompt_tokens'] for token_dict in prompt_tokens)
        # total_prompt_output_token = sum(token_dict['response_tokens'] for token_dict in prompt_tokens)
        # total_prompt_total_token = sum(token_dict['total_tokens'] for token_dict in prompt_tokens)

        # # Calculate total token usage for evaluation
        # total_eval_input_token = sum(token_dict['gemini_prompt_tokens'] for token_dict in eval_tokens)
        # total_eval_output_token = sum(token_dict['gemini_response_tokens'] for token_dict in eval_tokens)
        # total_eval_total_token = sum(token_dict['gemini_total_tokens'] for token_dict in eval_tokens)

        # Store token usage in Supabase
        # response_tokens = supabase.table("tokens").insert({
        #     "id": uuid,
        #     "prompt_input_token": total_prompt_input_token,
        #     "prompt_output_token": total_prompt_output_token,
        #     "prompt_total_token": total_prompt_total_token,
        #     "eval_input_token": total_eval_input_token,
        #     "eval_output_token": total_eval_output_token,
        #     "eval_total_token": total_eval_total_token,
        # }).execute()

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
        sim_matrix['public_url'] = public_url

        # Update progress to 90% - File uploaded
        supabase.table("experiments").update({
            "progress": 90,
        }).eq("experiment_id", uuid).execute()

        # response = supabase.table("dashboard").insert({
        #     "id": uuid,
        #     "data": data,
        #     "url": public_url,
        #     'user_id': data['user_id'],
        #     'name': data['title']
        # }).execute()

        # Update progress to 100% - Completed
        supabase.table("experiments").update({
            "progress": 100,
            "status": "Completed"
        }).eq("experiment_id", uuid).execute()
    except Exception as e:
        print("error", e)
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
                print("[DEBUG] No Authorization header or invalid format")
                jwt = None
            else:
                jwt = auth_header.split("Bearer ")[1]
            uuid = request.get_json()['id']
            data = request.get_json()['data']
            supabase: Client = create_client(url, key)
            if jwt:
                supabase.auth.set_session(jwt, "")
            print(f"[DEBUG] {request.get_json()}")
            # return jsonify({"status": "success", "message": "Simulation submitted successfully"})
            # Create progress tracking entry
            task_id = f"eval_{uuid}"
            response = supabase.table("download_progress").insert({
                "id": uuid,
                "user_id": data['user_id'],
                "task_id": task_id,
                "progress": 0,
                "status": "started"
            }).execute()
            # Start background thread for evaluation, pass jwt
            thread = threading.Thread(target=run_evaluation, args=(uuid, data, key_g, jwt))
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

            print("task_id", task_id)
            print("user_id", user_id)
            
            if not task_id or not user_id:
                return jsonify({"status": "error", "message": "Missing task_id or user_id"}), 400
            
            # Create a new Supabase client for this request
            supabase = get_supabase_client(jwt)
            response = supabase.table("experiments").select(
                "*").eq("experiment_id", task_id).execute()

            print(response)
            
            if response.data:
                progress_data = response.data[0]
                return jsonify({
                    "status": "success",
                    "progress": progress_data
                })
            else:
                return jsonify({"status": "not_found", "message": "Progress not found"}), 404
                
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500


# Register the resources with the API
api.add_resource(Evaluation, "/evaluate")
api.add_resource(Progress, "/progress")

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
