"""
The "Summary" sheet of a simulation's export: the full spec the run used.

Samples and measures stay editable after a simulation runs, so the export
is the lasting record of what a run was given. The sheet is one tab of
stacked sections, meant to be read top to bottom:

    Simulation overview      title, run date, model, personas, sample, intro
    Sample characteristics   every option with its target share, or the
                             range, mean and SD of a continuous attribute
    Measures                 definition, anchor points, items and citation
    Steps                    the design graph, one row per step
"""

from openpyxl.styles import Alignment, Font, PatternFill

from .graph import is_measure_step
from .sampling import resolve_distribution


SHEET_NAME = 'Summary'

# Five columns wide: the widest table (sample characteristics and measures)
# sets the grid, and the steps table reuses the same columns plus a few more.
COLUMN_WIDTHS = [24, 30, 50, 60, 40, 14, 60, 14, 30]

TITLE_FONT = Font(bold=True, size=14)
SECTION_FONT = Font(bold=True, size=12)
HEADER_FONT = Font(bold=True)
HEADER_FILL = PatternFill('solid', start_color='E7ECF3')
CELL_ALIGNMENT = Alignment(wrap_text=True, vertical='top')


def _number(value):
    """Render 60.0 as "60" and 10.66 as "10.7"."""
    try:
        value = float(value)
    except (TypeError, ValueError):
        return str(value)
    if value.is_integer():
        return str(int(value))
    return f"{value:.1f}"


def _item_texts(measure):
    """A measure's items as plain strings; items are stored as str or {text}."""
    texts = []
    for item in (measure or {}).get('items') or []:
        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            text = str(item.get('text') or '').strip()
        else:
            text = ''
        if text:
            texts.append(text)
    return texts


def unique_measures(steps):
    """
    Every measure the design uses, once each and in first-use order.

    The same measure can sit on several steps; it is keyed by id, falling
    back to title and description for measures saved without one.
    """
    measures = []
    seen = set()
    for step in steps or []:
        for measure in step.get('measures') or []:
            if not isinstance(measure, dict):
                continue
            key = measure.get('id') or (measure.get('title', ''), measure.get('description', ''))
            if key in seen:
                continue
            seen.add(key)
            measures.append(measure)
    return measures


def format_anchors(measure):
    """The anchor points one per line, e.g. "1 = Strongly disagree"."""
    lines = []
    for anchor in (measure or {}).get('desiredValues') or []:
        label = str(anchor.get('label') or '').strip()
        value = _number(anchor.get('value'))
        lines.append(f"{value} = {label}" if label else value)
    return '\n'.join(lines)


def format_items(measure):
    """The items numbered one per line."""
    return '\n'.join(f"{i}. {text}" for i, text in enumerate(_item_texts(measure), start=1))


def attribute_rows(attribute):
    """
    The sample-characteristics rows for one attribute, as
    [category, characteristic, type, option, target].

    Distributions go through `resolve_distribution`, so an attribute saved
    without one reads the same defaults its personas were generated from.
    """
    label = attribute.get('label', '')
    category = str(attribute.get('category') or '').replace('_', ' ').title()
    distribution = resolve_distribution(attribute)

    if distribution['type'] == 'continuous':
        values = attribute.get('values') or []
        option = values[0] if values and isinstance(values[0], str) else (
            f"{_number(distribution['min'])} - {_number(distribution['max'])}"
        )
        target = f"mean {_number(distribution['mean'])}, SD {_number(distribution['sd'])}"
        return [[category, label, 'Continuous', option, target]]

    rows = []
    for i, (value, percent) in enumerate(distribution['percentages'].items()):
        first = i == 0
        rows.append([
            category if first else '',
            label if first else '',
            'Categorical' if first else '',
            value,
            f"{_number(percent)}%",
        ])
    return rows


