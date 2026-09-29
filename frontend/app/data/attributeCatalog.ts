// Shared sample-attribute catalogue.
//
// This is the single source of truth for the attribute list used by the
// Samples page (NewSampleModal) and by the PDF import review step, so both
// offer exactly the same attributes, categories, and option values.

import otherAttributesData from "./attributes/other.json";
import demographicsAttributesData from "./attributes/demographics.json";
import healthAttributesData from "./attributes/health.json";
import languageAttributesData from "./attributes/language.json";
import workAttributesData from "./attributes/work.json";
import educationAttributesData from "./attributes/education.json";
import beliefsAttributesData from "./attributes/belief.json";
import geographyAttributesData from "./attributes/geographic.json";
import familyAttributesData from "./attributes/family.json";
import shoppingAttributesData from "./attributes/shopping.json";
import financeAttributesData from "./attributes/finance.json";
import lifestyleAttributesData from "./attributes/lifestyle.json";
import technologyAttributesData from "./attributes/technology.json";
import {
  defaultContinuous,
  formatRange,
  rebalanceCategorical,
  type Distribution,
  type SampleAttributeJson,
} from "../utils/distributions";

export interface AttributeOption {
  id: string;
  label: string;
}

export interface Attribute {
  id: string;
  label: string;
  category: string;
  options?: AttributeOption[];
  /**
   * Continuous attributes (Age and the numeric counts) are drawn from a
   * min/max/mean/SD curve instead of a split across chosen options. `min`
   * and `max` are the widest range the user may pick.
   */
  type?: "categorical" | "continuous";
  min?: number;
  max?: number;
  unit?: string;
}

export interface AttributeCategory {
  name: string;
  attributes: Attribute[];
  expanded: boolean;
}

export const demographicsAttributes = demographicsAttributesData as Attribute[];
export const healthAttributes = healthAttributesData as Attribute[];
export const workAttributes = workAttributesData as Attribute[];
export const educationAttributes = educationAttributesData as Attribute[];
export const beliefsAttributes = beliefsAttributesData as Attribute[];
export const familyAttributes = familyAttributesData as Attribute[];
export const shoppingAttributes = shoppingAttributesData as Attribute[];
export const financeAttributes = financeAttributesData as Attribute[];
export const lifestyleAttributes = lifestyleAttributesData as Attribute[];
export const technologyAttributes = technologyAttributesData as Attribute[];
export const geographicAttributes = geographyAttributesData as Attribute[];
export const languageAttributes = languageAttributesData as Attribute[];
export const otherAttributes = otherAttributesData as Attribute[];

export const allCategories: AttributeCategory[] = [
  { name: "Demographics", attributes: demographicsAttributes, expanded: true },
  { name: "Health", attributes: healthAttributes, expanded: false },
  { name: "Work", attributes: workAttributes, expanded: false },
  { name: "Education", attributes: educationAttributes, expanded: false },
  { name: "Beliefs", attributes: beliefsAttributes, expanded: false },
  { name: "Family & Relationships", attributes: familyAttributes, expanded: false },
  { name: "Shopping and consumer habits", attributes: shoppingAttributes, expanded: false },
  { name: "Finance", attributes: financeAttributes, expanded: false },
  { name: "Lifestyle and Interests", attributes: lifestyleAttributes, expanded: false },
  { name: "Technology and Online Behavior", attributes: technologyAttributes, expanded: false },
  { name: "Geographic", attributes: geographicAttributes, expanded: false },
  { name: "Languages", attributes: languageAttributes, expanded: false },
  { name: "Other", attributes: otherAttributes, expanded: false },
];

// Flat lookup of every attribute, keyed by attribute id
const attributesById = new Map<string, Attribute>();
allCategories.forEach((category) => {
  category.attributes.forEach((attribute) => {
    attributesById.set(attribute.id, attribute);
  });
});

export const getAttributeById = (attributeId: string): Attribute | undefined =>
  attributesById.get(attributeId);

/** The catalogue attribute a stored `{label, category}` row came from. */
export const getAttributeByLabel = (label: string, category?: string): Attribute | undefined => {
  let fallback: Attribute | undefined;
  for (const attribute of attributesById.values()) {
    if (attribute.label !== label) continue;
    if (!category || attribute.category.toLowerCase() === category.toLowerCase()) return attribute;
    fallback = fallback ?? attribute;
  }
  return fallback;
};

export const isContinuous = (attribute: Attribute | undefined): boolean =>
  attribute?.type === "continuous";

/** The range a continuous attribute may take: [min, max] from the catalogue. */
export const continuousBounds = (attribute: Attribute) => ({
  min: attribute.min ?? 0,
  max: attribute.max ?? 100,
});

export const getOptionLabel = (attributeId: string, optionId: string): string => {
  const attribute = attributesById.get(attributeId);
  const option = attribute?.options?.find((opt) => opt.id === optionId);
  return option?.label || optionId;
};

// A continuous attribute picked as option ids (e.g. from a PDF import) spans
// the lowest to highest numeric option chosen; anything without a number
// ("Rather not say") is ignored.
const numericRange = (attribute: Attribute, optionIds: string[]): [number, number] => {
  const numbers = optionIds
    .map((optionId) => parseInt(getOptionLabel(attribute.id, optionId), 10))
    .filter((value) => !Number.isNaN(value));
  const bounds = continuousBounds(attribute);
  if (numbers.length === 0) return [bounds.min, bounds.max];
  const lo = Math.max(bounds.min, Math.min(...numbers));
  const hi = Math.min(bounds.max, Math.max(...numbers));
  return lo < hi ? [lo, hi] : [bounds.min, bounds.max];
};

/**
 * Convert selected attribute/option ids into the `attributes` JSON shape the
 * samples table stores: [{ label, category, values, distribution }].
 *
 * A continuous attribute stores its range as one "min - max unit" value; its
 * distribution is the one given, or the default curve over the chosen range.
 * A categorical attribute stores its option labels, split as given or evenly.
 */
export const toSampleAttributesJson = (
  selections: Array<{ attributeId: string; optionIds: string[]; distribution?: Distribution }>
): SampleAttributeJson[] =>
  selections
    .map((selection): SampleAttributeJson | null => {
      const attribute = attributesById.get(selection.attributeId);
      if (!attribute) return null;
      const { label, category } = attribute;

      if (isContinuous(attribute)) {
        const distribution =
          selection.distribution?.type === "continuous"
            ? selection.distribution
            : defaultContinuous(...numericRange(attribute, selection.optionIds));
        return {
          label,
          category,
          values: [formatRange(distribution.min, distribution.max, attribute.unit)],
          distribution,
        };
      }

      const values = selection.optionIds.map((optionId) => getOptionLabel(attribute.id, optionId));
      if (values.length === 0) return null;
      return {
        label,
        category,
        values,
        distribution: rebalanceCategorical(selection.distribution, values),
      };
    })
    .filter((attribute): attribute is SampleAttributeJson => attribute !== null);
