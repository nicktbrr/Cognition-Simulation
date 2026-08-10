"""
Runs a simulation: routes each persona down its own path through the step graph
and collects an LLM response for every step on that path.

This module holds the run mechanics only. The prompt text it sends lives in
utils/prompts.py alongside every other prompt in the backend.
"""

import pandas as pd
import json
import concurrent.futures
import random

from langchain_core.messages import SystemMessage, HumanMessage

from .llm import invoke_structured, BaseResponse
from .graph import assign_persona_paths
from .personas import personas
from .prompts import (
    BASELINE_SYSTEM_PROMPT,
    get_baseline_persona_preamble,
    get_baseline_first_column_user_prompt,
    get_baseline_subsequent_column_user_prompt
)


def resolve_temperature(value, default=0.5):
    """
    Return a step's temperature as a 0-1 fraction.

    Steps are saved as a fraction (the editor's 1-100 slider is divided by 100
    before storage), so the value is used as-is. Anything above 1 is read as a
    step that was saved on the raw slider scale.
    """
    try:
        temperature = float(value)
    except (TypeError, ValueError):
        return default

    if temperature != temperature:  # NaN
        return default
    if temperature > 1.0:
        temperature = temperature / 100.0

    return max(0.0, min(1.0, temperature))


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


def process_row_with_chat(row_idx, df, prompt, model_name, system_prompt, persona,
                          path_step_ids=None, steps_by_id=None, study_introduction=""):
    """
    Process a single row of data using the Gemini AI model with chat-based interaction.

    Under a branching design each persona travels exactly one path through the
    graph, so this only runs the steps on that persona's path. Columns for
    steps the persona never reached are left blank.

    Args:
        row_idx (int): Index of the row to process
        df (pd.DataFrame): DataFrame containing the data to process
        prompt (list): List containing prompt configuration and steps
        model_name (str): LLM model identifier (e.g. "gemini-2.0-flash")
        system_prompt (str): System-level instructions for the AI model
        persona (dict or str): The persona to use for this row (can be dict or string)
        path_step_ids (list): Ids of the steps this persona travels, in order
        steps_by_id (dict): Step id -> step dict
        study_introduction (str): Participant-facing study introduction, stated
            once in the first prompt and carried through the rest of the path

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
    else:
        row_data = {}

    # Every step column starts blank; only the ones on this persona's path are
    # filled in. Blank cells are what tell the Excel report and the analysis
    # page that this persona was routed down a different branch.
    for col_name in df.columns:
        if col_name != 'seed':
            row_data[col_name] = ""

    steps_by_id = steps_by_id or {}
    path_step_ids = path_step_ids or []

    # The persona and the study introduction open every step's prompt: the model
    # is called statelessly per step, so it only knows what each prompt carries.
    preamble = get_baseline_persona_preamble(persona_str, study_introduction)

    # Every step this persona has already answered, in the order it answered
    # them. Replayed in full on each later step so the next answer is
    # conditional on this persona's own run rather than the instructions alone.
    path_history = []

    # Initialize token usage tracking
    tokens_dict = {
        'prompt_tokens': 0,
        'response_tokens': 0,
        'total_tokens': 0
    }

    # Walk this persona's own path through the graph
    for step_id in path_step_ids:
        matching_step = steps_by_id.get(step_id)
        if not matching_step:
            continue

        col_name = matching_step['label']
        instructions = matching_step['instructions']
        temperature = resolve_temperature(matching_step.get('temperature'))

        # The first step on the path has no history to condition on; every step
        # after it replays the parent steps this persona actually went through.
        if not path_history:
            llm_prompt = get_baseline_first_column_user_prompt(
                persona_str, col_name, instructions, study_introduction
            )
        else:
            llm_prompt = get_baseline_subsequent_column_user_prompt(
                preamble,
                path_history,
                col_name,
                instructions
            )

        # Invoke the LLM with structured output via LangChain
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=llm_prompt),
        ]
        parsed, usage = invoke_structured(
            model_name, BaseResponse, messages, temperature=temperature
        )

        # Track token usage
        tokens_dict['prompt_tokens'] += usage['input_tokens']
        tokens_dict['response_tokens'] += usage['output_tokens']
        tokens_dict['total_tokens'] += usage['total_tokens']

        # Process the response
        if parsed is not None:
            response = parsed.response
        else:
            response = "Error processing row ignore in simulation"

        row_data[col_name] = response
        path_history.append({
            'label': col_name,
            'instructions': instructions,
            'response': response,
        })

    # Add persona information to the row data (store the original persona, not the string version)
    row_data['persona'] = persona

    return row_data, tokens_dict


def baseline_prompt(prompt, model_name, sample=None, progress_callback=None,
                    parents=None, children=None):
    """
    Process multiple rows in parallel using threading and combine results into a DataFrame.

    Args:
        prompt (list): List containing prompt configuration including seed, steps, and iterations
        model_name (str): LLM model identifier (e.g. "gemini-2.0-flash")
        sample (dict): Sample data containing persona array (list of 10 persona dicts)
        progress_callback (callable, optional): Called after each row completes for progress tracking
        parents (dict): Step id -> parent ids, from normalize_graph
        children (dict): Step id -> child ids, from normalize_graph

    Returns:
        tuple: (final_df, tokens_ls) where:
            - final_df (pd.DataFrame): DataFrame containing all processed responses
            - tokens_ls (list): List of token usage dictionaries for each row
    """
    # System-level instructions for the AI model
    system_prompt = BASELINE_SYSTEM_PROMPT

    seed = prompt['seed']
    iterations = prompt['iters']
    # The researcher's setup for the participant. The steps refer back to it,
    # so it has to reach the model or they ask about material nobody was given.
    # Older records store it under 'introduction', as the loader on the
    # simulation page also allows for.
    study_introduction = prompt.get('study_introduction') or prompt.get('introduction') or ''

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

    # Steps arrive already normalized and topologically ordered, so array order
    # still defines column order.
    steps = prompt['steps']
    step_parents = parents or {}
    step_children = children or {}

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

    # Route each persona down its own path through the branching graph.
    step_lookup = {step['id']: step for step in steps}
    persona_paths = assign_persona_paths(steps, step_parents, step_children, iterations)

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
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {
            executor.submit(
                process_row_with_chat, row_idx, df, prompt, model_name, system_prompt,
                selected_personas[row_idx], persona_paths.get(row_idx, []), step_lookup,
                study_introduction
            ): row_idx
            for row_idx in range(df.shape[0])
        }
        tokens_ls = []

        for future in concurrent.futures.as_completed(futures):
            try:
                row_data, tokens_dict = future.result()
                results.append(row_data)
                tokens_ls.append(tokens_dict)
                if progress_callback:
                    progress_callback()
            except Exception:
                pass

    # Convert results to DataFrame
    final_df = pd.DataFrame(results)
    
    # Reorder columns to make persona the first column
    if 'persona' in final_df.columns:
        cols = ['persona'] + [col for col in final_df.columns if col != 'persona']
        final_df = final_df[cols]

    return final_df, tokens_ls
