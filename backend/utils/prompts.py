import pandas as pd
import google.generativeai as genai
import typing_extensions as typing
import json


class BaseClass(typing.TypedDict):
    type: list[str]
    response: str


def baseline_prompt(prompt, key_g):
    system_prompt = f"""
        You are an AI assistant that is able to generate a response to a given prompt.
"""
    # print('prompt', prompt)
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
    start = 2
    if 'problem or task representation' not in df.columns:
        start = 1
    # print(df)
    for row in range(df.shape[0]):
        for col in range(start, df.shape[1]):
            # print(df)
            # print(col)
            # print(df.columns[col])
            label = prompt[0]['user']['steps'][df.columns[col]]
            # print(label)
            llm_prompt = (
                f"Step {str.upper(df.columns[col])}: {label} Please respond with ONLY the {df.columns[col]} step and absolutely no additional text or explanation."
            )
            print('prompt', llm_prompt)
            print('label', label)
            genai.configure(api_key=key_g)
            model = genai.GenerativeModel("gemini-1.5-flash",
                                          system_instruction=system_prompt)
            response = model.generate_content(llm_prompt,
                                              generation_config=genai.types.GenerationConfig(
                                                  temperature=1.0, response_mime_type="application/json", response_schema=BaseClass))
            # print('response', response)
            try:
                json_response = json.loads(
                    response._result.candidates[0].content.parts[0].text)
                df.iloc[row, col] = json_response['response']
            except:
                print('error')
    return df
