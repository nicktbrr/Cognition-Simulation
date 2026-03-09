"""
This module provides functionality for evaluating AI model responses using both Gemini and GPT-4 models.
It includes utilities for processing evaluation results and generating Excel reports with detailed metrics.
"""

import pandas as pd
import concurrent.futures
import os
from datetime import datetime
from supabase import create_client, Client

from langchain_core.messages import SystemMessage, HumanMessage

from .llm import invoke_structured, EvaluationMetrics, get_llm
from .used_prompts import (
    get_persona_generation_user_prompt,
    get_evaluation_system_prompt,
    get_evaluation_user_prompt
)


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
        llm = get_llm("gemini-2.0-flash", temperature=0.7)
        response = llm.invoke([HumanMessage(content=persona_prompt)])
        generated_persona = response.content.strip()

        # Update the sample in the database if supabase client is provided
        if supabase_client and generated_persona:
            try:
                supabase_client.table("samples").update({
                    "persona": generated_persona
                }).eq("id", sample.get('id')).execute()
            except Exception:
                pass
        
        return generated_persona
        
    except Exception:
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
        # Unwrap single-element list cells so numbers display without brackets
        if not df_gemini_sorted.empty:
            df_gemini_with_id = df_gemini_sorted.copy()
            df_gemini_with_id.insert(0, 'ID', range(1, len(df_gemini_sorted) + 1))
            for col in df_gemini_with_id.columns:
                if col == 'ID':
                    continue
                df_gemini_with_id[col] = df_gemini_with_id[col].apply(
                    lambda x: x[0] if isinstance(x, list) and len(x) > 0 else x
                )
            df_gemini_with_id.to_excel(writer, sheet_name='Metrics', index=False)
    
    return fn


def process_row(row_idx, df_row, steps, model_name, progress_callback=None):
    """
    Processes a single row by evaluating responses using Gemini model.
    
    Args:
        row_idx (int): Index of the row being processed
        df_row (pd.Series): Row of data to evaluate
        steps (list): List of step dictionaries containing measures
        model_name (str): LLM model identifier (e.g. "gemini-2.0-flash")
        progress_callback (callable, optional): Called after each column completes for progress tracking
        
    Returns:
        tuple: Contains:
            - dict: Gemini evaluation scores
            - dict: Token usage statistics
    """

    row_scores = {}
    all_token_usage = {
        'gemini_prompt_tokens': 0,
        'gemini_response_tokens': 0,
        'gemini_total_tokens': 0,
    }

    # Initialize row_scores with all possible metrics
    if steps:
        for step_idx, step in enumerate(steps):
            step_label = step.get('label', f'Step_{step_idx + 1}')
            measures = step.get('measures', [])
            for measure in measures:
                step_metric_name = f"{step_label}_{measure.get('title', '')}"
                row_scores[step_metric_name] = []
    
    # Process each column individually
    print(f"[process_row {row_idx}] len(df_row)={len(df_row)}, has_callback={progress_callback is not None}", flush=True)
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
                # Invoke LLM with structured output via LangChain
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt),
                ]
                parsed, usage = invoke_structured(
                    model_name, EvaluationMetrics, messages, temperature=1.0
                )

                # Track token usage
                all_token_usage['gemini_prompt_tokens'] += usage['input_tokens']
                all_token_usage['gemini_response_tokens'] += usage['output_tokens']
                all_token_usage['gemini_total_tokens'] += usage['total_tokens']

                # Process scores for this step's measures
                for idx, measure in enumerate(current_measures):
                    step_metric_name = f"{step_label}_{measure.get('title', '')}"

                    if step_metric_name in row_scores:
                        try:
                            if parsed is not None and idx < len(parsed.score):
                                row_scores[step_metric_name].append(parsed.score[idx])
                            else:
                                row_scores[step_metric_name].append('Poorly Defined Criteria')
                        except (IndexError, KeyError):
                            row_scores[step_metric_name].append('Error in scoring')

            except Exception:
                # Add error scores for this step's measures
                for measure in current_measures:
                    step_metric_name = f"{step_label}_{measure.get('title', '')}"
                    if step_metric_name in row_scores:
                        row_scores[step_metric_name].append('API Error')

        if progress_callback:
            progress_callback()

    # If row had no step columns (only persona), still report completion
    if progress_callback and len(df_row) <= 1:
        progress_callback()

    return row_scores, None, all_token_usage

def evaluate(df, model_name, steps=None, progress_callback=None):
    """
    Evaluates multiple rows in parallel using threading and combines the results into a DataFrame.

    Args:
        df (pd.DataFrame): Input dataframe containing responses to evaluate
        model_name (str): LLM model identifier (e.g. "gemini-2.0-flash")
        steps (list): List of step dictionaries containing 'label', 'instructions', and 'measures' keys
        progress_callback (callable, optional): Called after each row completes for progress tracking

    Returns:
        tuple: Contains:
            - str: Filename of the generated Excel report
            - list: List of token usage statistics for each row
    """

    if steps:
        all_metrics_to_evaluate = []
        
        for step_idx, step in enumerate(steps):
            step_label = step.get('label', f'Step_{step_idx + 1}')
            measures = step.get('measures', [])
            
            for measure_idx, measure in enumerate(measures):
                measure_title = measure.get('title', '')
                
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
        metrics_to_evaluate = []
        metric_description = {}

    # No need to build system prompt here - it will be built per column in process_row

    # Total work units = rows * columns per row (each column is a Gemini API call)
    num_cols_per_row = max(1, df.shape[1] - 1)  # exclude first column (seed/persona)
    total_units = df.shape[0] * num_cols_per_row

    # Debug: verify we have work to do and callback is passed
    print(f"[evaluate] df.shape={df.shape}, total_units={total_units}, has_callback={progress_callback is not None}", flush=True)

    # Process rows in parallel using ThreadPoolExecutor
    # progress_callback is called per column inside process_row for more frequent updates
    max_workers = 2
    results_gemini = []
    results_gpt4 = []
    tokens_ls = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(process_row, idx, df.iloc[idx], steps, model_name, progress_callback): idx
            for idx in range(df.shape[0])
        }

        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result()
                results_gemini.append(result[0])
                # Handle None GPT-4 results since evaluation is commented out
                gpt4_result = result[1]
                if gpt4_result is not None:
                    results_gpt4.append(gpt4_result)
                tokens_ls.append(result[2])
            except Exception:
                pass

    # Convert results to DataFrames

    results_df_gemini = pd.DataFrame(results_gemini)
    # Create empty DataFrame for GPT-4 since evaluation is commented out

    # Generate Excel report
    excel_file = dataframe_to_excel(df, results_df_gemini, steps)

    return excel_file, tokens_ls
