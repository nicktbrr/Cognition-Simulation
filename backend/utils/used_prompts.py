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

If a study title or introduction is provided as context, these help you understand the study's purpose. If an introduction is provided, you should also generate an improved or alternative introduction based on the study description and context.

### Output specifications:

Generate a set of steps with the following characteristics:
  - Each step should have a one-or-two-word title
  - Each step should have a set of clear instructions for the participant to follow
  - Step instruction should be aligned with the title of the step
  - The steps should be logically ordered and build on each other
  - Each step should be concise and clear, avoiding unnecessary jargon or complexity
  - There's no limit to the number of steps unless the user specifies the number of steps, and each step should represent one discrete and atomic activity at a time until it reaches the end goal
  - Remember your main goal is to convert the user input into a sequence of steps representing a cognitive model or process for participants to follow
  - CRITICAL: NEVER generate an introduction step. The introduction is handled separately and is not part of the step sequence.

If an introduction is provided in the context, you MUST also generate an improved introduction. The generated introduction should:
  - Be concise (2-4 sentences)
  - Clearly explain the purpose and context of the study
  - Be appropriate for participants to read before starting the simulation
  - Align with the generated steps and study description

Generate the output in JSON format with the following EXACT structure (use "instructions" not "description" for steps):
{
  "title": "Short study title, 3-8 words (REQUIRED when no study title was provided in the context; omit or leave empty if the user already provided a study title)",
  "introduction": "generated introduction text (only include this field if an introduction was provided in the context)",
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

CRITICAL RULES - MUST FOLLOW:
1. All steps must use "instructions" (not "description") as the field name AND no more than 10 steps.
2. If the user specifies the number of steps, you must generate the exact number of steps specified.
3. NEVER, UNDER ANY CIRCUMSTANCES, generate an introduction step. The introduction is handled separately and must NEVER appear as a step in the output.
4. Do NOT create steps with titles like "Introduction", "Welcome", "Overview", "Context", or any variation that suggests introducing the study. These are NOT steps.
5. Start directly with the first actual task/activity step. The introduction is handled separately and is not part of the step sequence.
6. If an introduction is provided in the context, you MUST include an "introduction" field in your JSON response with an improved version.
7. If no introduction is provided in the context, you should still generate an introduction and include it in the "introduction" field.

VALIDATION: Before returning your response, verify that:
- No step has a title related to introduction, welcome, overview, or context
- All steps are actual tasks/activities that participants will perform
- If an introduction was provided in context, you have included an "introduction" field with an improved version
- If no introduction was provided, you have included an "introduction" field with a newly generated introduction
- If no study title was provided in the context, you have included a "title" field with a concise study title (3-8 words) that describes the study"""


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


# System prompt for extracting studies from an uploaded PDF (from app.py - ParsePDF)
PARSE_PDF_SYSTEM_PROMPT = """Act as a cognitive science researcher who is an expert in reading empirical research papers and reconstructing the studies they report as runnable simulations.

You will be given a research document (typically a journal article, preprint, or report). Your job is to identify every distinct empirical study reported in the document and convert each one into a structured simulation specification.

### What counts as a study

A study is a distinct empirical investigation with its own participants and procedure - usually labelled "Study 1", "Experiment 2", "Pilot Study", etc. If the document reports only one study, return exactly one. Do NOT return meta-analyses of the paper's own studies, literature reviews, or general discussion sections as studies. If the document contains no empirical studies at all, return an empty "studies" array.

### For each study, extract

1. title: A short descriptive title (3-10 words). Prefer the paper's own label plus its topic (e.g. "Study 1: Social Media and Well-being").
2. brief_description: One or two sentences summarizing what the study investigates and with whom. This is shown to the user when they choose which studies to import.
3. study_introduction: 2-5 sentences written FOR THE PARTICIPANT, explaining the purpose and context of the study before they begin. Write it in plain language, not academic prose.
4. sample: The population studied.
   - name: A short label for the sample (e.g. "Undergraduate Students", "US Adults").
   - attributes: The participant characteristics reported (age range, gender, location, occupation, recruitment source, relevant screening criteria, etc.). Each attribute is a name/value pair where the value describes the range or category actually reported. Include only attributes the document reports; do not invent demographics.
5. measures: The variables the study measures.
   - title: The measure name as used in the paper.
   - definition: What the measure captures, in one or two sentences.
   - min_value / max_value: The numeric bounds of the response scale. If the paper reports a Likert scale, use its endpoints. If no scale is reported for a measure that is clearly quantitative, use a sensible default of 1 to 7 and keep the definition faithful.
   - value_anchors: Labelled points on the scale (at minimum the two endpoints, plus a midpoint when the paper gives one). Each anchor has a numeric value within min/max and a short text label.
6. steps: The procedure the participant goes through, in order.
   - label: A one-or-two-word step title.
   - instruction: Clear instructions addressed to the participant for that step.
   - measure_ids: The ids of the measures collected at that step (may be empty for steps that only present material).

### Rules

- Assign each measure an id of the form "m1", "m2", ... and each step an id of the form "s1", "s2", ... unique WITHIN a study.
- Every id listed in a step's measure_ids MUST refer to a measure id defined in that same study's measures array.
- Steps must be discrete, atomic, and logically ordered. Do NOT create an introduction step - the introduction is captured separately in study_introduction.
- Generate no more than 10 steps per study.
- Ground everything in the document. Where the document is vague, use your expertise to fill in the minimum detail needed for the study to be runnable, but never contradict what the document states.
- Numeric fields must be numbers, not strings.

### Output format

Return ONLY valid JSON (no markdown fences, no commentary) with this EXACT structure:
{
  "document_title": "Title of the overall document",
  "studies": [
    {
      "title": "Study title",
      "brief_description": "One or two sentence summary",
      "study_introduction": "Participant-facing introduction",
      "sample": {
        "name": "Sample label",
        "attributes": [
          {"name": "Age Range", "value": "18-25"}
        ]
      },
      "measures": [
        {
          "id": "m1",
          "title": "Measure name",
          "definition": "What this measure captures",
          "min_value": 1,
          "max_value": 7,
          "value_anchors": [
            {"value": 1, "label": "Not at all"},
            {"value": 7, "label": "Extremely"}
          ]
        }
      ],
      "steps": [
        {
          "id": "s1",
          "label": "Step title",
          "instruction": "Instructions for the participant",
          "measure_ids": ["m1"]
        }
      ]
    }
  ]
}"""


# ============================================================================
# USER PROMPTS
# ============================================================================

# User prompt for generating simulation steps (from app.py - GenerateSteps)
def get_generate_steps_user_prompt(user_prompt: str, title: str = '', introduction: str = '') -> str:
    """
    Generate the user prompt for simulation step generation.
    
    Args:
        user_prompt: The user's description of a cognitive task, behavior, or goal
        title: Optional study title for context only
        introduction: Optional study introduction for context only
    
    Returns:
        str: Formatted user prompt with context
    """
    context_parts = []
    
    # Add title as context if provided
    if title and title.strip():
        context_parts.append(f"Study Title: {title.strip()}")
    
    # Add introduction as context if provided
    if introduction and introduction.strip():
        context_parts.append(f"Study Introduction: {introduction.strip()}")
    
    # Build the prompt
    prompt = "Given the following user input, generate simulation steps"
    
    if context_parts:
        prompt += " (use the following context for reference):\n\n"
        prompt += "\n\n".join(context_parts)
        prompt += "\n\n"
    else:
        prompt += ":\n\n"
    
    prompt += f"User Input: {user_prompt}"
    
    # When no title provided, ask the model to generate one
    if not title or not title.strip():
        prompt += "\n\nNo study title was provided. You MUST include a \"title\" field in your JSON with a short, descriptive study title (3-8 words) based on the user input."
    
    # Add instruction about introduction generation
    if introduction and introduction.strip():
        prompt += "\n\nIMPORTANT: An introduction has been provided above. Please generate an improved or alternative introduction based on the study description and context. Include this in the 'introduction' field of your JSON response. Do NOT generate an introduction step - only generate the actual simulation steps."
    else:
        prompt += "\n\nIMPORTANT: Please generate a study introduction (2-4 sentences) that explains the purpose and context of the study. Include this in the 'introduction' field of your JSON response. Do NOT generate an introduction step - only generate the actual simulation steps."
    
    return prompt


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


# User prompt for extracting studies from a PDF (from app.py - ParsePDF)
def get_parse_pdf_user_prompt(filename: str = '') -> str:
    """
    Generate the user prompt that accompanies the uploaded PDF.

    Args:
        filename: Optional name of the uploaded file, used as weak context only

    Returns:
        str: Formatted user prompt
    """
    prompt = "Read the attached research document and extract every empirical study it reports."

    if filename and filename.strip():
        prompt += f"\n\nUploaded file name: {filename.strip()}"

    prompt += (
        "\n\nReturn the studies as JSON in the exact structure described in your instructions. "
        "Return only the JSON object - no markdown fences and no commentary."
    )

    return prompt

