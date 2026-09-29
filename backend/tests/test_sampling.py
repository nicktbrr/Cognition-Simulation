"""Run with: cd backend && python -m unittest discover tests"""

import random
import statistics
import unittest
from collections import Counter

from utils.sampling import (
    continuous_quota,
    generate_personas,
    personas_match,
    resolve_distribution,
)


GENDER = {
    'label': 'Gender',
    'category': 'demographics',
    'values': ['Man', 'Woman'],
    'distribution': {'type': 'categorical', 'percentages': {'Man': 60, 'Woman': 40}},
}

AGE = {
    'label': 'Age',
    'category': 'demographics',
    'values': ['20 - 60 years old'],
    'distribution': {'type': 'continuous', 'min': 20, 'max': 60, 'mean': 30, 'sd': 5},
}


class CategoricalTests(unittest.TestCase):
    def test_exact_quotas(self):
        personas = generate_personas([GENDER], 20, random.Random(1))
        counts = Counter(p['Gender'] for p in personas)
        self.assertEqual(counts, {'Man': 12, 'Woman': 8})

    def test_rounding_sums_to_n(self):
        attribute = {
            'label': 'Colour',
            'values': ['Red', 'Green', 'Blue'],
            'distribution': {'type': 'categorical', 'percentages': {'Red': 33, 'Green': 33, 'Blue': 34}},
        }
        personas = generate_personas([attribute], 10, random.Random(2))
        counts = Counter(p['Colour'] for p in personas)
        self.assertEqual(sum(counts.values()), 10)
        self.assertTrue(all(3 <= c <= 4 for c in counts.values()))

    def test_zero_percent_value_never_appears(self):
        attribute = {
            'label': 'Pet',
            'values': ['Cat', 'Dog'],
            'distribution': {'type': 'categorical', 'percentages': {'Cat': 100, 'Dog': 0}},
        }
        personas = generate_personas([attribute], 15, random.Random(3))
        self.assertTrue(all(p['Pet'] == 'Cat' for p in personas))

    def test_legacy_row_is_even_split(self):
        legacy = {'label': 'Gender', 'category': 'demographics', 'values': ['Man', 'Woman']}
        personas = generate_personas([legacy], 10, random.Random(4))
        self.assertEqual(Counter(p['Gender'] for p in personas), {'Man': 5, 'Woman': 5})


class ContinuousTests(unittest.TestCase):
    def test_mean_sd_and_bounds(self):
        personas = generate_personas([AGE], 50, random.Random(5))
        ages = [int(p['Age']) for p in personas]
        self.assertTrue(all(20 <= a <= 60 for a in ages))
        self.assertAlmostEqual(statistics.mean(ages), 30, delta=0.5)
        self.assertAlmostEqual(statistics.pstdev(ages), 5, delta=0.3)

    def test_zero_sd(self):
        dist = {'type': 'continuous', 'min': 0, 'max': 10, 'mean': 3, 'sd': 0}
        self.assertEqual(continuous_quota(dist, 5), [3] * 5)

    def test_legacy_age_range_becomes_normal(self):
        legacy = {'label': 'Age', 'category': 'demographics', 'values': ['18 - 82 years old']}
        dist = resolve_distribution(legacy)
        self.assertEqual(dist['type'], 'continuous')
        self.assertEqual((dist['min'], dist['max'], dist['mean']), (18, 82, 50))
        personas = generate_personas([legacy], 30, random.Random(6))
        self.assertTrue(all(18 <= int(p['Age']) <= 82 for p in personas))


class PersonaShapeTests(unittest.TestCase):
    def test_numbered_and_uncorrelated_columns(self):
        personas = generate_personas([GENDER, AGE], 20, random.Random(7))
        self.assertEqual([p['number'] for p in personas], list(range(1, 21)))
        self.assertTrue(all(set(p) == {'number', 'Gender', 'Age'} for p in personas))


class CacheTests(unittest.TestCase):
    def test_matches_own_output(self):
        personas = generate_personas([GENDER, AGE], 20, random.Random(8))
        self.assertTrue(personas_match(personas, [GENDER, AGE], 20))

    def test_rejects_other_size(self):
        personas = generate_personas([GENDER], 20, random.Random(9))
        self.assertFalse(personas_match(personas, [GENDER], 25))

    def test_rejects_changed_percentages(self):
        personas = generate_personas([GENDER], 20, random.Random(10))
        changed = {**GENDER, 'distribution': {'type': 'categorical', 'percentages': {'Man': 50, 'Woman': 50}}}
        self.assertFalse(personas_match(personas, [changed], 20))

    def test_rejects_changed_continuous(self):
        personas = generate_personas([AGE], 20, random.Random(11))
        changed = {**AGE, 'distribution': {**AGE['distribution'], 'mean': 40}}
        self.assertFalse(personas_match(personas, [changed], 20))

    def test_rejects_old_pool_shape(self):
        self.assertFalse(personas_match(None, [GENDER], 10))
        self.assertFalse(personas_match('a persona string', [GENDER], 10))


if __name__ == '__main__':
    unittest.main()
