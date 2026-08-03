import { supabase } from "./supabase";

/**
 * Billing helpers for the Account → Billing tab.
 *
 * Every completed simulation writes one row to the `tokens` table
 * (`backend/app.py`), holding the input/output token counts and the raw LLM
 * token cost (`total_cost`). We surface each of those rows as a debit on the
 * billing page: what the simulation cost = token cost + a flat server fee.
 */

/**
 * Flat infrastructure fee added to every simulation on top of the raw token
 * cost. Kept as a single constant so the charge can be re-priced in one place.
 */
export const SERVER_FEE_PER_SIMULATION = 0.05;

export interface SimulationCharge {
  /** tokens.id (one row per simulation). */
  id: string;
  experimentId: string;
  title: string;
  /** Pre-formatted date for display, e.g. "Apr 5, 2026". */
  date: string;
  /** Raw ISO timestamp for sorting against credit purchases. */
  createdAt: string | null;
  promptInputToken: number;
  promptOutputToken: number;
  evalInputToken: number;
  evalOutputToken: number;
  totalTokens: number;
  /** Raw LLM token cost from tokens.total_cost (the "cost of tokens"). */
  tokenCost: number;
  /** Flat server/infrastructure fee for this simulation. */
  serverCost: number;
  /** What the user is charged: tokenCost + serverCost. */
  totalCost: number;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const num = (value: unknown): number => {
  const n = typeof value === "string" ? parseFloat(value) : (value as number);
  return typeof n === "number" && !Number.isNaN(n) ? n : 0;
};

/**
 * Fetch every simulation charge for a user: the token usage/cost rows joined
 * with their experiment's title and creation date. Sorted newest-first.
 *
 * Returns `[]` if the `tokens` rows aren't readable (e.g. row-level security
 * hides them from the browser client) so the billing page degrades gracefully.
 */
export async function fetchSimulationCharges(
  userId: string
): Promise<SimulationCharge[]> {
  const { data: tokenRows, error } = await supabase
    .from("tokens")
    .select(
      "id, experiment_id, prompt_input_token, prompt_output_token, " +
        "eval_input_token, eval_output_token, total_tokens, total_cost"
    )
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching simulation charges:", error);
    return [];
  }
  if (!tokenRows || tokenRows.length === 0) return [];

  // Pull the matching experiments for a human title + a real timestamp
  // (the tokens row itself has no title/date we can rely on).
  const experimentIds = Array.from(
    new Set(
      (tokenRows as any[])
        .map((r) => r.experiment_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const expMeta = new Map<string, { title: string; createdAt: string | null }>();
  if (experimentIds.length > 0) {
    const { data: exps } = await supabase
      .from("experiments")
      .select("experiment_id, created_at, experiment_data, simulation_name")
      .in("experiment_id", experimentIds);
    for (const row of (exps ?? []) as any[]) {
      const expData = row.experiment_data || {};
      expMeta.set(row.experiment_id, {
        title: expData.title || row.simulation_name || "Simulation",
        createdAt: row.created_at ?? null,
      });
    }
  }

  const charges: SimulationCharge[] = (tokenRows as any[]).map((r) => {
    const meta = expMeta.get(r.experiment_id) ?? {
      title: "Simulation",
      createdAt: null,
    };
    const tokenCost = num(r.total_cost);
    const serverCost = SERVER_FEE_PER_SIMULATION;
    return {
      id: String(r.id ?? r.experiment_id),
      experimentId: r.experiment_id,
      title: meta.title,
      date: formatDate(meta.createdAt),
      createdAt: meta.createdAt,
      promptInputToken: num(r.prompt_input_token),
      promptOutputToken: num(r.prompt_output_token),
      evalInputToken: num(r.eval_input_token),
      evalOutputToken: num(r.eval_output_token),
      totalTokens: num(r.total_tokens),
      tokenCost,
      serverCost,
      totalCost: Math.round((tokenCost + serverCost) * 1e6) / 1e6,
    };
  });

  // Newest first; rows without a timestamp sink to the bottom.
  charges.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return charges;
}
