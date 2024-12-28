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
from dotenv import load_dotenv
import pandas as pd


load_dotenv()

# Start app instance
app = Flask(__name__)

CORS(app)

# Register API blueprint
api_bp = Blueprint("api", __name__)
api = Api(api_bp)

# Define the Evaluation resource
class Evaluation(Resource):  # Inherit from Resource
    def post(self):
        try:
            data = request.get_json()
            return jsonify({"status": "success", "evaluation": "Hello"})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)})

# Add the resource to the API
api.add_resource(Evaluation, "/evaluate")

# Register the blueprint
app.register_blueprint(api_bp, url_prefix="/api")

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
