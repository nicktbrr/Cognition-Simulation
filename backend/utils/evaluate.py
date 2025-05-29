import pandas as pd
import google.generativeai as genai
import typing_extensions as typing
import json
from pydantic import BaseModel
import concurrent.futures
import os
import openai
from datetime import datetime

class EvaluationMetricsGPT4(BaseModel):
    metric: list[str]
    score: list[float]


class EvaluationMetrics(typing.TypedDict):
    metric: list[str]
    score: list[float]


def dataframe_to_excel(df_response, df_gpt4, df_gemini):
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    fn = f'multiple_sheets_{timestamp}.xlsx'

    metric_dataframes = create_metric_dataframes(df_response, df_gpt4, df_gemini)

    with pd.ExcelWriter(fn, engine='openpyxl') as writer:
        df_response.to_excel(writer, sheet_name='Response', index=False)
        for metric, df in metric_dataframes.items():
            df.to_excel(writer, sheet_name=metric, index=False)
    
    return fn


def create_metric_dataframes(df_response, df_gpt4, df_gemini):
    """
    Creates separate dataframes for each metric where columns are the first n columns
    of df_response with either 'gemini' or 'gpt' appended.
    
    Args:
        df_response: Original response dataframe
        df_gpt4: GPT4 evaluation results
        df_gemini: Gemini evaluation results
        
    Returns:
        Dictionary of dataframes, one for each metric
    """
    # Get the first n columns from df_response (excluding the last column)
    response_cols = df_response.columns[:-1]
    
    # Create a dictionary to store metric-specific dataframes
    metric_dfs = {}
    
    # Get all metrics (excluding GPT4 prefix)
    metrics = [col for col in df_gemini.columns if not col.startswith('GPT4_')]
    
    for metric in metrics:
        # Create new dataframe for this metric
        metric_df = pd.DataFrame()
        
        # Add columns for each response column
        for idx, col in enumerate(response_cols):
            # Get the corresponding scores from both models
            gemini_scores = df_gemini[metric].apply(lambda x: x[idx] if isinstance(x, list) else x)
            gpt_scores = df_gpt4[f'GPT4_{metric}'].apply(lambda x: x[idx] if isinstance(x, list) else x)
            
            # Add columns with appropriate names
            metric_df[f'{col}_gemini'] = gemini_scores
            metric_df[f'{col}_gpt'] = gpt_scores
        
        metric_dfs[metric] = metric_df
    
    return metric_dfs


def process_row(row_idx, df_row, system_prompt, metrics_to_evaluate):
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
    row_scores.update({m: [] for m in metrics_to_evaluate})
    # Determine start column based on whether 'seed' is in the columns

    row_scores_gpt4 = {
        "GPT4_Clarity": [],
        "GPT4_Feasibility": [],
        "GPT4_Importance": [],
        "GPT4_Novelty": [],
        "GPT4_Fairness": [],
        "GPT4_Quality": [],
        "GPT4_Usefulness": []
    }

    row_scores_gpt4.update({f"GPT4_{m}": [] for m in metrics_to_evaluate})
    start_col = 1 if 'seed' in df_row.index else 0

    for col in range(start_col, len(df_row) - 1):
        try:
            model = genai.GenerativeModel(
                "gemini-2.0-flash", system_instruction=system_prompt)

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

            for idx, metric in enumerate(row_scores.keys()):
                if idx >= len(json_response['score']):
                    row_scores[metric].append('Poorly Defined Critiria')
                else:
                    row_scores[metric].append(json_response["score"][idx])

            client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            response = client.responses.parse(
                model="gpt-4o-mini",
                input=[{"role": "system", "content": system_prompt}, {"role": "user", "content": df_row.iloc[col]}],
                text_format=EvaluationMetricsGPT4,
                temperature=1.0
            )
            for idx, metric in enumerate(row_scores_gpt4.keys()):
                if idx >= len(response.output_parsed.metric):
                    row_scores_gpt4[metric].append('Poorly Defined Critiria')
                else:
                    row_scores_gpt4[metric].append(response.output_parsed.score[idx])

        except Exception as e:
            print(
                f"Error processing row {row_idx}, column {df_row.index[col]}: {e}")
            for metric in row_scores.keys():
                row_scores[metric].append(0)  # Handle failures gracefully
            for metric in row_scores_gpt4.keys():
                row_scores_gpt4[metric].append(0)

    print(f"Finished processing row {row_idx}")
    print(row_scores)
    return row_scores, row_scores_gpt4


