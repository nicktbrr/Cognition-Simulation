import pandas as pd
import google.generativeai as genai
import typing_extensions as typing
import json
import concurrent.futures


class BaseClass(typing.TypedDict):
    type: list[str]
    response: str


def process_row(row_idx, df, prompt, key_g, system_prompt):
    """
    Processes a single row by generating responses for each column.
    Returns a dictionary of responses for this row.
    """
    row_data = {'seed': df.iloc[row_idx]['seed']}

    for col in range(1, df.shape[1]):
        label = prompt[0]['user']['steps'][df.columns[col]]

        if col == 1:
            llm_prompt = (f"""You are participating in an interview that aims to {df.iloc[row_idx]['seed']}.
                        First, provide an answer to this question: {str.upper(df.columns[col])}. We will call your answer to this question, "step_answer".
                        Please respond with ONLY the question and absolutely no additional text or explanation. The structure should include the following fields:
                        {label}: answer_text. (string, your response to the question, plain text only)""")
        else:
            previous_col = df.columns[col-1]
            previous_response = row_data[previous_col]
            llm_prompt = (f"""Given the previous step '{previous_col}' with response: '{previous_response}'
                        Provide an answer to this question: {str.upper(df.columns[col])}. We will call your answer to this question, "step_answer".
                        Please respond with ONLY the question and absolutely no additional text or explanation. The structure should include the following fields:
                        {label}: answer_text. (string, your response to the question, plain text only)""")


        # Configure the AI model
        genai.configure(api_key=key_g)
        model = genai.GenerativeModel(
            "gemini-1.5-flash", system_instruction=system_prompt)

        response = model.generate_content(llm_prompt,
                                          generation_config=genai.types.GenerationConfig(
                                              temperature=1.0,
                                              response_mime_type="application/json",
                                              response_schema=BaseClass))

        try:
            json_response = json.loads(
                response._result.candidates[0].content.parts[0].text)
            row_data[df.columns[col]] = json_response['response']
            # print(json_response)
        except Exception as e:
            print(
                f'Error processing row {row_idx}, column {df.columns[col]}: {e}')
            row_data[df.columns[col]] = None  # Handle failures gracefully
    print('finished row')
    return row_data


def baseline_prompt(prompt, key_g):
    """
    Processes multiple rows in parallel using threading and combines the results into a DataFrame.
    """
    system_prompt = """
        You are an AI participating in an interview-style interaction. Your task is to generate concise and structured responses based on a given question. 
        Do not use any newline characters or separate your answer with new lines. Provide the response in plain text format as a single continuous sentence.
        """

    seed = prompt[0]['user']['seed']
    cols = list(prompt[0]['user']['steps'].keys())
    cols.insert(0, "seed")
    df = pd.DataFrame(columns=cols)

    for i in range(prompt[0]['user']['iters']):
        if 'problem or task representation' not in cols:
            new_row = pd.DataFrame([{'seed': seed}])
        else:
            new_row = pd.DataFrame(
                [{'seed': seed, 'problem or task representation': seed}])
        df = pd.concat([df, new_row], ignore_index=True)

    # Process rows in parallel using ThreadPoolExecutor
    results = []
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {executor.submit(process_row, row_idx, df, prompt, key_g,
                                   system_prompt): row_idx for row_idx in range(df.shape[0])}

        for future in concurrent.futures.as_completed(futures):
            try:
                results.append(future.result())
            except Exception as e:
                print(f'Error in thread execution: {e}')

    # Convert results back into a DataFrame
    final_df = pd.DataFrame(results)

    return final_df


