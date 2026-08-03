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

export interface AttributeOption {
  id: string;
  label: string;
}

export interface Attribute {
  id: string;
  label: string;
  category: string;
  options?: AttributeOption[];
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

export const getOptionLabel = (attributeId: string, optionId: string): string => {
  const attribute = attributesById.get(attributeId);
  const option = attribute?.options?.find((opt) => opt.id === optionId);
  return option?.label || optionId;
};

// The Samples page stores Age as a single "18 - 25 years old" range value
// rather than one entry per selected age.
export const formatAgeRange = (optionIds: string[]): string => {
  const ages = optionIds
    .map((id) => parseInt(id, 10))
    .filter((age) => !Number.isNaN(age))
    .sort((a, b) => a - b);
  if (ages.length === 0) return "";
  const min = ages[0];
  const max = ages[ages.length - 1];
  return `${min} - ${max} years old`;
};

/**
 * Convert selected attribute/option ids into the `attributes` JSON shape the
 * samples table stores: [{ label, category, values }].
 */
export const toSampleAttributesJson = (
  selections: Array<{ attributeId: string; optionIds: string[] }>
): Array<{ label: string; category: string; values: string[] }> =>
  selections
    .map((selection) => {
      const attribute = attributesById.get(selection.attributeId);
      if (!attribute) return null;

      const values =
        attribute.id === "age"
          ? [formatAgeRange(selection.optionIds)].filter(Boolean)
          : selection.optionIds.map((optionId) => getOptionLabel(attribute.id, optionId));

      if (values.length === 0) return null;

      return { label: attribute.label, category: attribute.category, values };
    })
    .filter(Boolean) as Array<{ label: string; category: string; values: string[] }>;
