# import pandas as pd
# import google.generativeai as genai
# import typing_extensions as typing
# import json
# import concurrent.futures
# import os


# class EvaluationMetrics(typing.TypedDict):
#     metric: list[str]
#     score: list[float]


# def process_row(row_idx, df_row, system_prompt):
#     """
#     Processes a single row by evaluating responses using the AI model.
#     Returns a dictionary with scores for each metric.
#     """
#     row_scores = {
#         "Clarity": [],
#         "Feasibility": [],
#         "Importance": [],
#         "Uniqueness": [],
#         "Fairness": [],
#         "Quality": []
#     }

#     for col in range(1, len(df_row)):
#         try:
#             model = genai.GenerativeModel(
#                 "gemini-1.5-flash", system_instruction=system_prompt)

#             response = model.generate_content(
#                 df_row.iloc[col],  # Input text
#                 generation_config=genai.types.GenerationConfig(
#                     temperature=1.0,
#                     response_mime_type="application/json",
#                     response_schema=EvaluationMetrics
#                 )
#             )

#             # Parse JSON response
#             json_response = json.loads(
#                 response._result.candidates[0].content.parts[0].text)

#             # Store scores in the dictionary
#             for idx, metric in enumerate(row_scores.keys()):
#                 row_scores[metric].append(json_response["score"][idx])

#         except Exception as e:
#             print(
#                 f"Error processing row {row_idx}, column {df_row.index[col]}: {e}")
#             print(json_response)
#             for metric in row_scores.keys():
#                 row_scores[metric].append(None)  # Handle failures gracefully

#     print(f"Finished processing row {row_idx}")
#     return row_scores


# def evaluate(df, key_g):
#     """
#     Evaluates multiple rows in parallel using threading and combines the results into a DataFrame.
#     """
#     # ✅ FIX 1: Configure `genai` globally instead of inside each thread
#     genai.configure(api_key=key_g)

#     system_prompt = """
#         The metrics to include in the system prompt:
#         Return responses with no newline characters, \\n. Always end on just a period.
#         When asked, you may evaluate your responses based on the following six metrics, rating each on a scale from 0 to 10:
#         Clarity: the degree to which something has fewer possible interpretations.
#         Feasibility: the degree to which something is solvable, attainable, viable, or achievable.
#         Importance: the degree to which something is valuable, useful, or meaningful.
#         Uniqueness: the degree to which something is novel, original, or distinct.
#         Fairness: the degree to which something is free from bias, favoritism, or injustice.
#         Quality: the degree to which the content is communicated more effectively.
#     """

#     # ✅ FIX 2: Limit `max_workers=2` for Cloud Run (since Cloud Run has 2 CPUs)
#     max_workers = 2  # Set explicitly to prevent excessive threading
#     results = []

#     with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
#         futures = {executor.submit(
#             process_row, idx, df.iloc[idx], system_prompt): idx for idx in range(df.shape[0])}

#         for future in concurrent.futures.as_completed(futures):
#             try:
#                 results.append(future.result())
#             except Exception as e:
#                 print(f"Error in thread execution: {e}")

#     # Convert results into a DataFrame and merge with original DataFrame
#     return pd.concat([df, pd.DataFrame(results)], axis=1)

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
        "Novelty": [],
        "Fairness": [],
        "Quality": [],
        "Usefulness": []
    }

    # Determine start column based on whether 'seed' is in the columns
    start_col = 1 if 'seed' in df_row.index else 0

    for col in range(start_col, len(df_row)):
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
            for metric in row_scores.keys():
                row_scores[metric].append(None)  # Handle failures gracefully

    print(f"Finished processing row {row_idx}")
    return row_scores


def evaluate(df, key_g):
    """
    Evaluates multiple rows in parallel using threading and combines the results into a DataFrame.
    """
    # Configure `genai` globally
    genai.configure(api_key=key_g)

    system_prompt = """
        The metrics to include in the system prompt:
        Return responses with no newline characters, \\n. Always end on just a period.
        When asked, you may evaluate your responses based on the following six metrics, rating each on a scale from 0 to 10:
        Clarity: the degree to which something has fewer possible interpretations.
        Feasibility: the degree to which something is solvable, attainable, viable, or achievable.
        Importance: the degree to which something is valuable, useful, or meaningful.
        Novelty: the degree to which something is novel, original, or distinct.
        Fairness: the degree to which something is free from bias, favoritism, or injustice.
        Quality: the degree to which the content is communicated more effectively.
        Usefulness: the degree to which something is useful, helpful, or valuable.
    """

    # Limit max_workers for Cloud Run
    max_workers = 2
    results = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(
            process_row, idx, df.iloc[idx], system_prompt): idx for idx in range(df.shape[0])}

        for future in concurrent.futures.as_completed(futures):
            try:
                results.append(future.result())
            except Exception as e:
                print(f"Error in thread execution: {e}")

    # Convert results into a DataFrame
    results_df = pd.DataFrame(results)

    # Determine column names for results DataFrame
    # Check if 'seed' is in the original DataFrame columns
    if 'seed' in df.columns:
        # For each metric, create one column for each non-seed column in original df
        all_columns = []
        metrics = ["Clarity", "Feasibility", "Importance",
                   "Uniqueness", "Fairness", "Quality"]
        data_columns = [col for col in df.columns if col != 'seed']

        for metric in metrics:
            # Create column names like "Clarity_column1", "Clarity_column2", etc.
            metric_columns = [f"{metric}_{col}" for col in data_columns]
            all_columns.extend(metric_columns)

        # Rename columns in results DataFrame
        results_df.columns = all_columns
    else:
        # If there's no seed column, just use default column names
        pass

    # Merge with original DataFrame
    final_df = pd.concat([df, results_df], axis=1)

    return final_df
