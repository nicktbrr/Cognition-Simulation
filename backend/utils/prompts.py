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

def random_persona_generator():
    """
    Generator function that yields random personas from the personas list.
    
    Yields:
        str: A randomly selected persona from the personas list.
    """
    while True:
        yield random.choice(personas)


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
        persona (str): The persona to use for this row
    
    Returns:
        tuple: (row_data, tokens_dict) where:
            - row_data (dict): Processed response data for the row
            - tokens_dict (dict): Token usage statistics
    """
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

            # Handle first column differently (initial prompt)
            if col_idx == 0:
                llm_prompt = f"""You are {persona}, participating in a psychology study on cognitive processes. 
                Your task is to generate concise and structured responses for a step in the process, which is based on instructions from a researcher and may build on previous steps and responses.
                Use judgement that is highly critical, focusing on direct and well-established semantic links, and disregard superficial or weak connections.
                Please respond with ONLY the response and absolutely no additional text or explanation. Do not use any newline characters or separate your answer with new lines.
                Provide the response in plain text format as a single continuous paragraph.

                The current step is: {str.upper(col_name)}
                Please respond to the following: {instructions}

                Please respond with ONLY the question and absolutely no additional text or explanation."""
                prompt_list.append(llm_prompt)
            else:
                # Build prompt including previous steps and responses
                llm_prompt = prompt_list[0]
                llm_prompt += "Given the previous steps with responses:"
                for i in range(col_idx):
                    llm_prompt += (f"""
                                  Prompt:{df.columns[i]}: {steps[i]['instructions']}
                                  Response:{row_data[df.columns[i]]}
                            """)
                llm_prompt += (f"""
                                The current step is: {str.upper(col_name)}
                                Please respond to the following: {instructions}

                            Please respond with ONLY the question and absolutely no additional text or explanation. The structure should include the following fields:
                            """)

            # Configure and call the AI model
            genai.configure(api_key=key_g)
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
    
    # Add persona information to the row data
    row_data['persona'] = persona

    return row_data, tokens_dict


def baseline_prompt(prompt, key_g, uuid=None, socketio=None):
    """
    Process multiple rows in parallel using threading and combine results into a DataFrame.
    
    Args:
        prompt (list): List containing prompt configuration including seed, steps, and iterations
        key_g (str): Google AI API key
        uuid (str): Unique identifier for progress tracking
        socketio: SocketIO instance for progress updates
    
    Returns:
        tuple: (final_df, tokens_ls) where:
            - final_df (pd.DataFrame): DataFrame containing all processed responses
            - tokens_ls (list): List of token usage dictionaries for each row
    """
    # System-level instructions for the AI model
    system_prompt = """
        You are an AI participating in an interview-style interaction. Your task is to generate concise and structured responses based on a given question.
        Do not use any newline characters or separate your answer with new lines. Provide the response in plain text format as a single continuous sentence.
        """

    seed = prompt['seed']
    iterations = prompt['iters']

    # Select unique personas for each row
    if len(personas) >= iterations:
        # Shuffle personas and take the first N unique ones
        selected_personas = random.sample(personas, iterations)
    else:
        # If we have fewer personas than iterations, repeat personas but ensure variety
        selected_personas = []
        while len(selected_personas) < iterations:
            remaining_personas = [p for p in personas if p not in selected_personas]
            if remaining_personas:
                selected_personas.extend(remaining_personas)
            else:
                # If we've used all personas, start over
                selected_personas.extend(random.sample(personas, min(len(personas), iterations - len(selected_personas))))

    # Extract labels from the steps array
    steps = prompt['steps']
    cols = [step['label'] for step in steps]

    # Add seed column if specified
    if seed != "no-seed":
        cols.insert(0, "seed")

    # Initialize DataFrame
    df = pd.DataFrame(columns=cols)

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
    total_rows = df.shape[0]
    completed_rows = 0
    
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {executor.submit(process_row_with_chat, row_idx, df, prompt, key_g, system_prompt, selected_personas[row_idx]): row_idx for row_idx in range(df.shape[0])}
        tokens_ls = []

        for future in concurrent.futures.as_completed(futures):
            try:
                row_data, tokens_dict = future.result()
                results.append(row_data)
                tokens_ls.append(tokens_dict)
                completed_rows += 1
                
                # Emit progress update
                if socketio and uuid:
                    progress = int(10 + (completed_rows / total_rows) * 40)  # 10-50% range
                    socketio.emit('update_progress', {
                        'progress': progress, 
                        'message': f'Processing row {completed_rows}/{total_rows}...'
                    }, room=uuid)
                    
            except Exception as e:
                print(f'Error in thread execution: {e}')
                completed_rows += 1

    # Convert results to DataFrame
    final_df = pd.DataFrame(results)
    
    # Reorder columns to make persona the first column
    if 'persona' in final_df.columns:
        cols = ['persona'] + [col for col in final_df.columns if col != 'persona']
        final_df = final_df[cols]

    return final_df, tokens_ls
