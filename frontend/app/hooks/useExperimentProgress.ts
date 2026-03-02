"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../utils/supabase";

export interface ExperimentProgressState {
  progress: number | null;
  status: string;
  url: string | null;
  isComplete: boolean;
  isFailed: boolean;
}

function normalizeProgress(value: number | undefined | null): number {
  if (value == null) return 0;
  if (value <= 1 && value > 0) return value * 100;
  return value;
}

function isCompleteStatus(status: string, progress: number): boolean {
  const s = status?.toLowerCase() ?? "";
  return (
    progress >= 100 ||
    s === "completed" ||
    s === "done" ||
    s === "finished"
  );
}

function isFailedStatus(status: string): boolean {
  const s = status?.toLowerCase() ?? "";
  return s === "failed";
}

/**
 * Subscribe to experiment progress via Supabase Realtime (Postgres changes).
 * Replaces database polling with WebSocket push updates.
 *
 * @param experimentId - experiment_id (UUID) to track
 * @param userId - user_id for ownership check
 * @param enabled - whether to subscribe (e.g. when simulation is running)
 */
export function useExperimentProgress(
  experimentId: string | null,
  userId: string | null,
  enabled: boolean
): ExperimentProgressState {
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");
  const [url, setUrl] = useState<string | null>(null);

  const handlePayload = useCallback(
    (row: {
      progress?: number;
      status?: string;
      url?: string;
      user_id?: string;
    }) => {
      if (userId && row.user_id !== userId) return;

      const progressPercent = normalizeProgress(row.progress);
      const st = row.status ?? "";

      setProgress(progressPercent);
      setStatus(st);
      if (row.url != null) setUrl(row.url);
    },
    [userId]
  );

  useEffect(() => {
    if (!experimentId || !userId || !enabled) {
      return;
    }

    // Fetch current state once (in case we're reconnecting to an in-progress run)
    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from("experiments")
        .select("progress, status, url")
        .eq("experiment_id", experimentId)
        .eq("user_id", userId)
        .single();

      if (!error && data) {
        handlePayload(data);
      }
    };
    fetchInitial();

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
          handlePayload(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [experimentId, userId, enabled, handlePayload]);

  const progressVal = progress ?? 0;
  const isComplete = isCompleteStatus(status, progressVal);
  const isFailed = isFailedStatus(status);

  return {
    progress,
    status,
    url,
    isComplete,
    isFailed,
  };
}
