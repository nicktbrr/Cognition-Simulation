import pandas as pd
import google.generativeai as genai
import typing_extensions as typing
import json
import concurrent.futures
import os


class EvaluationMetrics(typing.TypedDict):
    metric: list[str]
    score: list[float]


def process_row(row_idx, df_row, system_prompt):
    """
    Processes a single row by evaluating responses using the AI model.
    Returns a dictionary with scores for each metric.
    """
    row_scores = {
        "Clarity": [],
        "Feasibility": [],
        "Importance": [],
        "Uniqueness": [],
        "Fairness": [],
        "Quality": []
    }

    for col in range(1, len(df_row)):
        try:
            model = genai.GenerativeModel(
                "gemini-1.5-flash", system_instruction=system_prompt)

            response = model.generate_content(
                df_row.iloc[col],  # Input text
                generation_config=genai.types.GenerationConfig(
                    temperature=1.0,
                    response_mime_type="application/json",
                    response_schema=EvaluationMetrics
                )
            )

            # Parse JSON response
            json_response = json.loads(
                response._result.candidates[0].content.parts[0].text)

            # Store scores in the dictionary
            for idx, metric in enumerate(row_scores.keys()):
                row_scores[metric].append(json_response["score"][idx])

        except Exception as e:
            print(
                f"Error processing row {row_idx}, column {df_row.index[col]}: {e}")
            print(json_response)
            for metric in row_scores.keys():
                row_scores[metric].append(None)  # Handle failures gracefully

    print(f"Finished processing row {row_idx}")
    return row_scores


def evaluate(df, key_g):
    """
    Evaluates multiple rows in parallel using threading and combines the results into a DataFrame.
    """
    # ✅ FIX 1: Configure `genai` globally instead of inside each thread
    genai.configure(api_key=key_g)

    system_prompt = """
        The metrics to include in the system prompt:
        Return responses with no newline characters, \\n. Always end on just a period.
        When asked, you may evaluate your responses based on the following six metrics, rating each on a scale from 0 to 10:
        Clarity: the degree to which something has fewer possible interpretations.
        Feasibility: the degree to which something is solvable, attainable, viable, or achievable.
        Importance: the degree to which something is valuable, useful, or meaningful.
        Uniqueness: the degree to which something is novel, original, or distinct.
        Fairness: the degree to which something is free from bias, favoritism, or injustice.
        Quality: the degree to which the content is communicated more effectively.
    """

    # ✅ FIX 2: Limit `max_workers=2` for Cloud Run (since Cloud Run has 2 CPUs)
    max_workers = 2  # Set explicitly to prevent excessive threading
    results = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(
            process_row, idx, df.iloc[idx], system_prompt): idx for idx in range(df.shape[0])}

        for future in concurrent.futures.as_completed(futures):
            try:
                results.append(future.result())
            except Exception as e:
                print(f"Error in thread execution: {e}")

    # Convert results into a DataFrame and merge with original DataFrame
    return pd.concat([df, pd.DataFrame(results)], axis=1)


# import pandas as pd
# import google.generativeai as genai
# import typing_extensions as typing
# import json
# import numpy as np


# class EvaluationMetrics(typing.TypedDict):
#     type: list[str]
#     metric: list[str]
#     score: list[float]


# def evaluate(df, key_g):
#     metrics_df = pd.DataFrame([[[] for _ in range(6)] for _ in range(10)],
#                               columns=['Clarity', 'Feasibility', 'Importance', 'Uniqueness', 'Fairness', 'Quality'])
#     for row in range(df.shape[0]):
#         for col in range(1, df.shape[1]):
#             system_prompt = f"""The metrics to include in the system prompt:
#                 Return responses with no newline characters, \\n. Always end on just a period.
#                 When asked, you may evaluate your responses based on the following six metrics, rating each on a scale from 0 to 10:
#                 Clarity: the degree to which something has fewer possible interpretations.
#                 Feasibility: the degree to which something is solvable, attainable, viable, or achievable.
#                 Importance: the degree to which something is valuable, useful, or meaningful.
#                 Uniqueness: the degree to which something is novel, original, or distinct.
#                 Fairness: the degree to which something is free from bias, favoritism, or injustice.
#                 Quality: the degree to which the content is communicated more effectively.
#             """

#             genai.configure(api_key=key_g)
#             model = genai.GenerativeModel("gemini-1.5-flash",
#                                           system_instruction=system_prompt)
#             response = model.generate_content(df.iloc[row, col],
#                                               generation_config=genai.types.GenerationConfig(
#                                                   temperature=1.0, response_mime_type="application/json", response_schema=EvaluationMetrics))
#             print('response', response)
#             json_response = None
#             try:
#                 json_response = json.loads(
#                     response._result.candidates[0].content.parts[0].text)
#                 print(json_response)
#                 for col in range(metrics_df.shape[1]):
#                     metrics_df.iloc[row, col].append(
#                         json_response['score'][col])
#             except:
#                 print('error')

#     return pd.concat([df, metrics_df], axis=1)
