"""
This module provides functionality for evaluating AI model responses using both Gemini and GPT-4 models.
It includes utilities for processing evaluation results and generating Excel reports with detailed metrics.
"""

import pandas as pd
import google.generativeai as genai
import typing_extensions as typing
import json
from pydantic import BaseModel
import concurrent.futures
import os
import openai
from datetime import datetime

class EvaluationMetricsGPT4(BaseModel):
    """
    Pydantic model for GPT-4 evaluation metrics.
    
    Attributes:
        metric (list[str]): List of metric names being evaluated
        score (list[float]): List of corresponding scores for each metric
    """
    metric: list[str]
    score: list[float]


class EvaluationMetrics(typing.TypedDict):
    """
    TypedDict for Gemini evaluation metrics.
    
    Attributes:
        metric (list[str]): List of metric names being evaluated
        score (list[float]): List of corresponding scores for each metric
    """
    metric: list[str]
    score: list[float]


def extract_unique_measures(steps):
    """
    Extracts all unique measure information from steps data.
    
    Args:
        steps (list): List of step dictionaries containing measures
        
    Returns:
        list: List of dictionaries containing unique measure information
    """
    unique_measures = []
    seen_measures = set()
    
    for step in steps:
        measures = step.get('measures', [])
        for measure in measures:
            # Create a unique identifier based on title and description
            measure_key = f"{measure.get('title', '')}_{measure.get('description', '')}"
            
            if measure_key not in seen_measures:
                seen_measures.add(measure_key)
                
                measure_info = {
                    'title': measure.get('title', ''),
                    'description': measure.get('description', ''),
                    'range': measure.get('range', ''),
                    'desiredValues': measure.get('desiredValues', [])
                }
                unique_measures.append(measure_info)
    
    return unique_measures


def dataframe_to_excel(df_response, df_gemini, steps=None):
    """
    Converts evaluation results into an Excel file with multiple sheets.
    
    Args:
        df_response (pd.DataFrame): Original response dataframe
        df_gemini (pd.DataFrame): Gemini evaluation results
        steps (list): List of step dictionaries containing 'label' and 'instructions' keys
        
    Returns:
        str: Filename of the generated Excel file
    """
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    fn = f'multiple_sheets_{timestamp}.xlsx'

    with pd.ExcelWriter(fn, engine='openpyxl') as writer:
        # Add simulation steps as the first sheet if steps are provided
        if steps:
            steps_data = []
            for step in steps:
                step_info = {
                    'label': step['label'], 
                    'instructions': step['instructions'],
                    'temperature': step.get('temperature', 'N/A')
                }
                # Add measures information
                measures_info = []
                for measure in step.get('measures', []):
                    measures_info.append(f"{measure['title']}: {measure['description']} (Range: {measure['range']})")
                step_info['measures'] = '; '.join(measures_info)
                steps_data.append(step_info)
            
            steps_df = pd.DataFrame(steps_data)
            steps_df.to_excel(writer, sheet_name='Simulation Steps', index=False)
        
        # Add responses sheet
        df_response.to_excel(writer, sheet_name='Responses', index=False)
        
        # Add metrics sheet
        if not df_gemini.empty:
            df_gemini.to_excel(writer, sheet_name='Metrics', index=False)
    
    return fn


