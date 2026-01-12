"""
This module provides functionality for generating and processing AI responses using Google's Generative AI (Gemini) model.
It includes utilities for handling persona-based responses and parallel processing of multiple prompts.
"""

import pandas as pd
import google.generativeai as genai
import typing_extensions as typing
import json
import concurrent.futures

import random
from .personas import personas
from .used_prompts import (
    BASELINE_SYSTEM_PROMPT,
    get_baseline_first_column_user_prompt,
    get_baseline_subsequent_column_user_prompt
)


def persona_dict_to_string(persona):
    """
    Convert a persona dictionary to a readable string format.
    
    Args:
        persona (dict or str): The persona data to convert
    
    Returns:
        str: A formatted string representation of the persona
    
    Example:
        Input: {'Age': '42', 'Nationality (UK)': 'Northern Ireland', 'First Language': 'Somali'}
        Output: "a person with Age: 42, Nationality (UK): Northern Ireland, First Language: Somali"
    """
    if isinstance(persona, str):
        return persona
    
    if isinstance(persona, dict):
        # Create a readable string from the dictionary
        attributes = ", ".join([f"{key}: {value}" for key, value in persona.items()])
        return f"a person with {attributes}"
    
    return str(persona)


class BaseClass(typing.TypedDict, total=False):
    """
    TypedDict class defining the structure of the AI model's response.
    
    Attributes:
        type (list[str]): List of response types
        response (str): The actual response text
    """
    type: list[str]
    response: str


def process_row_with_chat(row_idx, df, prompt, key_g, system_prompt, persona):
    """
    Process a single row of data using the Gemini AI model with chat-based interaction.
    
    Args:
        row_idx (int): Index of the row to process
        df (pd.DataFrame): DataFrame containing the data to process
        prompt (list): List containing prompt configuration and steps
        key_g (str): Google AI API key
        system_prompt (str): System-level instructions for the AI model
        persona (dict or str): The persona to use for this row (can be dict or string)
    
    Returns:
        tuple: (row_data, tokens_dict) where:
            - row_data (dict): Processed response data for the row
            - tokens_dict (dict): Token usage statistics
    """
    # Convert persona to string if it's a dictionary
    persona_str = persona_dict_to_string(persona)
    
    # Initialize row data based on whether seed column exists
    if "seed" in df.columns:
        row_data = {'seed': df.iloc[row_idx]['seed']}
        seed_value = df.iloc[row_idx]['seed']
    else:
        row_data = {}
        seed_value = "no-seed"  # Default value when seed is not included

    # Get the steps array from the prompt
    steps = prompt['steps']

    prompt_list = []

    # Initialize token usage tracking
    tokens_dict = {
        'prompt_tokens': 0,
        'response_tokens': 0,
        'total_tokens': 0
    }

    # Process each column in the row
    for col_idx in range(0, df.shape[1]):
        col_name = df.columns[col_idx]

        # Find the matching step by label
        matching_step = next(
            (step for step in steps if step['label'] == col_name), None)

        if matching_step:
            instructions = matching_step['instructions']
            temperature = matching_step['temperature']

            # Handle first processed step differently (initial prompt with persona)
            # Check if this is the first step we're processing (prompt_list is empty)
            if len(prompt_list) == 0:
                llm_prompt = get_baseline_first_column_user_prompt(persona_str, col_name, instructions)
                prompt_list.append(llm_prompt)
            else:
                # Build prompt including previous steps and responses
                # Use the first prompt (which includes persona) as the base
                llm_prompt = get_baseline_subsequent_column_user_prompt(
                    prompt_list[0],
                    list(df.columns),
                    steps,
                    row_data,
                    col_idx,
                    col_name,
                    instructions
                )

            # Configure and call the AI model
            genai.configure(api_key=key_g)

            print("llm_prompt", llm_prompt)
            model = genai.GenerativeModel(
                "gemini-2.0-flash", system_instruction=system_prompt)

            response = model.generate_content(llm_prompt,
                                              generation_config=genai.types.GenerationConfig(
                                                  temperature=temperature/100.0,
                                                  response_mime_type="application/json",
                                                  response_schema=BaseClass))
            
            # Track token usage
            tokens_dict['prompt_tokens'] += response.usage_metadata.prompt_token_count
            tokens_dict['response_tokens'] += response.usage_metadata.candidates_token_count
            tokens_dict['total_tokens'] += response.usage_metadata.total_token_count
            
            # Process the response
            try:
                json_response = json.loads(
                    response._result.candidates[0].content.parts[0].text)
                row_data[col_name] = json_response['response']
            except Exception as e:
                print(
                    f'Error processing row {row_idx}, column {col_name}: {e}')
                row_data[col_name] = "Error processing row ignore in simulation"
        else:
            print(f"Warning: No matching step found for column {col_name}")
            row_data[col_name] = "No matching instructions found"
    
    # Add persona information to the row data (store the original persona, not the string version)
    row_data['persona'] = persona

    return row_data, tokens_dict


