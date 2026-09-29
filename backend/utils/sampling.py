"""
Build a sample's personas so they match the distributions the user set.

Every attribute stored on a sample has a distribution:

    categorical: {"type": "categorical", "percentages": {"<value label>": 60, ...}}
    continuous:  {"type": "continuous", "min": 18, "max": 82, "mean": 50, "sd": 10.7}

Rows saved before distributions existed have none; `resolve_distribution`
gives them the defaults (an even split, or for Age a normal curve centred in
the stored range), mirroring `ensureDistribution` in
`frontend/app/utils/distributions.ts`.

Personas are built column by column so the sample hits the distribution
exactly rather than on average: a categorical attribute gets whole-number
quotas (60% of 20 is exactly 12 personas), and a continuous attribute gets
normal quantiles whose mean and SD are the ones requested, kept within
[min, max]. Each column is shuffled on
its own so attributes are not correlated with each other.
"""

import math
import random
import re
import statistics
from statistics import NormalDist

from utils.graph import largest_remainder_counts


def _default_sd(minimum, maximum):
    return round((maximum - minimum) / 6.0, 1)


def _parse_range(values):
    """Pull (min, max) out of a legacy range string like "18 - 35 years old"."""
    if not values or not isinstance(values[0], str):
        return None
    numbers = re.findall(r'\d+', values[0])
    if len(numbers) >= 2:
        return int(numbers[0]), int(numbers[1])
    return None


def _to_float(value, default):
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return default if math.isnan(result) else result


def resolve_distribution(attribute):
    """
    Return the attribute's distribution, filling in the default when it has
    none or it is malformed.
    """
    values = attribute.get('values') or []
    distribution = attribute.get('distribution')

    if isinstance(distribution, dict) and distribution.get('type') == 'continuous':
        parsed = _parse_range(values) or (0, 0)
        minimum = _to_float(distribution.get('min'), parsed[0])
        maximum = _to_float(distribution.get('max'), parsed[1])
        if maximum < minimum:
            minimum, maximum = maximum, minimum
        mean = _to_float(distribution.get('mean'), (minimum + maximum) / 2.0)
        sd = _to_float(distribution.get('sd'), _default_sd(minimum, maximum))
        return {
            'type': 'continuous',
            'min': minimum,
            'max': maximum,
            'mean': min(max(mean, minimum), maximum),
            'sd': max(0.0, sd),
        }

    if distribution is None and attribute.get('label') == 'Age':
        parsed = _parse_range(values)
        if parsed:
            minimum, maximum = sorted(parsed)
            return {
                'type': 'continuous',
                'min': minimum,
                'max': maximum,
                'mean': (minimum + maximum) / 2.0,
                'sd': _default_sd(minimum, maximum),
            }

    percentages = {}
    if isinstance(distribution, dict) and isinstance(distribution.get('percentages'), dict):
        percentages = distribution['percentages']
    # A value with no stored percent comes in at an even share, matching
    # `rebalanceCategorical` in the frontend.
    even_share = 100.0 / len(values) if values else 0.0
    weights = [max(0.0, _to_float(percentages.get(value), even_share)) for value in values]
    if sum(weights) <= 0:
        weights = [1.0] * len(values)
    return {
        'type': 'categorical',
        'percentages': {value: weight for value, weight in zip(values, weights)},
    }


def categorical_quota(values, distribution, n):
    """The ordered column of values: each repeated its whole-number quota."""
    weights = [distribution['percentages'][value] for value in values]
    total = sum(weights)
    counts = largest_remainder_counts(n, [w / total for w in weights])
    column = []
    for value, count in zip(values, counts):
        column.extend([value] * count)
    return column


def continuous_quota(distribution, n):
    """
    The sorted column of n whole numbers whose mean and SD match the
    distribution. Evenly spaced normal quantiles are standardised to exactly
    mean 0 and SD 1 (raw quantiles understate the spread of a small sample),
    scaled to the requested mean and SD, then clamped to [min, max].
    """
    lo = math.ceil(distribution['min'])
    hi = math.floor(distribution['max'])
    mean, sd = distribution['mean'], distribution['sd']

    if sd <= 0 or hi <= lo or n < 2:
        return [min(max(int(round(mean)), lo), hi)] * n

    standard = NormalDist()
    z = [standard.inv_cdf((i + 0.5) / n) for i in range(n)]
    z_sd = statistics.pstdev(z)
    return [min(max(int(round(mean + sd * zi / z_sd)), lo), hi) for zi in z]


def _column(attribute, n):
    values = attribute.get('values') or []
    distribution = resolve_distribution(attribute)
    if distribution['type'] == 'continuous':
        return [str(value) for value in continuous_quota(distribution, n)]
    if not values:
        return None
    return categorical_quota(values, distribution, n)


def generate_personas(attributes, n, rng=None):
    """
    Build exactly `n` personas matching the attributes' distributions.

    Returns a list of dicts like {'number': 1, 'Age': '24', 'Gender': 'Man (...)'}.
    """
    rng = rng or random.Random()
    personas = [{'number': i + 1} for i in range(n)]
    for attribute in attributes or []:
        column = _column(attribute, n)
        if column is None:
            continue
        rng.shuffle(column)
        for persona, value in zip(personas, column):
            persona[attribute.get('label')] = value
    return personas


def personas_match(personas, attributes, n):
    """
    True when a cached persona list is exactly what `generate_personas` would
    produce for these attributes and size, up to the shuffle.
    """
    if not isinstance(personas, list) or len(personas) != n:
        return False
    if not all(isinstance(persona, dict) for persona in personas):
        return False

    for attribute in attributes or []:
        expected = _column(attribute, n)
        if expected is None:
            continue
        label = attribute.get('label')
        actual = [persona.get(label) for persona in personas]
        if any(value is None for value in actual):
            return False
        if sorted(map(str, actual)) != sorted(map(str, expected)):
            return False
    return True
