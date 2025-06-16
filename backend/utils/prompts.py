import pandas as pd
import google.generativeai as genai
# from google import genai
import typing_extensions as typing
import json
import concurrent.futures

import random

def random_persona_generator():
    personas = [
        'a high school student at a college prep school who is in the top 1% of the class',
        'a highschool student who is navigating their life goals and interests',
        'an elementary school teacher in Utah',
        'a professor of entrepreneurship and innovation at a university in California',
        'a professor of fine arts at a small community college in Massachusetts'
    ]
    
    while True:
        yield random.choice(personas)


class BaseClass(typing.TypedDict, total=False):
    type: list[str]
    response: str


def process_row_with_chat(row_idx, df, prompt, key_g, system_prompt):
    if "seed" in df.columns:
        row_data = {'seed': df.iloc[row_idx]['seed']}
        seed_value = df.iloc[row_idx]['seed']
    else:
        row_data = {}
        seed_value = "no-seed"  # Default value when seed is not included

    # Get the steps array from the prompt
    steps = prompt[0]['user']['steps']

    prompt_list = []

    tokens_dict = {
        'prompt_tokens': 0,
        'response_tokens': 0,
        'total_tokens': 0
    }

    # Start from appropriate column index based on whether seed is in columns

    persona = next(random_persona_generator())

    for col_idx in range(0, df.shape[1]):
        col_name = df.columns[col_idx]


        # Find the matching step by label
        matching_step = next(
            (step for step in steps if step['label'] == col_name), None)

        if matching_step:
            instructions = matching_step['instructions']
            temperature = matching_step['temperature']

            # First column after seed (or first column if no seed)
            if col_idx == 0:
                llm_prompt = f"""You are {persona}, participating in a psychology study on cognitive processes. 
                Your task is to generate concise and structured responses for a step in the process, which is based on instructions from a researcher and may build on previous steps and responses.
                Use judgement that is highly critical, focusing on direct and well-established semantic links, and disregard superficial or weak connections.
                Please respond with ONLY the response and absolutely no additional text or explanation. Do not use any newline characters or separate your answer with new lines.
                Provide the response in plain text format as a single continuous paragraph.

                The current step is: {str.upper(col_name)}
                Please respond to the following: {instructions}

                Please respond with ONLY the question and absolutely no additional text or explanation."""
# """
                prompt_list.append(llm_prompt)
#                 llm_prompt = (f"""You are participating in an interview.
#                     The current step is: {str.upper(col_name)}
#                     Please respond to the following: {instructions}

#                     Please respond with ONLY the question and absolutely no additional text or explanation. The structure should include the following fields:
#                     answer_text. (string, your response to the question, plain text only""")
            else:
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

            # Configure the AI model
            genai.configure(api_key=key_g)
            model = genai.GenerativeModel(
                "gemini-2.0-flash", system_instruction=system_prompt)

            response = model.generate_content(llm_prompt,
                                              generation_config=genai.types.GenerationConfig(
                                                  temperature=temperature/100.0,
                                                  response_mime_type="application/json",
                                                  response_schema=BaseClass))
            
            tokens_dict['prompt_tokens'] += response.usage_metadata.prompt_token_count
            tokens_dict['response_tokens'] += response.usage_metadata.candidates_token_count
            tokens_dict['total_tokens'] += response.usage_metadata.total_token_count
            try:
                json_response = json.loads(
                    response._result.candidates[0].content.parts[0].text)
                row_data[col_name] = json_response['response']

                # print(json_response)
            except Exception as e:
                print(
                    f'Error processing row {row_idx}, column {col_name}: {e}')
                # Handle failures gracefully
                row_data[col_name] = "Error processing row ignore in simulation"
        else:
            print(f"Warning: No matching step found for column {col_name}")
            row_data[col_name] = "No matching instructions found"
    row_data['persona'] = persona

    print('tokens_dict', tokens_dict)

    print('finished row')

    return row_data, tokens_dict


def baseline_prompt(prompt, key_g):
    """
    Processes multiple rows in parallel using threading and combines the results into a DataFrame.
    """
    system_prompt = """
        You are an AI participating in an interview-style interaction. Your task is to generate concise and structured responses based on a given question.
        Do not use any newline characters or separate your answer with new lines. Provide the response in plain text format as a single continuous sentence.
        """

    print('prompt', prompt[0])
    seed = prompt[0]['user']['seed']

    # Extract labels from the steps array
    steps = prompt[0]['user']['steps']
    cols = [step['label'] for step in steps]

    # Check if seed should be included in columns
    if seed != "no-seed":
        cols.insert(0, "seed")

    df = pd.DataFrame(columns=cols)

    for i in range(prompt[0]['user']['iters']):
        # Create a new row based on whether seed should be included
        if seed != "no-seed":
            # Initialize with seed
            new_row = {'seed': seed}

            # Add special case for "problem or task representation" if it exists
            for col in cols:
                if col == "problem or task representation":
                    new_row[col] = seed
        else:
            # No seed case - just create an empty dict
            new_row = {}

        # Add the new row to the dataframe
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

    # Process rows in parallel using ThreadPoolExecutor
    results = []
    # with concurrent.futures.ThreadPoolExecutor() as executor:
    #     futures = {executor.submit(process_row, row_idx, df, prompt, key_g,
    #                                system_prompt): row_idx for row_idx in range(df.shape[0])}

    #     for future in concurrent.futures.as_completed(futures):
    #         try:
    #             results.append(future.result())
    #         except Exception as e:
    #             print(f'Error in thread execution: {e}')

    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {executor.submit(process_row_with_chat, row_idx, df, prompt, key_g, system_prompt): row_idx for row_idx in range(df.shape[0])}
        tokens_ls = []

        for future in concurrent.futures.as_completed(futures):
            try:
                row_data, tokens_dict = future.result()
                results.append(row_data)
                tokens_ls.append(tokens_dict)
            except Exception as e:
                print(f'Error in thread execution: {e}')

    # Convert results back into a DataFrame
    final_df = pd.DataFrame(results)

    print('tokens_ls', tokens_ls)

    return final_df, tokens_ls
