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
                    "allow_headers": ["Content-Type"]}})
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

# Configure Google Gemini API
key_g = os.environ.get('GEMINI_KEY')
genai.configure(api_key=key_g)


class Evaluation(Resource):
    """
    Resource for handling LLM evaluation requests.
    
    This class processes evaluation requests, authenticates users, and returns
    evaluation results including similarity matrices and token usage statistics.
    """
    
    def post(self):
        """
        Handle POST requests for LLM evaluation.
        
        Returns:
            JSON response containing:
            - Success case: Evaluation results and similarity matrix
            - Error case: Error message and status
        
        Raises:
            Various exceptions that are caught and returned as error responses
        """
        try:
            # Authentication check for production environment
            if prod != 'development':
                auth_header = request.headers.get('Authorization')
                if not auth_header or not auth_header.startswith("Bearer "):
                    return jsonify({"status": "error", "message": "Missing or invalid Authorization header"}), 401

                # Verify the token matches the expected GCP token
                token = auth_header.split("Bearer ")[1]
                if token != os.environ.get("VITE_GCP_TOKEN"):
                    return jsonify({"status": "error", "message": "Missing or invalid Authorization header"}), 401

            # Get user data from Supabase
            uuid = request.get_json()['uuid']
            supabase: Client = create_client(url, key)
            response = supabase.table("users").select(
                "*").eq("id", uuid).execute().data
            metrics = response[0]["user"]['metrics']

            # Generate baseline prompt and get token usage
            df, prompt_tokens = baseline_prompt(response, key_g)

            # Evaluate responses and get token usage
            fn, eval_tokens = evaluate(df, key_g, metrics)
            df = df.replace('\n', '', regex=True)
            sim_matrix = create_sim_matrix(df)
            
            # Calculate total token usage for prompts
            total_prompt_input_token = sum(token_dict['prompt_tokens'] for token_dict in prompt_tokens)
            total_prompt_output_token = sum(token_dict['response_tokens'] for token_dict in prompt_tokens)
            total_prompt_total_token = sum(token_dict['total_tokens'] for token_dict in prompt_tokens)

            # Calculate total token usage for evaluation
            total_eval_input_token = sum(token_dict['gemini_prompt_tokens'] for token_dict in eval_tokens)
            total_eval_output_token = sum(token_dict['gemini_response_tokens'] for token_dict in eval_tokens)
            total_eval_total_token = sum(token_dict['gemini_total_tokens'] for token_dict in eval_tokens)

            # Store token usage in Supabase
            response_tokens = supabase.table("tokens").insert({
                "id": uuid,
                "prompt_input_token": total_prompt_input_token,
                "prompt_output_token": total_prompt_output_token,
                "prompt_total_token": total_prompt_total_token,
                "eval_input_token": total_eval_input_token,
                "eval_output_token": total_eval_output_token,
                "eval_total_token": total_eval_total_token,
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
            sim_matrix['public_url'] = public_url

            return jsonify({"status": "success", "evaluation": sim_matrix})
        except Exception as e:
            # Clean up temporary file and return error
            os.remove(fn)
            return jsonify({"status": "error", "message": str(e)})


# Register the Evaluation resource with the API
api.add_resource(Evaluation, "/evaluate")

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