def evaluate(df, key_g, metrics):
    """
    Evaluates multiple rows in parallel using threading and combines the results into a DataFrame.
    """
    # Configure `genai` globally
    genai.configure(api_key=key_g)
    metrics_set = {"Clarity", "Feasibility", "Importance",
                   "Novelty", "Fairness", "Quality", "Usefulness"}
    metric_name = set([m["name"] for m in metrics])
    metric_description = {m["name"]: m["description"] for m in metrics}

    metrics_to_evaluate = metric_name - metrics_set

    criteria = ""
    criteria_description = ""
    for i, m in enumerate(metrics_to_evaluate):
        criteria_description += f"{i+8}. {m}: {metric_description[m]}\n"
        criteria += f"{i+8}. {m}\n"

    system_prompt = f"""
        # Instruction
        You are an expert evaluator. Your task is to evaluate the quality of the responses generated by AI models.
        We will provide you with the user input and an AI-generated response.
        You should first read the user input carefully for analyzing the task, and then evaluate the quality of the responses based on the Criteria provided in the Evaluation section below.
        You will assign the response a score (1-10) for each criterion following the Evaluation Steps. Provide clear reasoning for each score.

        # Evaluation
        ## Metric Definition
        You will be assessing summarization quality, which measures the overall ability to summarize text.

        ## Criteria
        You will evaluate the summary on the following dimensions:
        1. Clarity: the degree to which something has fewer possible interpretations.
        2. Feasibility: the degree to which something is solvable, attainable, viable, or achievable.
        3. Importance: the degree to which something is valuable, useful, or meaningful.
        4. Novelty: the degree to which something is novel, original, or distinct.
        5. Fairness: the degree to which something is free from bias, favoritism, or injustice.
        6. Quality: the degree to which the content is communicated more effectively.
        7. Usefulness: the degree to which something is useful, helpful, or valuable.
        {criteria_description}

        ## Scoring Rubric (1-10 Scale)
        10 - Exceptional: Perfectly meets the criterion in every way.
        9 - Excellent: Nearly perfect with only minor issues.
        8 - Very Good: Strong performance with a few limitations.
        7 - Good: Competent with some notable issues.
        6 - Fair: Understandable but shows clear room for improvement.
        5 - Adequate: Meets the minimum requirement, but barely.
        4 - Weak: Substantially lacking in quality or completeness.
        3 - Poor: Serious problems with coherence or relevance.
        2 - Very Poor: Barely fulfills the criterion, if at all.
        1 - Unacceptable: Fails entirely to meet the criterion.

        ## Evaluation Steps
        For each criterion, follow these two steps:

        STEP 1: Analyze how well the response meets the criterion.
        - Provide a brief explanation that considers both the user input and the generated response.
        - Identify strengths and weaknesses based on the criterion.

        STEP 2: Assign a score from 1-10.
        - Justify the score clearly and concisely based on the analysis from STEP 1.

        Repeat this process for each of the following criteria:
        1. Clarity
        2. Feasibility
        3. Importance
        4. Novelty
        5. Fairness
        6. Quality
        7. Usefulness
        {criteria}

        At the end, you will present a table or list with each criterion and its corresponding score.
"""
    
    max_workers = 2
    results_gemini = []
    results_gpt4 = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(
            process_row, idx, df.iloc[idx], system_prompt, metrics_to_evaluate): idx for idx in range(df.shape[0])}

        for future in concurrent.futures.as_completed(futures):
            try:
                results_gemini.append(future.result()[0])
                results_gpt4.append(future.result()[1])
            except Exception as e:
                print(f"Error in thread execution: {e}")

    # Convert results into a DataFrame
    print('gemini results', results_gemini)
    print('gpt4 results', results_gpt4)

    results_df_gemini = pd.DataFrame(results_gemini)
    results_df_gpt4 = pd.DataFrame(results_gpt4)
    print('results_df_gemini', results_df_gemini)
    print('results_df_gpt4', results_df_gpt4)
    results_df = pd.concat([results_df_gemini, results_df_gpt4], axis=1)

    print('results_df', results_df)

    excel_file = dataframe_to_excel(df, results_df_gpt4, results_df_gemini)

    return excel_file
