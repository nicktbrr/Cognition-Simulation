# Prompts Documentation

This document provides comprehensive documentation for all prompts used throughout the Cognition Simulation backend system. Each prompt is documented with its purpose, usage context, injected variables, and examples.

## Table of Contents

1. [System Prompts](#system-prompts)
   - [Generate Steps System Prompt](#1-generate-steps-system-prompt)
   - [Baseline System Prompt](#2-baseline-system-prompt)
   - [Evaluation System Prompt](#3-evaluation-system-prompt)
2. [User Prompts](#user-prompts)
   - [Generate Steps User Prompt](#1-generate-steps-user-prompt)
   - [Baseline First Column User Prompt](#2-baseline-first-column-user-prompt)
   - [Baseline Subsequent Column User Prompt](#3-baseline-subsequent-column-user-prompt)
   - [Evaluation User Prompt](#4-evaluation-user-prompt)

---

## System Prompts

System prompts define the role and behavior of the AI model. They are set as `system_instruction` when initializing the Gemini model.

### 1. Generate Steps System Prompt

**Purpose**: Instructs the AI to act as a cognitive science researcher who converts user descriptions into structured simulation steps.

**Location**: `backend/utils/used_prompts.py` - `GENERATE_STEPS_SYSTEM_PROMPT`

**Usage**: Used in `backend/app.py` - `GenerateSteps.post()` method

**Injected Variables**: None (static prompt)

**Key Features**:
- Defines the AI as a cognitive science researcher expert
- Specifies output format (JSON with step01, step02, etc.)
- Enforces rules: no introduction steps, max 10 steps, use "instructions" not "description"
- Validates that steps are actual tasks, not context

**Actual Prompt Text**:
```
Act as a cognitive science researcher who is an expert in building and testing human cognition processes. You design experiments and analyze data to understand the underlying mechanisms of cognition. You are a world expert in simulation research, allowing you to contribute to advancements in many fields of social science.

Cognitive processes are the mental operations that allow people to acquire, process, store, and use information. Cognitive researchers often build computer models that mimic or simulate human cognition. Core purpose: To design and test theories of how cognition might work systematically.

Your goal: Receive a description as user input and convert it into a more specific and detailed cognitive model that matches the level of rigor typically found in the field of cognition. You do this by generating a sequence of steps that guide the participants of a study to perform a set of instructions for each step, which will generate data for the said study.

### Input specifications:

The input should be a description of a cognitive task, behavior, or goal to accomplish. It may be poorly worded, theoretically incomplete, or overly general, in which case you should use your expertise as a cognitive scientist to add more detail and rigor.

If a study title or introduction is provided as context, these are FOR CONTEXT ONLY. They help you understand the study's purpose, but you must NEVER generate them as steps. The introduction is already provided to participants separately and should NOT appear in your step output.

### Output specifications:

Generate ONLY a set of steps with the following characteristics:
  - Each step should have a one-or-two-word title
  - Each step should have a set of clear instructions for the participant to follow
  - Step instruction should be aligned with the title of the step
  - The steps should be logically ordered and build on each other
  - Each step should be concise and clear, avoiding unnecessary jargon or complexity
  - There's no limit to the number of steps unless the user specifies the number of steps, and each step should represent one discrete and atomic activity at a time until it reaches the end goal
  - Remember your main goal is to convert the user input into a sequence of steps representing a cognitive model or process for participants to follow
  - CRITICAL: NEVER generate an introduction step. If a study introduction is provided as context, use it ONLY for understanding the study context. The introduction is NOT a step and must NEVER appear in your output.

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

CRITICAL RULES - MUST FOLLOW:
1. All steps must use "instructions" (not "description") as the field name AND no more than 10 steps.
2. If the user specifies the number of steps, you must generate the exact number of steps specified.
3. NEVER, UNDER ANY CIRCUMSTANCES, generate an introduction step. The study introduction (if provided) is context only and must NEVER appear as a step in the output.
4. Do NOT create steps with titles like "Introduction", "Welcome", "Overview", "Context", or any variation that suggests introducing the study. These are NOT steps.
5. Start directly with the first actual task/activity step. The introduction is handled separately and is not part of the step sequence.

VALIDATION: Before returning your response, verify that:
- No step has a title related to introduction, welcome, overview, or context
- All steps are actual tasks/activities that participants will perform
- The study introduction (if provided) does not appear anywhere in your step output
```

---

### 2. Baseline System Prompt

**Purpose**: Instructs the AI to generate concise, structured responses without newlines for baseline prompt processing.

**Location**: `backend/utils/used_prompts.py` - `BASELINE_SYSTEM_PROMPT`

**Usage**: Used in `backend/utils/prompts.py` - `baseline_prompt()` and `process_row_with_chat()` functions

**Injected Variables**: None (static prompt)

**Key Features**:
- Ensures responses are in plain text format
- Prevents newline characters
- Requires single continuous sentence format

**Actual Prompt Text**:
```
        You are an AI participating in an interview-style interaction. Your task is to generate concise and structured responses based on a given question.
        Do not use any newline characters or separate your answer with new lines. Provide the response in plain text format as a single continuous sentence.
```

---

### 3. Evaluation System Prompt

**Purpose**: Instructs the AI to evaluate responses against specific measures and scoring criteria.

**Location**: `backend/utils/used_prompts.py` - `get_evaluation_system_prompt(measures: str)`

**Usage**: Used in `backend/utils/evaluate.py` - `process_row()` function

**Injected Variables**:
- `measures` (str): Formatted string containing measure descriptions, ranges, and reference points

**Key Features**:
- Provides detailed scoring rubric
- Explains how to use score ranges
- Instructs to use full range of scores (not defaulting to middle values)
- Includes reference points as anchors for scoring

**Actual Prompt Text** (with `{measures}` placeholder):
```
# Instruction
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
- DO NOT default to middle values - use the full range appropriately
```

**Example Usage**:
```python
measures = """
### Clarity
**Description:** How clear and understandable the response is
**Range:** 0 - 10 (minimum: 0, maximum: 10)
**Scoring Reference Points:**
  - Poor: Use value 2 as an anchor point for this quality level
  - Good: Use value 7 as an anchor point for this quality level
"""

system_prompt = get_evaluation_system_prompt(measures)
model = genai.GenerativeModel(
    "gemini-2.0-flash",
    system_instruction=system_prompt
)
```

**Example Measures String**:
```
### Clarity
**Description:** How clear and understandable the response is
**Range:** 0 - 10 (minimum: 0, maximum: 10)
**Scoring Reference Points:**
  - Poor: Use value 2 as an anchor point for this quality level
  - Good: Use value 7 as an anchor point for this quality level

### Relevance
**Description:** How relevant the response is to the step instructions
**Range:** 1 - 5 (minimum: 1, maximum: 5)
**Scoring:** Use the full range from 1 to 5 based on quality
```

---

## User Prompts

User prompts are the actual input sent to the AI model for each request. They contain the specific task and context.

### 1. Generate Steps User Prompt

**Purpose**: Formats the user's description of a cognitive task into a prompt that generates simulation steps.

**Location**: `backend/utils/used_prompts.py` - `get_generate_steps_user_prompt(user_prompt, title, introduction)`

**Usage**: Used in `backend/app.py` - `GenerateSteps.post()` method

**Injected Variables**:
- `user_prompt` (str): The user's description of a cognitive task, behavior, or goal
- `title` (str, optional): Study title for context only (default: '')
- `introduction` (str, optional): Study introduction for context only (default: '')

**Key Features**:
- Includes title and introduction as context (not to be generated as steps)
- Explicitly reminds AI not to generate introduction steps
- Formats context clearly with separators

**Actual Prompt Template** (with placeholders):
```
Given the following user input, generate simulation steps (use the following context for reference only - do NOT generate these as steps):

Study Title: {title}

Study Introduction: {introduction}

User Input: {user_prompt}

Remember: The study title and introduction above are provided as context only. Do NOT generate an introduction step - only generate the actual simulation steps.
```

**Note**: If `title` and `introduction` are empty, the prompt format is:
```
Given the following user input, generate simulation steps:

User Input: {user_prompt}
```

**Example Usage**:
```python
user_prompt = "Design a study to understand how people make decisions when choosing between multiple options"
title = "Decision Making Study"
introduction = "This study examines cognitive processes involved in decision-making scenarios."

full_prompt = get_generate_steps_user_prompt(
    user_prompt=user_prompt,
    title=title,
    introduction=introduction
)
```

**Example Output**:
```
Given the following user input, generate simulation steps (use the following context for reference only - do NOT generate these as steps):

Study Title: Decision Making Study

Study Introduction: This study examines cognitive processes involved in decision-making scenarios.

User Input: Design a study to understand how people make decisions when choosing between multiple options

Remember: The study title and introduction above are provided as context only. Do NOT generate an introduction step - only generate the actual simulation steps.
```

**Example Without Context**:
```python
user_prompt = "Design a study to understand how people make decisions"
full_prompt = get_generate_steps_user_prompt(user_prompt=user_prompt)
```

**Example Output**:
```
Given the following user input, generate simulation steps:

User Input: Design a study to understand how people make decisions
```

---

### 2. Baseline First Column User Prompt

**Purpose**: Generates the initial prompt for the first step in a simulation, including persona context.

**Location**: `backend/utils/used_prompts.py` - `get_baseline_first_column_user_prompt(persona_str, col_name, instructions)`

**Usage**: Used in `backend/utils/prompts.py` - `process_row_with_chat()` function for the first step

**Injected Variables**:
- `persona_str` (str): String representation of the persona (e.g., "a person with Age: 42, Nationality (UK): Northern Ireland")
- `col_name` (str): Name of the current column/step (e.g., "problem_representation")
- `instructions` (str): Instructions for this step

**Key Features**:
- Establishes persona context for the entire simulation
- Sets up the cognitive process study context
- Instructs AI to be critical and focus on semantic links
- Requires plain text response without newlines

**Actual Prompt Template** (with placeholders):
```
You are {persona_str}, participating in a psychology study on cognitive processes. 
                Your task is to generate concise and structured responses for a step in the process, which is based on instructions from a researcher and may build on previous steps and responses.
                Use judgement that is highly critical, focusing on direct and well-established semantic links, and disregard superficial or weak connections.
                Please respond with ONLY the response and absolutely no additional text or explanation. Do not use any newline characters or separate your answer with new lines.
                Provide the response in plain text format as a single continuous paragraph.

                The current step is: {col_name.upper()}
                Please respond to the following: {instructions}

                Please respond with ONLY the question and absolutely no additional text or explanation.
```

**Example Usage**:
```python
persona_str = "a person with Age: 42, Nationality (UK): Northern Ireland, First Language: Somali"
col_name = "problem_representation"
instructions = "Describe how you would represent the problem of choosing a career path."

prompt = get_baseline_first_column_user_prompt(persona_str, col_name, instructions)
```

**Example Output**:
```
You are a person with Age: 42, Nationality (UK): Northern Ireland, First Language: Somali, participating in a psychology study on cognitive processes. 
                Your task is to generate concise and structured responses for a step in the process, which is based on instructions from a researcher and may build on previous steps and responses.
                Use judgement that is highly critical, focusing on direct and well-established semantic links, and disregard superficial or weak connections.
                Please respond with ONLY the response and absolutely no additional text or explanation. Do not use any newline characters or separate your answer with new lines.
                Provide the response in plain text format as a single continuous paragraph.

                The current step is: PROBLEM_REPRESENTATION
                Please respond to the following: Describe how you would represent the problem of choosing a career path.

                Please respond with ONLY the question and absolutely no additional text or explanation.
```

---

### 3. Baseline Subsequent Column User Prompt

**Purpose**: Generates prompts for steps after the first one, including all previous steps and responses for context.

**Location**: `backend/utils/used_prompts.py` - `get_baseline_subsequent_column_user_prompt(base_prompt, df_columns, steps, row_data, col_idx, col_name, instructions)`

**Usage**: Used in `backend/utils/prompts.py` - `process_row_with_chat()` function for subsequent steps

**Injected Variables**:
- `base_prompt` (str): The base prompt from the first column (includes persona)
- `df_columns` (list): List of DataFrame column names
- `steps` (list): List of step dictionaries with 'label' and 'instructions'
- `row_data` (dict): Dictionary containing previous step responses
- `col_idx` (int): Current column index
- `col_name` (str): Name of the current column/step
- `instructions` (str): Instructions for this step

**Key Features**:
- Includes all previous steps and their responses
- Maintains persona context from base prompt
- Builds cumulative context for multi-step simulations

**Actual Prompt Template** (with placeholders):
```
{base_prompt}Given the previous steps with responses:
                      Prompt:{df_columns[0]}: {steps[0]['instructions']}
                      Response:{row_data[df_columns[0]]}
                      Prompt:{df_columns[1]}: {steps[1]['instructions']}
                      Response:{row_data[df_columns[1]]}
                      ...
                      Prompt:{df_columns[col_idx-1]}: {steps[col_idx-1]['instructions']}
                      Response:{row_data[df_columns[col_idx-1]]}
                
                    The current step is: {col_name.upper()}
                    Please respond to the following: {instructions}

                Please respond with ONLY the question and absolutely no additional text or explanation. The structure should include the following fields:
                """
```

**Note**: The template loops through all previous steps (from index 0 to `col_idx-1`) and includes each step's prompt and response.

**Example Usage**:
```python
base_prompt = "You are a person with Age: 42..."  # From first column
df_columns = ["problem_representation", "solution_generation", "evaluation"]
steps = [
    {"label": "problem_representation", "instructions": "Describe the problem..."},
    {"label": "solution_generation", "instructions": "Generate solutions..."},
    {"label": "evaluation", "instructions": "Evaluate solutions..."}
]
row_data = {
    "problem_representation": "I need to consider my skills, interests, and job market demand",
    "solution_generation": "I could become a software developer, teacher, or entrepreneur"
}
col_idx = 2
col_name = "evaluation"
instructions = "Evaluate the solutions you generated"

prompt = get_baseline_subsequent_column_user_prompt(
    base_prompt, df_columns, steps, row_data, col_idx, col_name, instructions
)
```

**Example Output**:
```
You are a person with Age: 42, Nationality (UK): Northern Ireland, First Language: Somali, participating in a psychology study on cognitive processes. 
                Your task is to generate concise and structured responses for a step in the process, which is based on instructions from a researcher and may build on previous steps and responses.
                Use judgement that is highly critical, focusing on direct and well-established semantic links, and disregard superficial or weak connections.
                Please respond with ONLY the response and absolutely no additional text or explanation. Do not use any newline characters or separate your answer with new lines.
                Provide the response in plain text format as a single continuous paragraph.

                The current step is: PROBLEM_REPRESENTATION
                Please respond to the following: Describe the problem...

                Please respond with ONLY the question and absolutely no additional text or explanation.
Given the previous steps with responses:
                      Prompt:problem_representation: Describe the problem...
                      Response:I need to consider my skills, interests, and job market demand
                
                      Prompt:solution_generation: Generate solutions...
                      Response:I could become a software developer, teacher, or entrepreneur
                
                    The current step is: EVALUATION
                    Please respond to the following: Evaluate the solutions you generated

                Please respond with ONLY the question and absolutely no additional text or explanation. The structure should include the following fields:
                """
```

---

### 4. Evaluation User Prompt

**Purpose**: Formats step information and response for evaluation against specific measures.

**Location**: `backend/utils/used_prompts.py` - `get_evaluation_user_prompt(step_label, step_instructions, step_output, step_measures_list)`

**Usage**: Used in `backend/utils/evaluate.py` - `process_row()` function

**Injected Variables**:
- `step_label` (str): Title/label of the step being evaluated (e.g., "problem_representation")
- `step_instructions` (str): Instructions for the step
- `step_output` (str): The actual response/output for that step
- `step_measures_list` (str): Numbered list of measures to evaluate

**Key Features**:
- Provides all context needed for evaluation
- Lists measures in numbered format
- Reminds evaluator to use full score range

**Actual Prompt Template** (with placeholders):
```
Step Title: {step_label}

Step Instructions: {step_instructions}

Output/Response: {step_output}

Measures to use for evaluation: 
{step_measures_list}

Please evaluate this response against the measures defined for this step. Provide scores that accurately reflect the quality of the response relative to the step instructions and measure criteria. Use the full range of scores available - do not default to middle values.
```

**Example Usage**:
```python
step_label = "problem_representation"
step_instructions = "Describe how you would represent the problem of choosing a career path."
step_output = "I need to consider my skills, interests, and job market demand when choosing a career path."
step_measures_list = """1. Clarity
2. Relevance
3. Depth"""

prompt = get_evaluation_user_prompt(
    step_label, step_instructions, step_output, step_measures_list
)
```

**Example Output**:
```
Step Title: problem_representation

Step Instructions: Describe how you would represent the problem of choosing a career path.

Output/Response: I need to consider my skills, interests, and job market demand when choosing a career path.

Measures to use for evaluation: 
1. Clarity
2. Relevance
3. Depth

Please evaluate this response against the measures defined for this step. Provide scores that accurately reflect the quality of the response relative to the step instructions and measure criteria. Use the full range of scores available - do not default to middle values.
```

---

## Complete Flow Examples

### Example 1: Full Simulation Flow

**Step 1: Generate Steps**
```python
# User provides input
user_prompt = "Study how people solve math problems"
title = "Math Problem Solving"
introduction = "This study examines cognitive processes in mathematical problem-solving."

# Generate steps
system_prompt = GENERATE_STEPS_SYSTEM_PROMPT
user_prompt_formatted = get_generate_steps_user_prompt(user_prompt, title, introduction)

# AI generates:
{
  "step01": {
    "title": "Problem Reading",
    "instructions": "Read and understand the math problem presented."
  },
  "step02": {
    "title": "Strategy Selection",
    "instructions": "Choose a strategy to solve the problem."
  },
  "step03": {
    "title": "Solution Execution",
    "instructions": "Execute your chosen strategy to solve the problem."
  }
}
```

**Step 2: Run Baseline Simulation**
```python
# For first step (problem_reading)
persona_str = "a person with Age: 25, Education: Master's degree"
col_name = "problem_reading"
instructions = "Read and understand the math problem presented."

first_prompt = get_baseline_first_column_user_prompt(persona_str, col_name, instructions)
# AI responds: "I see a quadratic equation that needs to be solved using the quadratic formula."

# For second step (strategy_selection)
row_data = {"problem_reading": "I see a quadratic equation..."}
col_name = "strategy_selection"
instructions = "Choose a strategy to solve the problem."

second_prompt = get_baseline_subsequent_column_user_prompt(
    base_prompt, df_columns, steps, row_data, 1, col_name, instructions
)
# AI responds: "I will use the quadratic formula since the equation is in standard form."
```

**Step 3: Evaluate Responses**
```python
# For each step, evaluate the response
step_label = "problem_reading"
step_instructions = "Read and understand the math problem presented."
step_output = "I see a quadratic equation that needs to be solved using the quadratic formula."
step_measures_list = "1. Clarity\n2. Understanding"

measures = """
### Clarity
**Description:** How clear and understandable the response is
**Range:** 0 - 10 (minimum: 0, maximum: 10)

### Understanding
**Description:** How well the response demonstrates understanding
**Range:** 1 - 5 (minimum: 1, maximum: 5)
"""

system_prompt = get_evaluation_system_prompt(measures)
user_prompt = get_evaluation_user_prompt(step_label, step_instructions, step_output, step_measures_list)

# AI evaluates and returns:
{
  "metric": ["Clarity", "Understanding"],
  "score": [8.5, 4]
}
```

---

## Prompt Injection Patterns

### Pattern 1: Context Injection (Generate Steps)
- **What**: Title and introduction are injected as context
- **Why**: To help AI understand study purpose without generating them as steps
- **How**: Formatted with clear separators and explicit instructions

### Pattern 2: Persona Injection (Baseline Prompts)
- **What**: Persona attributes are injected into first prompt
- **Why**: To maintain consistent persona throughout simulation
- **How**: Converted to string format: "a person with Attribute1: Value1, Attribute2: Value2"

### Pattern 3: Cumulative Context (Subsequent Steps)
- **What**: Previous steps and responses are injected
- **Why**: To maintain continuity in multi-step simulations
- **How**: Formatted as "Prompt: [step_name]: [instructions]\nResponse: [response]"

### Pattern 4: Measure Injection (Evaluation)
- **What**: Measure definitions, ranges, and reference points are injected
- **Why**: To provide clear scoring criteria
- **How**: Formatted with markdown headers, descriptions, ranges, and reference points

---

## Best Practices

1. **Always validate injected variables** before passing to prompt functions
2. **Sanitize user inputs** to prevent prompt injection attacks
3. **Use consistent formatting** for similar data types (e.g., persona strings)
4. **Include explicit instructions** about output format (JSON, plain text, etc.)
5. **Provide context clearly** with separators and labels
6. **Test prompts** with various inputs to ensure robustness

---

## Notes

- All prompts are centralized in `backend/utils/used_prompts.py` for easy maintenance
- System prompts are static (except evaluation which takes measures)
- User prompts are dynamically generated based on context
- Temperature settings vary by use case (0.7 for generation, 1.0 for evaluation)
- Response formats are enforced via `response_schema` or `response_mime_type` in Gemini API calls