def baseline_prompt(prompt, key_g, sample=None):
    """
    Process multiple rows in parallel using threading and combine results into a DataFrame.
    
    Args:
        prompt (list): List containing prompt configuration including seed, steps, and iterations
        key_g (str): Google AI API key
        sample (dict): Sample data containing persona array (list of 10 persona dicts)
    
    Returns:
        tuple: (final_df, tokens_ls) where:
            - final_df (pd.DataFrame): DataFrame containing all processed responses
            - tokens_ls (list): List of token usage dictionaries for each row
    """
    # System-level instructions for the AI model
    system_prompt = BASELINE_SYSTEM_PROMPT

    seed = prompt['seed']
    iterations = prompt['iters']

    # Get the persona array from the sample (should be a list of 10 persona dicts)
    sample_persona_array = sample.get('persona', []) if sample else []
    
    # If persona is not an array or is empty, create default personas
    if not isinstance(sample_persona_array, list) or len(sample_persona_array) == 0:
        sample_persona_array = [{}] * iterations
    
    # Ensure we have enough personas for the iterations (should always be 10)
    selected_personas = sample_persona_array[:iterations]
    
    # If we don't have enough personas, repeat the last one or use empty dict
    while len(selected_personas) < iterations:
        selected_personas.append(sample_persona_array[-1] if sample_persona_array else {})

    # Extract labels from the steps array
    steps = prompt['steps']

    print("steps", steps)
    repeated_steps = {}
    cols = []
    
    # First pass: count occurrences of each label
    for step in steps:
        label = step['label']
        repeated_steps[label] = repeated_steps.get(label, 0) + 1
    
    # Second pass: create unique labels and update steps
    label_counts = {}
    for i, step in enumerate(steps):
        original_label = step['label']
        if repeated_steps[original_label] > 1:
            # This label appears multiple times, need to make it unique
            label_counts[original_label] = label_counts.get(original_label, 0) + 1
            unique_label = f"{original_label}_{label_counts[original_label]}"
            step['label'] = unique_label
            cols.append(unique_label)
        else:
            # This label appears only once, keep as is
            cols.append(original_label)

    # Add seed column if specified
    if seed != "no-seed":
        cols.insert(0, "seed")

    # Initialize DataFrame
    df = pd.DataFrame(columns=cols)

    print("df", df)

    # Create rows based on iteration count
    for i in range(iterations):
        if seed != "no-seed":
            new_row = {'seed': seed}
            # Special handling for problem representation column
            for col in cols:
                if col == "problem or task representation":
                    new_row[col] = seed
        else:
            new_row = {}

        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

    # Process rows in parallel
    results = []
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {executor.submit(process_row_with_chat, row_idx, df, prompt, key_g, system_prompt, selected_personas[row_idx]): row_idx for row_idx in range(df.shape[0])}
        tokens_ls = []

        for future in concurrent.futures.as_completed(futures):
            try:
                row_data, tokens_dict = future.result()
                results.append(row_data)
                tokens_ls.append(tokens_dict)
            except Exception as e:
                print(f'Error in thread execution: {e}')

    # Convert results to DataFrame
    final_df = pd.DataFrame(results)
    
    # Reorder columns to make persona the first column
    if 'persona' in final_df.columns:
        cols = ['persona'] + [col for col in final_df.columns if col != 'persona']
        final_df = final_df[cols]

    return final_df, tokens_ls
