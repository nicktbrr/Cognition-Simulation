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
import io
from datetime import datetime


load_dotenv()

# Start app instance
app = Flask(__name__)

prod = os.environ.get("DEV") or 'production'

if prod == 'development':
    CORS(app, resources={
        r"/api/*": {"origins": ["http://localhost:5173"],
                    "methods": ["GET", "POST", "OPTIONS"],
                    "allow_headers": ["Content-Type"]}})
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


def parse_col(col):
    """
    Splits a column by '###' and returns two parts:
    - The part before '###'
    - The part after '###'
    """
    col_split = col.str.split('###', expand=True)
    col_before = col_split[0]  # Before ###
    col_after = col_split[1]   # After ###
    return col_before, col_after




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
    metric = responses[0]['user']['metric']
    for row in range(df.shape[0]):
        for col in range(start, df.shape[1]):
            label = responses[0]['user']['steps'][df.columns[col]]
            genai.configure(api_key=key_g)

            # in original prompt also include metric, need to figure out good prompt, give json template.
            # need to figure out how to get the metric from the prompt.

            system_prompt = f"""
            You are an AI assistant tasked with solving problems and evaluating solutions based on the following metrics:
            - **Clarity**: Degree to which something has fewer possible interpretations.
            - **Feasibility**: Degree to which something is solvable, attainable, viable, or achievable.
            - **Importance**: Degree to which something is valuable, useful, or meaningful.
            - **Uniqueness**: Degree to which something is novel, original, or distinct.
            - **Fairness**: Degree to which something is free from bias, favoritism, or injustice.
            - **Quality**: Degree to which the content is communicated effectively.

            Your task is to generate a response for the specified step and evaluate it based on the metric: **{metric}**.
            Provide:
            1. A response to the step.
            2. A numerical evaluation of the response based on the metric using a scale from 1 (very low) to 7 (very high).

            ### Instructions:
            - Use only the given information for the step: **{label}**.
            - Respond with the current step output, a special separator `###`, the metrics name, and the numerical ratings.
            - Make sure the metrics are in the format like this: metric_name:metric_value, etc.
            - Avoid including any additional text or explanations.
            - Do not use newline characters (`\n`). Always end with a period.


            ### Final Note:
            Ensure the response strictly adheres to the format.
            """

            prompt = f"Given the previous step: {df.iloc[row, col-1]}\n" \
                     f"Step {df.columns[col]}: {label}.\n" \
                     f"Respond according to the system prompt."


            model = genai.GenerativeModel("gemini-1.5-flash",
                                          system_instruction=system_prompt)
            response = model.generate_content(prompt,
                                              generation_config=genai.types.GenerationConfig(
                                                  temperature=1.0))
            df.iloc[row, col] = response.text

    print(df)
    return df


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
            df = prompt_llm(response)
            df = df.replace('\n', '', regex=True)
            print('before cos', df.shape)
            sim_matrix = create_sim_matrix(df)
            # Generate a unique filename for the CSV
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            # Process columns by splitting on '###'
            prev_cols = list(df.columns)[1:]  # Skip the seed column
            for col in prev_cols:
                col_before, col_after = parse_col(df[col])
                df[col] = col_before  # Update column to the non-metric value
                df[f"{col}_after"] = col_after  # Add a temporary column for metrics

            # Process '_after' columns to split metrics
            after_cols = [col for col in df.columns if col.endswith("_after")]

            for col in after_cols:
                # Split the '_after' column on commas
                split_cols = df[col].str.split(',', expand=True)
                
                # Process each metric, naming columns appropriately and extracting numeric values
                for part in split_cols.columns:
                    # Extract the metric name (e.g., 'clarity:7' -> 'clarity')
                    metric_col = split_cols[part].str.split(':', expand=True)
                    metric_name = metric_col[0].iloc[0]  # Metric name (assume consistent across rows)
                    metric_values = pd.to_numeric(metric_col[1], errors='coerce')  # Extract numeric values
                    
                    # Create the new column with the format <original_column_name>_<metric>
                    new_col_name = f"{col.replace('_after', '')}_{metric_name}"
                    df[new_col_name] = metric_values

                # Drop the original '_after' column
                df.drop(columns=col, inplace=True)
            fn = f'csv_{timestamp}.csv'
            df.to_csv(fn, index=False)

            # Upload the CSV to the Supabase bucket
            bucket_name = "llm-responses"  # Replace with your bucket name
            with open(fn, 'rb') as f:
                upload_response = supabase.storage.from_(bucket_name).upload(
                    path=f'llm/{fn}',
                    file=f,
                )
            os.remove(fn)
            print(sim_matrix)

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
        print('here')
        app.run(debug=True, use_reloader=False)
    else:
        app.run(debug=True, host="0.0.0.0", port=int(
            os.environ.get("PORT", 8080)))
