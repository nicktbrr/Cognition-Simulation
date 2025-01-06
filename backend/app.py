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


load_dotenv()

# Start app instance
app = Flask(__name__)

prod = os.environ.get("DEV") or 'production'

if prod == 'development':
    CORS(app, resources={
        r"/api/*": {"origins": "http://localhost:5173"}})
else:
    CORS(app, resources={
        r"/api/*": {
            "origins": "https://cognition-simulation.vercel.app",
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


def prompt_llm(responses):
    seed = responses[0]['user']['seed']
    cols = list(responses[0]['user']['steps'].keys())
    cols.insert(0, "seed")
    df = pd.DataFrame(columns=cols)
    for i in range(responses[0]['user']['iters']):
        if 'problem or task representation' not in cols:
            new_row = pd.DataFrame([{'seed': seed}])
        else:
            new_row = pd.DataFrame(
                [{'seed': seed, 'problem or task representation': seed}])
        df = pd.concat([df, new_row], ignore_index=True)
    start = 2
    if 'problem or task representation' not in df.columns:
        start = 1
    for row in range(df.shape[0]):
        for col in range(start, df.shape[1]):
            label = responses[0]['user']['steps'][df.columns[col]]
            prompt = (
                f"Given information about the following {str.upper(df.iloc[row, col-1])}"
                f"Step {str.upper(df.columns[col])}: {label} Please respond with ONLY the {df.columns[col]} step and absolutely no additional text or explanation."
            )
            genai.configure(api_key=key_g)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt,
                                              generation_config=genai.types.GenerationConfig(
                                                  temperature=1.0))
            df.iloc[row, col] = response.text
    return df


class Evaluation(Resource):  # Inherit from Resource
    def post(self):
        try:
            uuid = request.get_json()['uuid']
            print(uuid)
            supabase: Client = create_client(url, key)
            response = supabase.table("users").select(
                "*").eq("id", uuid).execute().data
            print(response)
            df = prompt_llm(response)
            print('before cos', df.shape)
            sim_matrix = create_sim_matrix(df)
            print(sim_matrix)

            return jsonify({"status": "success", "evaluation": sim_matrix})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)})


# Add the resource to the API
api.add_resource(Evaluation, "/evaluate")

# Register the blueprint
app.register_blueprint(api_bp, url_prefix="/api")

if __name__ == "__main__":

    app.run(debug=True, use_reloader=False)
    # app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
