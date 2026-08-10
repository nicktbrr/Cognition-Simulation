# Prompts

Every prompt the backend sends lives in **`backend/utils/prompts.py`**. Nothing
outside that module should build a prompt string.

This document explains what each prompt is for, who calls it, and what gets
injected into it. It deliberately does **not** copy the prompt text — read that
in `prompts.py`, which is the source of truth.

> **Naming note:** `prompts.py` holds prompt text only. The code that *runs* a
> simulation is `simulation.py`. (These were previously `used_prompts.py` and
> `prompts.py` respectively, which was backwards and easy to confuse.)

---

## System prompts

| Constant / builder | Used by | Purpose |
| --- | --- | --- |
| `GENERATE_STEPS_SYSTEM_PROMPT` | `app.py` → `GenerateSteps.post()` | Turns a study description into an ordered set of steps, optionally branching into experimental conditions. Emits JSON. |
| `BASELINE_SYSTEM_PROMPT` | `simulation.py` → `baseline_prompt()` | Puts the model in the role of one human participant playing a persona through a study. |
| `get_evaluation_system_prompt(measures)` | `evaluate.py` → `process_row()` | Scores a step's response against the study's measures. Emits JSON. |
| `PARSE_PDF_SYSTEM_PROMPT` | `app.py` → `ParsePDF` | Reconstructs every empirical study in an uploaded paper as a runnable simulation spec. Emits JSON. |

### `GENERATE_STEPS_SYSTEM_PROMPT`

Static. Defines the step schema (`title` + `instructions`, max 10 steps), the
branching schema (`next` + `sample_proportion`), and hard rules — most
importantly that an introduction is **never** a step, and that a branching graph
must have exactly one root at 100% with child proportions summing to their
parent's.

### `BASELINE_SYSTEM_PROMPT`

Static. Establishes the four things every simulation response depends on:

1. **Stay in persona** for the whole study, including its blind spots.
2. **Answer conditionally** — the run is one continuous pass, so each answer
   builds on the ones before it.
3. **Fulfil the current step only** — produce the judgement, list, rating or
   choice it asks for; don't preview later steps or re-answer earlier ones.
4. **Plain text, one paragraph, no newlines** — the response goes into a single
   spreadsheet cell.

### `get_evaluation_system_prompt(measures)`

Injects `measures`: a formatted block of measure titles, definitions, ranges and
value anchors. The rubric pushes the evaluator to use the full range rather than
defaulting to middle values.

### `PARSE_PDF_SYSTEM_PROMPT`

Static. Defines what counts as a study, and the JSON shape returned per study:
`title`, `brief_description`, `study_introduction`, `sample`, `measures` (with
`min_value`/`max_value`/`value_anchors`), and `steps` (with `measure_ids`
referencing that study's own measures).

---

## User prompts

| Builder | Used by |
| --- | --- |
| `get_generate_steps_user_prompt(user_prompt, title, introduction)` | `app.py` → `GenerateSteps.post()` |
| `get_baseline_persona_preamble(persona_str, study_introduction)` | `simulation.py` → `process_row_with_chat()` |
| `get_baseline_first_column_user_prompt(persona_str, col_name, instructions, study_introduction)` | `simulation.py` → `process_row_with_chat()` |
| `get_baseline_subsequent_column_user_prompt(preamble, path_history, col_name, instructions)` | `simulation.py` → `process_row_with_chat()` |
| `get_persona_generation_user_prompt(attributes_text)` | `evaluate.py` → `generate_persona_from_attributes()` |
| `get_evaluation_user_prompt(step_label, step_instructions, step_output, step_measures_list)` | `evaluate.py` → `process_row()` |
| `get_parse_pdf_user_prompt(filename)` | `app.py` → `ParsePDF` |

### `get_generate_steps_user_prompt`

Passes the user's description through, with the study title and introduction as
context when they exist. When either is missing the prompt explicitly asks the
model to generate it, so `title` and `introduction` always come back in the JSON.

### The baseline simulation prompts

These three build one prompt per step, and they are the core of the simulation.

**The model is called statelessly, once per step.** There is no chat history: if
something is not in the prompt string, the participant does not know it. So every
step's prompt is assembled from three blocks.

```
get_baseline_persona_preamble(...)          <- block 1, identical on every step
    YOUR PERSONA
    You are {persona_str}. ...
    STUDY INTRODUCTION                      <- omitted when the study has none
    {study_introduction}

STEPS YOU HAVE ALREADY COMPLETED            <- block 2, omitted on the first step
    Step 1 - {LABEL}
    Instructions you were given: {instructions}
    Your answer: {response}
    Step 2 - {LABEL}
    ...

CURRENT STEP: {LABEL}                       <- block 3, identical shape on every step
    The researcher's instructions for this step are:
    {instructions}
    Complete this step now, as your persona and consistently with
    the answers you have already given. ...
```

- **Block 1** is built once per persona in `process_row_with_chat()` and reused
  for every step on that persona's path, so the persona and the researcher's
  setup never drop out of context.
- **Block 2** is `path_history`: **every parent step the persona travelled**, in
  order, each with the researcher's instructions and the answer *this persona*
  gave. This is what makes each response conditional on the run so far rather
  than on the current instructions alone.
- **Block 3** states exactly one step and asks the model to fulfil it. On the
  first step the "consistently with the answers you have already given" clause is
  dropped, since there are none.

**Branching:** a persona traverses exactly one root-to-leaf path through the step
graph (see `graph.py` → `assign_persona_paths`). `path_history` is therefore that
persona's own ancestry — the parent steps it actually passed through, and nothing
from the branches it never entered. Two personas reaching the same merge step get
different histories, which is the whole point of the comparison.

### `get_persona_generation_user_prompt`

Injects `attributes_text` (demographics as name/value lines) and asks for a 3-4
sentence third-person persona description. Used when a sample row has no persona.

### `get_evaluation_user_prompt`

Injects the step title, its instructions, the response being scored, and the
numbered measure list for that step.

### `get_parse_pdf_user_prompt`

Short instruction that accompanies the uploaded PDF; the filename is passed as
weak context only.

---

## Adding or changing a prompt

1. Put the text in `prompts.py` — as a `*_SYSTEM_PROMPT` constant if it is
   static, or a `get_*_prompt()` function if anything is injected.
2. Import it where it is used. Never inline prompt text in `app.py`,
   `simulation.py` or `evaluate.py`.
3. Add a row to the tables above.

Where a prompt must return JSON, the shape is enforced at the call site by the
structured-output schema in `llm.py` (`invoke_structured`), not by the prompt
alone — keep the two in sync.
