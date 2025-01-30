import pandas as pd
import google.generativeai as genai
import typing_extensions as typing
import json
import numpy as np


class EvaluationMetrics(typing.TypedDict):
    type: list[str]
    metric: list[str]
    score: list[float]


def evaluate(df, key_g):
    metrics_df = pd.DataFrame([[[] for _ in range(6)] for _ in range(10)],
                              columns=['Clarity', 'Feasibility', 'Importance', 'Uniqueness', 'Fairness', 'Quality'])
    for row in range(df.shape[0]):
        for col in range(1, df.shape[1]):
            system_prompt = f"""The metrics to include in the system prompt:
                Return responses with no newline characters, \\n. Always end on just a period.
                When asked, you may evaluate your responses based on the following six metrics, rating each on a scale from 0 to 10: 
                Clarity: the degree to which something has fewer possible interpretations. 
                Feasibility: the degree to which something is solvable, attainable, viable, or achievable. 
                Importance: the degree to which something is valuable, useful, or meaningful. 
                Uniqueness: the degree to which something is novel, original, or distinct. 
                Fairness: the degree to which something is free from bias, favoritism, or injustice.
                Quality: the degree to which the content is communicated more effectively. 
            """

            genai.configure(api_key=key_g)
            model = genai.GenerativeModel("gemini-1.5-flash",
                                          system_instruction=system_prompt)
            response = model.generate_content(df.iloc[row, col],
                                              generation_config=genai.types.GenerationConfig(
                                                  temperature=1.0, response_mime_type="application/json", response_schema=EvaluationMetrics))
            print('response', response)
            json_response = None
            try:
                json_response = json.loads(
                    response._result.candidates[0].content.parts[0].text)
                print(json_response)
                for col in range(metrics_df.shape[1]):
                    metrics_df.iloc[row, col].append(
                        json_response['score'][col])
            except:
                print('error')

    return pd.concat([df, metrics_df], axis=1)
