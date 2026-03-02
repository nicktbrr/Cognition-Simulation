"""
Thread-safe progress updater for evaluation workflows.
Used by baseline_prompt and evaluate to report progress to Supabase
as rows complete in ThreadPoolExecutor as_completed loops.
"""

import threading
from typing import Any, Callable, Optional


def create_progress_updater(
    uuid: str,
    supabase: Any,
    min_pct: float,
    max_pct: float,
    total_items: int,
    *,
    get_client: Optional[Callable] = None,
    jwt: Optional[str] = None,
    no_throttle: bool = False,
):
    """
    Returns a callback for as_completed loops. Thread-safe.

    Args:
        uuid: experiment_id for the row to update
        supabase: Supabase client instance (or fallback when get_client not used)
        min_pct: Start of progress range (e.g. 10)
        max_pct: End of progress range (e.g. 30)
        total_items: Total number of items to process
        get_client: Optional factory (e.g. get_supabase_client) for fresh client per write (thread-safe)
        jwt: JWT to pass to get_client when creating client
        no_throttle: If True, write on every completion (for long-running phases like evaluate)

    Returns:
        Callable that should be invoked after each item completes
    """
    lock = threading.Lock()
    completed = [0]  # mutable for closure
    last_written = [min_pct]

    def _get_client():
        if get_client and jwt is not None:
            return get_client(jwt)
        return supabase

    def on_item_completed():
        with lock:
            completed[0] += 1
            pct = min_pct + (max_pct - min_pct) * (completed[0] / total_items) if total_items > 0 else max_pct
            # Write: every time if no_throttle, else when +1% or last item
            should_write = (
                no_throttle or
                pct - last_written[0] >= 1 or
                completed[0] >= total_items
            )
            if should_write:
                last_written[0] = pct
                pct_to_write = round(pct)
            else:
                pct_to_write = None
        if pct_to_write is not None:
            try:
                client = _get_client()
                print(f"[progress] Writing progress: {pct_to_write}", flush=True)
                client.table("experiments").update({"progress": pct_to_write}).eq("experiment_id", uuid).execute()
            except Exception:
                pass  # Don't fail evaluation on progress write errors

    return on_item_completed
