# Cognition Simulation Backend

A Flask-based backend service for LLM evaluation and response analysis, deployed on Google Cloud Run.

## Overview

This service provides an API endpoint for evaluating LLM responses using various metrics and storing results in Supabase. It integrates with Google's Gemini API for LLM operations and handles CORS for both development and production environments.

## Features

- LLM response evaluation and analysis
- Integration with Google Gemini API
- Supabase database integration
- Token usage tracking
- CORS support for development and production
- Secure authentication in production

## API Endpoints

- `POST /api/evaluate`: Evaluates LLM responses and returns similarity matrices
  - Requires authentication in production
  - Returns evaluation results and token usage statistics

## Environment Variables

Required environment variables:
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_KEY`: Supabase API key
- `GEMINI_KEY`: Google Gemini API key
- `VITE_GCP_TOKEN`: Authentication token for production
- `DEV`: Set to 'development' for local development

## Development

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run locally:
   ```bash
   python app.py
   ```

## Deployment

The application is containerized using Docker and deployed to Google Cloud Run. The Dockerfile is configured to:
- Use Python 3.11
- Install dependencies from requirements.txt
- Expose port 8080
- Run with Gunicorn (4-minute timeout)

## Dependencies

Key dependencies include:
- Flask 3.0.3
- Flask-RESTful 0.3.10
- Google Generative AI 0.8.3
- Supabase 2.10.0
- Various ML libraries (torch, transformers, scikit-learn)
