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
# import openai
from datetime import datetime
from supabase import create_client, Client
from .used_prompts import (
    get_persona_generation_user_prompt,
    get_evaluation_system_prompt,
    get_evaluation_user_prompt
)

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


def generate_persona_from_attributes(sample, key_g, supabase_client=None):
    """
    Generate a persona using Gemini based on sample attributes when persona is 'NA'.
    
    Args:
        sample (dict): Sample data containing attributes and persona
        key_g (str): Gemini API key
        supabase_client: Supabase client for database updates
        
    Returns:
        str: Generated persona or original persona if not 'NA'
    """
    # Check if persona is 'NA'
    if sample.get('persona', '').upper() != 'NA':
        return sample.get('persona', '')
    
    # Extract attributes for persona generation
    attributes = sample.get('attributes', [])
    
    # Build attributes description for the prompt
    attributes_text = ""
    for attr in attributes:
        label = attr.get('label', '')
        category = attr.get('category', '')
        values = attr.get('values', [])
        if values:
            values_str = ', '.join(values)
            attributes_text += f"- {label} ({category}): {values_str}\n"
    
    # Create prompt for persona generation
    persona_prompt = get_persona_generation_user_prompt(attributes_text)

    try:
        # Configure Gemini API
        genai.configure(api_key=key_g)
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        # Generate persona
        response = model.generate_content(
            persona_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=200
            )
        )
        
        generated_persona = response.text.strip()

        print("generated_persona", generated_persona)
        
        # Update the sample in the database if supabase client is provided
        if supabase_client and generated_persona:
            try:
                supabase_client.table("samples").update({
                    "persona": generated_persona
                }).eq("id", sample.get('id')).execute()
                print(f"Updated persona for sample {sample.get('id')}")
            except Exception as e:
                print(f"Error updating persona in database: {e}")
        
        return generated_persona
        
    except Exception as e:
        print(f"Error generating persona: {e}")
        return sample.get('persona', '')




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
        
        # Determine sort order based on persona "number" field
        sort_indices = None
        if 'persona' in df_response.columns:
            # Extract persona numbers and create sort order
            persona_numbers = []
            for idx in range(len(df_response)):
                persona = df_response.iloc[idx]['persona']
                if isinstance(persona, dict) and 'number' in persona:
                    persona_numbers.append((idx, persona['number']))
                else:
                    # If no number field, use index + 1 as fallback
                    persona_numbers.append((idx, idx + 1))
            
            # Sort by number and get the sorted indices
            persona_numbers.sort(key=lambda x: x[1])
            sort_indices = [x[0] for x in persona_numbers]
        
        # Sort dataframes by persona number order
        if sort_indices:
            df_response_sorted = df_response.iloc[sort_indices].reset_index(drop=True)
            if not df_gemini.empty and len(df_gemini) == len(df_response):
                df_gemini_sorted = df_gemini.iloc[sort_indices].reset_index(drop=True)
            else:
                df_gemini_sorted = df_gemini.copy()
        else:
            df_response_sorted = df_response.copy()
            df_gemini_sorted = df_gemini.copy()
        
        # Create Personas sheet
        personas_data = []
        all_keys = set()
        
        if 'persona' in df_response_sorted.columns:
            # First pass: collect all unique keys from all personas (excluding 'number')
            for idx in range(len(df_response_sorted)):
                persona = df_response_sorted.iloc[idx]['persona']
                if isinstance(persona, dict):
                    # Collect all keys except 'number' since we'll remove it from display
                    keys = {k for k in persona.keys() if k != 'number'}
                    all_keys.update(keys)
            
            # Second pass: build rows with all columns
            for idx in range(len(df_response_sorted)):
                persona = df_response_sorted.iloc[idx]['persona']
                row = {'ID': idx + 1}
                
                if isinstance(persona, dict):
                    # Add each attribute as its own column (excluding 'number')
                    for key in all_keys:
                        row[key] = persona.get(key, 'N/A')
                else:
                    # If persona is not a dict, put it in a single column
                    row['Persona'] = str(persona) if persona else 'N/A'
                
                personas_data.append(row)
        
        if personas_data:
            # Ensure consistent column order: ID first, then sorted attribute keys (excluding 'number')
            if all_keys:
                column_order = ['ID'] + sorted(all_keys)
                personas_df = pd.DataFrame(personas_data)
                # Reorder columns to match desired order
                personas_df = personas_df.reindex(columns=column_order, fill_value='N/A')
            else:
                personas_df = pd.DataFrame(personas_data)
            personas_df.to_excel(writer, sheet_name='Personas', index=False)
        
        # Add ID column to responses sheet (1-10, matching persona index)
        # Remove persona column from Responses sheet (it's in Personas sheet)
        df_response_with_id = df_response_sorted.copy()
        if 'persona' in df_response_with_id.columns:
            df_response_with_id = df_response_with_id.drop(columns=['persona'])
        df_response_with_id.insert(0, 'ID', range(1, len(df_response_sorted) + 1))
        df_response_with_id.to_excel(writer, sheet_name='Responses', index=False)
        
        # Add ID column to metrics sheet (1-10, matching persona index)
        if not df_gemini_sorted.empty:
            df_gemini_with_id = df_gemini_sorted.copy()
            df_gemini_with_id.insert(0, 'ID', range(1, len(df_gemini_sorted) + 1))
            df_gemini_with_id.to_excel(writer, sheet_name='Metrics', index=False)
    
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

    print(f"[DEBUG PROCESS_ROW] Row {row_idx} data: {df_row}")
    print(f"[DEBUG PROCESS_ROW] Steps: {steps}")

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
        step_output = df_row.iloc[col]  # This is the actual output/response
        
        # Get the step index (col - 1 because first column is usually ID)
        step_idx = col - 1
        
        if step_idx < len(steps):
            current_step = steps[step_idx]
            current_measures = current_step.get('measures', [])
            step_instructions = current_step.get('instructions', '')  # Get actual step instructions from steps
            
            # Build measures string for this specific step only with detailed scoring guidance
            measures = ""
            for measure in current_measures:
                range_str = measure['range']
                # Parse range to extract min and max (e.g., "0 - 10" or "1-5")
                try:
                    if ' - ' in range_str:
                        min_val, max_val = map(float, range_str.split(' - '))
                    elif '-' in range_str:
                        min_val, max_val = map(float, range_str.split('-'))
                    else:
                        min_val, max_val = 0, 10  # Default fallback
                except:
                    min_val, max_val = 0, 10  # Default fallback
                
                measures += f"\n### {measure['title']}\n"
                measures += f"**Description:** {measure['description']}\n"
                measures += f"**Range:** {measure['range']} (minimum: {min_val}, maximum: {max_val})\n"
                if measure.get('desiredValues'):
                    measures += f"**Scoring Reference Points:**\n"
                    for desiredValue in measure['desiredValues']:
                        measures += f"  - {desiredValue['label']}: Use value {desiredValue['value']} as an anchor point for this quality level\n"
                else:
                    measures += f"**Scoring:** Use the full range from {min_val} to {max_val} based on quality\n"
            
            # Create user prompt for this specific step
            step_measures_list = ""
            for idx, measure in enumerate(current_measures):
                step_measures_list += f"{idx + 1}. {measure['title']}\n"
            
            user_prompt = get_evaluation_user_prompt(step_label, step_instructions, step_output, step_measures_list)
            
            # Create system prompt with only relevant measures for this step
            system_prompt = get_evaluation_system_prompt(measures)
            
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
    max_workers = 2
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

    results_df_gemini = pd.DataFrame(results_gemini)
    # Create empty DataFrame for GPT-4 since evaluation is commented out

    # Generate Excel report
    excel_file = dataframe_to_excel(df, results_df_gemini, steps)

    return excel_file, tokens_ls
