from flask import Flask, Blueprint, request, jsonify
from flask_restful import Api, Resource
from dotenv import load_dotenv
from flask_cors import CORS
from transformers import BertTokenizer, BertModel
import re
import torch
import os
import random
import pandas as pd
import os
from supabase import create_client, Client
from pathlib import Path
import google.generativeai as genai
import pandas as pd
from utils.cosine_sim import *
from utils.prompts import *
import io
from datetime import datetime
from utils.evaluate import *
import time


load_dotenv()

# Start app instance
app = Flask(__name__)

prod = os.environ.get("DEV") or 'production'

print(prod)

if prod == 'development':
    CORS(app, resources={
        r"/api/*": {"origins": "http://localhost:3000",
                    "methods": ["GET", "POST", "OPTIONS"],
                    "allow_headers": ["Content-Type"]}})
else:
    CORS(app, resources={
        r"/api/*": {
            "origins": "https://cognition-simulation-e9on.vercel.app",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

# Register API blueprint
api_bp = Blueprint("api", __name__)
api = Api(api_bp)

# Define the Evaluation resource

# Set up supabase key, url
url: str = os.environ.get("VITE_SUPABASE_URL")
key: str = os.environ.get("VITE_SUPABASE_KEY")


print(url)

env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)
key_g = os.environ.get('GEMINI_KEY')
genai.configure(api_key=key_g)


class Evaluation(Resource):  # Inherit from Resource
    def post(self):
        try:
            print(prod)
            if prod != 'development':
                auth_header = request.headers.get('Authorization')
                if not auth_header or not auth_header.startswith("Bearer "):
                    return jsonify({"status": "error", "message": "Missing or invalid Authorization header"}), 401

                # Extract the token
                token = auth_header.split("Bearer ")[1]
                if token != os.environ.get("VITE_GCP_TOKEN"):
                    return jsonify({"status": "error", "message": "Missing or invalid Authorization header"}), 401

            uuid = request.get_json()['uuid']
            supabase: Client = create_client(url, key)
            response = supabase.table("users").select(
                "*").eq("id", uuid).execute().data
            print(response)
            metrics = response[0]["user"]['metrics']

            df = baseline_prompt(response, key_g)
            print('data after baseline prompt', df)
            evals = evaluate(df, key_g, metrics)
            print(evals)
            df = df.replace('\n', '', regex=True)
            # print('before cos', df.shape)
            sim_matrix = create_sim_matrix(df)
            # Generate a unique filename for the CSV
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            fn = f'csv_{timestamp}.csv'
            evals.to_csv(fn, index=False)

            # Upload the CSV to the Supabase bucket
            bucket_name = "llm-responses"  # Replace with your bucket name
            with open(fn, 'rb') as f:
                upload_response = supabase.storage.from_(bucket_name).upload(
                    path=f'llm/{fn}',
                    file=f,
                )
            os.remove(fn)
            public_url = supabase.storage.from_(bucket_name).get_public_url(
                f'llm/{fn}')
            # print(public_url)
            # print(sim_matrix)
            sim_matrix['public_url'] = public_url

            return jsonify({"status": "success", "evaluation": sim_matrix})
        except Exception as e:
            os.remove(fn)
            return jsonify({"status": "error", "message": str(e)})


# Add the resource to the API
api.add_resource(Evaluation, "/evaluate")

# Register the blueprint
app.register_blueprint(api_bp, url_prefix="/api")

if __name__ == "__main__":
    prod = os.environ.get("DEV") or 'production'
    if prod == 'development':
        app.run(debug=True, use_reloader=False)
    else:
        app.run(debug=True, host="0.0.0.0", port=int(
            os.environ.get("PORT", 8080)))
