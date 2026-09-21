/**
 * The shape of a measure, shared by every page that reads or writes one.
 *
 * A measure is used two ways. As a **rating** it is picked in a step's
 * Measures list and scored by the evaluator after the run. As a **scale** it
 * becomes its own node on the canvas and is put to the persona during the run,
 * one answer per item. `scaleOnly` marks a measure that can only be used the
 * second way.
 */

export interface DesiredValue {
  /** A point on the scale, e.g. 1. */
  value: number;
  /** What that point means, e.g. "strongly disagree". */
  label: string;
}

/** A question the persona answers, e.g. "I believe in universal childcare". */
export interface MeasureItem {
  id: string;
  text: string;
}

export interface Measure {
  id: string;
  title: string;
  /** Stored as `definition` in the database. */
  description: string;
  /** "min - max", derived from the anchor points. */
  range: string;
  /** The anchor points: the answers the persona can choose between. */
  desiredValues: DesiredValue[];
  /** Where the measure comes from, e.g. "Amabile (1982)". Optional. */
  citation?: string;
  /** The questions the persona answers. Empty for a rating-only measure. */
  items?: MeasureItem[];
  /** True when the measure can only be used as a scale, never as a rating. */
  scaleOnly?: boolean;
  folder_id?: string | null;
  /** Set on the measures page: already used in a simulation, so not editable. */
  isLocked?: boolean;
}

/** A measure as the form hands it over, before the database assigns an id. */
export type MeasureDraft = Omit<Measure, 'id' | 'folder_id' | 'isLocked'>;
