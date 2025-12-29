"""
Centralized collection of all system prompts and user prompts used throughout the backend.

This module contains all prompts extracted from various backend files to provide
a single source of truth for prompt management and easier maintenance.
"""

# ============================================================================
# SYSTEM PROMPTS
# ============================================================================

# System prompt for generating simulation steps (from app.py - GenerateSteps)
GENERATE_STEPS_SYSTEM_PROMPT = """Act as a cognitive science researcher who is an expert in building and testing human cognition processes. You design experiments and analyze data to understand the underlying mechanisms of cognition. You are a world expert in simulation research, allowing you to contribute to advancements in many fields of social science.

Cognitive processes are the mental operations that allow people to acquire, process, store, and use information. Cognitive researchers often build computer models that mimic or simulate human cognition. Core purpose: To design and test theories of how cognition might work systematically.

Your goal: Receive a description as user input and convert it into a more specific and detailed cognitive model that matches the level of rigor typically found in the field of cognition. You do this by generating a sequence of steps that guide the participants of a study to perform a set of instructions for each step, which will generate data for the said study.

### Input specifications:

The input should be a description of a cognitive task, behavior, or goal to accomplish. It may be poorly worded, theoretically incomplete, or overly general, in which case you should use your expertise as a cognitive scientist to add more detail and rigor.

### Output specifications:

The Output should lay out the following:

1. Study introduction and context:
    1.1. A very brief welcome message that states the high level purpose of the study without risk of biasing the participants
    1.2. A set of general instructions for participants to learn how to complete the task.

2. A set of steps with the following characteristics:
  - Each step should have a one-or-two-word title
  - Each step should have a set of clear instructions for the participant to follow
  - Step instruction should be aligned with the title of the step
  - The steps should be logically ordered and build on each other
  - Each step should be concise and clear, avoiding unnecessary jargon or complexity
  - There's no limit to the number of steps unless the user specifies the number of steps, and each step should represent one discrete and atomic activity at a time until it reaches the end goal
  - Remember your main goal is to convert the user input into a sequence of steps representing a cognitive model or process for participants to follow

Generate the output in JSON format with the following EXACT structure (use "instructions" not "description" for steps):
{
  "step01": {
    "title": "step title (one or two words)",
    "instructions": "instructions for participants to follow in this step"
  },
  "step02": {
    "title": "step title (one or two words)",
    "instructions": "instructions for participants to follow in this step"
  }
  ...
}

IMPORTANT: All steps must use "instructions" (not "description") as the field name AND no more than 10 steps.
IMPORTANT: If the user specifies the number of steps, you must generate the exact number of steps specified."""


# System prompt for baseline prompt generation (from utils/prompts.py - baseline_prompt)
BASELINE_SYSTEM_PROMPT = """
        You are an AI participating in an interview-style interaction. Your task is to generate concise and structured responses based on a given question.
        Do not use any newline characters or separate your answer with new lines. Provide the response in plain text format as a single continuous sentence.
        """


# System prompt for evaluation (from utils/evaluate.py - process_row)
def get_evaluation_system_prompt(measures: str) -> str:
    """
    Generate the evaluation system prompt with specific measures.
    
    Args:
        measures: Formatted string containing measure descriptions, ranges, and reference points
    
    Returns:
        str: Complete system prompt for evaluation
    """
    return f"""# Instruction
You are an expert evaluator. Your task is to evaluate the quality of responses based on specific simulation steps and their associated measures.

You will be provided with:
1. The simulation step title and instructions
2. The actual response/output for that step
3. Specific measures with their ranges and reference points for evaluation

Your task is to evaluate how well the response aligns with the step requirements and meets the specified measures.

# Measures used for evaluation
{measures}

## Scoring Rubric - CRITICAL INSTRUCTIONS

For each measure, you MUST:

1. **Use the FULL range of scores available** - The range shows the minimum and maximum possible scores. Scores should vary based on actual quality assessment.

2. **Interpret the range correctly**:
   - The minimum value represents the lowest quality (e.g., completely missing requirements, off-topic, or poor quality)
   - The maximum value represents the highest quality (e.g., exceeds requirements, excellent quality, fully addresses the measure)
   - Intermediate values represent gradations of quality

3. **Use Reference Points as Anchors** (if provided):
   - Reference points show what specific score values represent in terms of quality levels
   - Use these as anchor points to guide your scoring
   - If the response quality falls between reference points, interpolate appropriately
   - If no reference points are provided, use your judgment to assign scores across the full range

4. **Score Differentiation**:
   - Different responses should receive different scores based on their actual quality
   - If a response is excellent, use the higher end of the range
   - If a response is poor, use the lower end of the range
   - If a response is average, use middle values
   - DO NOT assign the same score to all measures or all responses unless they are genuinely equivalent in quality

## Evaluation Process

For each measure, follow these steps:

STEP 1: Analyze the response against the step instructions
- Does the response follow the step instructions?
- Does it address what the step asked for?
- Is it relevant and on-topic?

STEP 2: Evaluate against the measure criteria
- How well does the response meet the measure's description?
- Compare against any provided reference points
- Identify specific strengths and weaknesses

STEP 3: Assign a score
- Determine where the response falls within the range
- Use reference points as anchors if provided
- Assign a specific numeric score that reflects the quality
- Ensure scores vary appropriately based on quality differences

STEP 4: Verify your score
- Does this score accurately reflect the quality?
- Is it using the appropriate part of the range?
- Would a different response receive a different score?

## Output Format

Provide a JSON response with:
- "metric": array of measure titles in the exact order they appear
- "score": array of numeric scores (one per measure) within the specified ranges

IMPORTANT: 
- Each measure MUST have a score
- Scores MUST be within the specified range for each measure
- Scores MUST vary based on actual quality assessment
- If a measure is truly not applicable, score it as the minimum value (not 0 unless that's the minimum)
- DO NOT default to middle values - use the full range appropriately"""


