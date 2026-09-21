/**
 * Reading and writing measures.
 *
 * The database columns and the shape the app uses don't line up - `definition`
 * is the app's `description`, and `min`/`max` become the `range` string - so
 * every page that touched measures used to carry its own copy of the mapping.
 * This is that mapping, once.
 */

import { supabase } from './supabase';
import type { DesiredValue, Measure, MeasureDraft, MeasureItem } from '../types/measure';

/**
 * Coerce whatever is in the `items` column into items with stable ids.
 *
 * Rows written before items existed have no column at all; rows written by
 * hand may hold plain strings. Both read as items rather than breaking the
 * page.
 */
export function normalizeItems(raw: unknown): MeasureItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (typeof entry === 'string') {
        return { id: newItemId(), text: entry };
      }
      if (entry && typeof entry === 'object') {
        const text = (entry as any).text;
        if (typeof text !== 'string') return null;
        const id = (entry as any).id;
        return { id: typeof id === 'string' && id ? id : newItemId(), text };
      }
      return null;
    })
    .filter((item): item is MeasureItem => item !== null && item.text.trim() !== '');
}

/** An id for a new item row - only ever used as a React key and a stable handle. */
export function newItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `item-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * The scale's range, read off its anchor points.
 *
 * The anchors are the answers a persona can pick, so they are the scale: the
 * lowest and highest anchor are its ends. A measure with fewer than two
 * anchors has no range to speak of and falls back to 0 - 10, which is what the
 * backend assumes when it can't parse one.
 */
export function deriveRange(desiredValues: DesiredValue[]): { min: number; max: number; range: string } {
  const values = (desiredValues || [])
    .map((anchor) => Number(anchor.value))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) return { min: 0, max: 10, range: '0 - 10' };

  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, range: `${min} - ${max}` };
}

/** Turn a `measures` row into the shape the app uses. */
export function mapMeasureRow(row: any, extras: Partial<Measure> = {}): Measure {
  return {
    id: row.id,
    title: row.title,
    description: row.definition,
    range: `${row.min} - ${row.max}`,
    desiredValues: row.desired_values || [],
    citation: row.citation || '',
    items: normalizeItems(row.items),
    scaleOnly: row.scale_only === true,
    ...extras,
  };
}

/** The columns a draft writes, shared by insert and update. */
const measureColumns = (measure: MeasureDraft) => {
  const { min, max } = deriveRange(measure.desiredValues);
  return {
    title: measure.title,
    definition: measure.description,
    min,
    max,
    desired_values: measure.desiredValues,
    citation: measure.citation || null,
    items: measure.items || [],
    scale_only: measure.scaleOnly === true,
  };
};

/**
 * What went wrong, in words worth showing someone.
 *
 * `citation`, `items` and `scale_only` are newer than most databases this
 * runs against, and PostgREST rejects the whole write when a column is
 * missing rather than ignoring it - so say which one, instead of failing
 * silently.
 */
export function describeMeasureError(error: any): string {
  const message = String(error?.message || error || 'Unknown error');
  if (/column .* does not exist|could not find the .* column/i.test(message)) {
    return (
      'This database is missing the citation, items or scale_only column on ' +
      'the measures table. Add them in Supabase, then try again.'
    );
  }
  return message;
}

/**
 * Create a measure.
 *
 * Throws with a readable message when the write fails, so the caller can put
 * it in front of whoever was filling the form.
 */
export async function createMeasure(userId: string, measure: MeasureDraft): Promise<Measure | null> {
  const { data, error } = await supabase
    .from('measures')
    .insert({ user_id: userId, ...measureColumns(measure) })
    .select()
    .single();

  if (error) {
    console.error('Error creating measure:', error);
    throw new Error(describeMeasureError(error));
  }

  // A measure that has never been in a simulation can't be locked yet.
  return mapMeasureRow(data, { isLocked: false });
}

/** Update a measure in place. Throws with a readable message on failure. */
export async function updateMeasure(id: string, measure: MeasureDraft): Promise<Measure | null> {
  const { data, error } = await supabase
    .from('measures')
    .update(measureColumns(measure))
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating measure:', error);
    throw new Error(describeMeasureError(error));
  }

  return mapMeasureRow(data);
}
