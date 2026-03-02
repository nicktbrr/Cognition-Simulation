"use client";

import { useEffect, useCallback } from "react";
import { supabase } from "../utils/supabase";

export interface ExperimentProgressUpdate {
  progress: number;
  status: string;
  url: string | null;
  isComplete: boolean;
  isFailed: boolean;
  id?: number;
  created_at?: string;
  experiment_data?: { title?: string; simulation_name?: string };
}

function normalizeProgress(value: number | undefined | null): number {
  if (value == null) return 0;
  if (value <= 1 && value > 0) return value * 100;
  return value;
}

/**
 * Subscribe to progress updates for multiple experiments via Supabase Realtime.
 * Uses a single channel with experiment_id=in.(...) filter when multiple IDs.
 *
 * @param experimentIds - List of experiment_id (UUID) to track
 * @param userId - user_id for ownership check
 * @param onProgress - Callback when any experiment's progress changes
 */
export function useExperimentsProgress(
  experimentIds: string[],
  userId: string | null,
  onProgress: (experimentId: string, update: ExperimentProgressUpdate) => void
) {
  const stableOnProgress = useCallback(onProgress, []);

  useEffect(() => {
    if (!userId || experimentIds.length === 0) return;

    const handlePayload = (
      experimentId: string,
      row: {
        progress?: number;
        status?: string;
        url?: string;
        user_id?: string;
        id?: number;
        created_at?: string;
        experiment_data?: { title?: string; simulation_name?: string };
      }
    ) => {
      if (row.user_id !== userId) return;

      const progress = normalizeProgress(row.progress);
      const status = row.status ?? "";
      const isComplete =
        progress >= 100 ||
        ["completed", "done", "finished"].includes(status.toLowerCase());
      const isFailed = status.toLowerCase() === "failed";

      stableOnProgress(experimentId, {
        progress,
        status,
        url: row.url ?? null,
        isComplete,
        isFailed,
        id: row.id,
        created_at: row.created_at,
        experiment_data: row.experiment_data,
      });
    };

    if (experimentIds.length === 1) {
      const experimentId = experimentIds[0];
      const channel = supabase
        .channel(`experiment-${experimentId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "experiments",
            filter: `experiment_id=eq.${experimentId}`,
          },
          (payload) => {
            const row = payload.new as {
              progress?: number;
              status?: string;
              url?: string;
              user_id?: string;
            };
            handlePayload(experimentId, row);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    // Multiple experiments: use in filter (max 100 values per Supabase docs)
    const ids = experimentIds.slice(0, 100);
    const channel = supabase
      .channel(`experiments-${ids[0]}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "experiments",
          filter: `experiment_id=in.(${ids.join(",")})`,
        },
        (payload) => {
          const row = payload.new as {
            experiment_id?: string;
            progress?: number;
            status?: string;
            url?: string;
            user_id?: string;
          };
          const experimentId = row.experiment_id;
          if (experimentId && experimentIds.includes(experimentId)) {
            handlePayload(experimentId, row);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [experimentIds.join(","), userId, stableOnProgress]);
}