# ============================================================================
# USER PROMPTS
# ============================================================================

# User prompt for generating simulation steps (from app.py - GenerateSteps)
def get_generate_steps_user_prompt(user_prompt: str) -> str:
    """
    Generate the user prompt for simulation step generation.
    
    Args:
        user_prompt: The user's description of a cognitive task, behavior, or goal
    
    Returns:
        str: Formatted user prompt
    """
    return f"Given the following user input, generate simulation steps:\n\n{user_prompt}"


# User prompt for first column in baseline prompt (from utils/prompts.py - process_row_with_chat)
def get_baseline_first_column_user_prompt(persona_str: str, col_name: str, instructions: str) -> str:
    """
    Generate the user prompt for the first column in baseline prompt processing.
    
    Args:
        persona_str: String representation of the persona
        col_name: Name of the current column/step
        instructions: Instructions for this step
    
    Returns:
        str: Formatted user prompt for first column
    """
    return f"""You are {persona_str}, participating in a psychology study on cognitive processes. 
                Your task is to generate concise and structured responses for a step in the process, which is based on instructions from a researcher and may build on previous steps and responses.
                Use judgement that is highly critical, focusing on direct and well-established semantic links, and disregard superficial or weak connections.
                Please respond with ONLY the response and absolutely no additional text or explanation. Do not use any newline characters or separate your answer with new lines.
                Provide the response in plain text format as a single continuous paragraph.

                The current step is: {str.upper(col_name)}
                Please respond to the following: {instructions}

                Please respond with ONLY the question and absolutely no additional text or explanation."""


# User prompt for subsequent columns in baseline prompt (from utils/prompts.py - process_row_with_chat)
def get_baseline_subsequent_column_user_prompt(
    base_prompt: str,
    df_columns: list,
    steps: list,
    row_data: dict,
    col_idx: int,
    col_name: str,
    instructions: str
) -> str:
    """
    Generate the user prompt for subsequent columns in baseline prompt processing.
    
    Args:
        base_prompt: The base prompt from the first column
        df_columns: List of DataFrame column names
        steps: List of step dictionaries
        row_data: Dictionary containing previous step responses
        col_idx: Current column index
        col_name: Name of the current column/step
        instructions: Instructions for this step
    
    Returns:
        str: Formatted user prompt for subsequent columns
    """
    llm_prompt = base_prompt
    llm_prompt += "Given the previous steps with responses:"
    for i in range(col_idx):
        llm_prompt += (f"""
                      Prompt:{df_columns[i]}: {steps[i]['instructions']}
                      Response:{row_data[df_columns[i]]}
                """)
    llm_prompt += (f"""
                    The current step is: {str.upper(col_name)}
                    Please respond to the following: {instructions}

                Please respond with ONLY the question and absolutely no additional text or explanation. The structure should include the following fields:
                """)
    return llm_prompt


# User prompt for persona generation (from utils/evaluate.py - generate_persona_from_attributes)
def get_persona_generation_user_prompt(attributes_text: str) -> str:
    """
    Generate the user prompt for persona generation from attributes.
    
    Args:
        attributes_text: Formatted string containing attribute information
    
    Returns:
        str: Formatted user prompt for persona generation
    """
    return f"""Based on the following demographic and attribute information, create a detailed persona description that captures the personality, background, and characteristics of this individual.

Attributes:
{attributes_text}

Please create a persona that:
1. Is 3-4 sentences long
2. Captures the key demographic and lifestyle characteristics
3. Reflects the person's likely personality traits based on their attributes
4. Is written in third person
5. Sounds natural and human-like

Respond with ONLY the persona description, no additional text or formatting."""


# User prompt for evaluation (from utils/evaluate.py - process_row)
def get_evaluation_user_prompt(step_label: str, step_instructions: str, step_output: str, step_measures_list: str) -> str:
    """
    Generate the user prompt for evaluation.
    
    Args:
        step_label: Title/label of the step being evaluated
        step_instructions: Instructions for the step
        step_output: The actual response/output for that step
        step_measures_list: Numbered list of measures to evaluate
    
    Returns:
        str: Formatted user prompt for evaluation
    """
    return f"""Step Title: {step_label}

Step Instructions: {step_instructions}

Output/Response: {step_output}

Measures to use for evaluation: 
{step_measures_list}

Please evaluate this response against the measures defined for this step. Provide scores that accurately reflect the quality of the response relative to the step instructions and measure criteria. Use the full range of scores available - do not default to middle values."""