def process_row(row_idx, df_row, steps):
    """
    Processes a single row by evaluating responses using Gemini model.
    
    Args:
        row_idx (int): Index of the row being processed
        df_row (pd.Series): Row of data to evaluate
        steps (list): List of step dictionaries containing measures
        
    Returns:
        tuple: Contains:
            - dict: Gemini evaluation scores
            - dict: Token usage statistics
    """

    row_scores = {}
    all_token_usage = {}
    
    # Initialize row_scores with all possible metrics
    if steps:
        for step_idx, step in enumerate(steps):
            step_label = step.get('label', f'Step_{step_idx + 1}')
            measures = step.get('measures', [])
            for measure in measures:
                step_metric_name = f"{step_label}_{measure.get('title', '')}"
                row_scores[step_metric_name] = []
    
    # Process each column individually
    for col in range(1, len(df_row)):
        step_label = df_row.index[col]
        step_instructions = df_row.iloc[col]
        
        # Get the step index (col - 1 because first column is usually ID)
        step_idx = col - 1
        
        if step_idx < len(steps):
            current_step = steps[step_idx]
            current_measures = current_step.get('measures', [])
            
            # Build measures string for this specific step only
            measures = ""
            for measure in current_measures:
                measures += f"\n### {measure['title']}\n"
                measures += f"**Description:** {measure['description']}\n"
                measures += f"**Range:** {measure['range']}\n"
                for desiredValue in measure['desiredValues']:
                    measures += f"**Scoring Reference Point:** label: {desiredValue['label']}, value: {desiredValue['value']}\n"
            
            # Create user prompt for this specific step
            step_measures_list = ""
            for idx, measure in enumerate(current_measures):
                step_measures_list += f"{idx + 1}. {measure['title']}\n"
            
            user_prompt = f"""Step: {step_label}
Instructions: {step_instructions}

Measures to use for evaluation: 
{step_measures_list}

Please evaluate this response against the measures defined for this step, using the specified ranges and reference points to guide your scoring."""
            
            # Create system prompt with only relevant measures for this step
            system_prompt = f"""# Instruction
You are an expert evaluator. Your task is to evaluate the quality of AI-generated responses based on specific simulation steps and their associated measures.

You will be provided with:
1. The simulation step instructions
2. The AI-generated response for that step
3. Specific measures and their reference points for evaluation

Your task is to evaluate how well the AI response aligns with the step requirements and meets the specified measures.

# Measures used for evaluation
{measures}

## Scoring Rubric
For each measure, use the specified range (or 1-5 if no range provided) to score the response.

## Evaluation Steps
For each measure, follow these steps:

STEP 1: Analyze the AI response against the step instructions and measure requirements.
- Consider how well the response follows the step instructions
- Evaluate alignment with the measure's description and reference points
- Identify strengths and weaknesses

At the end, provide a structured evaluation with each measure and its corresponding score.

MAKE SURE THAT EACH STEP HAS A SCORE FOR EACH MEASURE. IF A MEASURE IS NOT APPLICABLE, SCORE IT AS 0."""
            
            try:
                # Make API call for this specific step
                model = genai.GenerativeModel(
                    "gemini-2.0-flash", system_instruction=system_prompt)

                response = model.generate_content(
                    user_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=1.0,
                        response_mime_type="application/json",
                        response_schema=EvaluationMetrics
                    )
                )

                # Parse JSON response
                json_response = json.loads(
                    response._result.candidates[0].content.parts[0].text)

                print(f"[DEBUG PROCESS_ROW] Column {col} JSON Response: {json_response}")
                
                # Process scores for this step's measures
                for idx, measure in enumerate(current_measures):
                    step_metric_name = f"{step_label}_{measure.get('title', '')}"
                    
                    if step_metric_name in row_scores:
                        try:
                            if idx < len(json_response.get('score', [])):
                                score = json_response["score"][idx]
                                row_scores[step_metric_name].append(score)
                            else:
                                row_scores[step_metric_name].append('Poorly Defined Criteria')
                        except (IndexError, KeyError) as e:
                            print(f"[DEBUG PROCESS_ROW] Error scoring {step_metric_name}: {e}")
                            row_scores[step_metric_name].append('Error in scoring')
                    else:
                        print(f"[DEBUG PROCESS_ROW] Metric {step_metric_name} not found in row_scores")
                        
            except Exception as e:
                print(f"[DEBUG PROCESS_ROW] Error processing column {col}: {e}")
                # Add error scores for this step's measures
                for measure in current_measures:
                    step_metric_name = f"{step_label}_{measure.get('title', '')}"
                    if step_metric_name in row_scores:
                        row_scores[step_metric_name].append('API Error')

    return row_scores, None, all_token_usage

def evaluate(df, key_g, steps=None):
    """
    Evaluates multiple rows in parallel using threading and combines the results into a DataFrame.
    
    Args:
        df (pd.DataFrame): Input dataframe containing responses to evaluate
        key_g (str): Gemini API key
        metrics (list): List of dictionaries containing metric definitions
        steps (list): List of step dictionaries containing 'label', 'instructions', and 'measures' keys
        
    Returns:
        tuple: Contains:
            - str: Filename of the generated Excel report
            - list: List of token usage statistics for each row
    """
    # Configure Gemini API
    genai.configure(api_key=key_g)
    
    if steps:
        print(f"[DEBUG EVALUATE] Processing {len(steps)} steps")
        all_metrics_to_evaluate = []
        
        for step_idx, step in enumerate(steps):
            step_label = step.get('label', f'Step_{step_idx + 1}')
            print(f"[DEBUG EVALUATE] Step {step_idx}: {step_label}")
            measures = step.get('measures', [])
            print(f"[DEBUG EVALUATE] Step {step_idx} measures: {measures}")
            
            for measure_idx, measure in enumerate(measures):
                measure_title = measure.get('title', '')
                print(f"[DEBUG EVALUATE] Measure {measure_idx} title: '{measure_title}'")
                
                # Create step-specific metric name
                step_metric_name = f"{step_label}_{measure_title}"
                measure_obj = {
                    'name': step_metric_name,
                    'description': measure.get('description', ''),
                    'range': measure.get('range', '1-5'),
                    'desiredValues': measure.get('desiredValues', [])
                }
                all_metrics_to_evaluate.append(measure_obj)
        
        metrics_to_evaluate = [m["name"] for m in all_metrics_to_evaluate]
        metric_description = {m["name"]: m["description"] for m in all_metrics_to_evaluate}
    else:
        print("[DEBUG EVALUATE] No steps provided")
        metrics_to_evaluate = []
        metric_description = {}

    # No need to build system prompt here - it will be built per column in process_row

    # Process rows in parallel using ThreadPoolExecutor
    max_workers = 4
    results_gemini = []
    results_gpt4 = []
    tokens_ls = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(
            process_row, idx, df.iloc[idx], steps): idx for idx in range(df.shape[0])}

        for future in concurrent.futures.as_completed(futures):
            try:
                results_gemini.append(future.result()[0])
                # Handle None GPT-4 results since evaluation is commented out
                gpt4_result = future.result()[1]
                if gpt4_result is not None:
                    results_gpt4.append(gpt4_result)
                tokens_ls.append(future.result()[2])
            except Exception as e:
                print(f"Error in thread execution: {e}")

    # Convert results to DataFrames

    print(f"[DEBUG EVALUATE] Results Gemini: {results_gemini}")
    results_df_gemini = pd.DataFrame(results_gemini)
    # Create empty DataFrame for GPT-4 since evaluation is commented out

    print(f"[DEBUG EVALUATE] Results Gemini: {results_df_gemini}")

    # Generate Excel report
    excel_file = dataframe_to_excel(df, results_df_gemini, steps)

    return excel_file, tokens_ls