def step_rows(steps):
    """The steps table: one row per step, the graph given by label."""
    label_by_id = {
        step.get('id'): step.get('label', '')
        for step in steps or [] if step.get('id') is not None
    }

    def labels_for(ids):
        return ', '.join(label_by_id.get(step_id, str(step_id)) for step_id in (ids or []))

    rows = []
    for step in steps or []:
        rows.append([
            step.get('label', ''),
            'Measure' if is_measure_step(step) else 'Step',
            labels_for(step.get('previous')),
            labels_for(step.get('next')),
            step.get('instructions', ''),
            step.get('sample_proportion', 100),
            ', '.join(m.get('title', '') for m in step.get('measures') or [] if isinstance(m, dict)),
            step.get('temperature', 'N/A'),
            step.get('id', ''),
        ])
    return rows


class _SheetWriter:
    """Appends styled rows to a worksheet, tracking the current row."""

    def __init__(self, sheet):
        self.sheet = sheet
        self.row = 1

    def title(self, text, font=SECTION_FONT):
        self.sheet.cell(row=self.row, column=1, value=text).font = font
        self.row += 1

    def header(self, labels):
        for col, label in enumerate(labels, start=1):
            cell = self.sheet.cell(row=self.row, column=col, value=label)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL
            cell.alignment = CELL_ALIGNMENT
        self.row += 1

    def values(self, values, bold_first=False):
        for col, value in enumerate(values, start=1):
            cell = self.sheet.cell(row=self.row, column=col, value=value)
            cell.alignment = CELL_ALIGNMENT
            if bold_first and col == 1:
                cell.font = HEADER_FONT
        self.row += 1

    def gap(self):
        self.row += 1


def write_summary_sheet(workbook, spec):
    """
    Add the Summary sheet to `workbook` as its first tab.

    `spec` carries title, run_date, model, num_personas, sample_name,
    study_introduction, attributes (the sample's stored attributes) and
    steps (the ordered design); any of them may be missing.
    """
    spec = spec or {}
    sheet = workbook.create_sheet(SHEET_NAME, 0)
    for col, width in enumerate(COLUMN_WIDTHS, start=1):
        sheet.column_dimensions[sheet.cell(row=1, column=col).column_letter].width = width

    out = _SheetWriter(sheet)
    out.title(spec.get('title') or 'Simulation summary', font=TITLE_FONT)
    out.gap()

    out.title('Simulation overview')
    for key, value in [
        ('Title', spec.get('title', '')),
        ('Run date', spec.get('run_date', '')),
        ('Model', spec.get('model', '')),
        ('Number of personas', spec.get('num_personas', '')),
        ('Sample', spec.get('sample_name', '')),
        ('Study introduction', spec.get('study_introduction', '')),
    ]:
        out.values([key, value], bold_first=True)
    out.gap()

    out.title('Sample characteristics')
    out.header(['Category', 'Characteristic', 'Type', 'Option', 'Target'])
    attributes = [a for a in spec.get('attributes') or [] if isinstance(a, dict)]
    if attributes:
        for attribute in attributes:
            for row in attribute_rows(attribute):
                out.values(row)
    else:
        out.values(['No sample characteristics'])
    out.gap()

    steps = spec.get('steps') or []
    out.title('Measures')
    out.header(['Measure', 'Definition', 'Anchor points', 'Items', 'Citation'])
    measures = unique_measures(steps)
    if measures:
        for measure in measures:
            out.values([
                measure.get('title', ''),
                measure.get('description', ''),
                format_anchors(measure),
                format_items(measure),
                measure.get('citation') or '',
            ], bold_first=True)
    else:
        out.values(['No measures'])
    out.gap()

    out.title('Steps')
    out.header([
        'Step', 'Kind', 'Previous', 'Next', 'Instructions',
        'Sample %', 'Measures', 'Temperature', 'ID',
    ])
    for row in step_rows(steps):
        out.values(row, bold_first=True)

    return sheet
