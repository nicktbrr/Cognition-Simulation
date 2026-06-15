"""
Pricing utility for LLM token cost calculation.

Supports multiple models with a fallback pricing table.
For Gemini 2.0 Flash, live rates can be fetched from the Google Cloud Billing
Catalog API when GCP_BILLING_API_KEY is set.
"""

import os
import json
import logging
from typing import Tuple
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

logger = logging.getLogger(__name__)

# Vertex AI service ID (includes Gemini 2.0 Flash)
VERTEX_AI_SERVICE_ID = "C7E2-9256-1C43"

# Gemini 2.0 Flash SKU IDs (Vertex API - Predictions, not Batch)
GEMINI_2_FLASH_INPUT_SKU = "1127-99B9-1860"   # Text Input - Predictions
GEMINI_2_FLASH_OUTPUT_SKU = "DFB0-8442-43A8"  # Text Output - Predictions

# Fallback rates (USD per 1M tokens) - Gemini 2.0 Flash, verified against the
# Cloud Billing Catalog API (Text Input/Output - Predictions) on 2026-06-02.
FALLBACK_INPUT_PER_MILLION = 0.15
FALLBACK_OUTPUT_PER_MILLION = 0.60

# Static pricing table (USD per 1M tokens) for all supported models.
# Used when live billing API rates are unavailable or for non-Gemini models.
MODEL_PRICING: dict = {
    "gemini-2.0-flash": {"input_per_million": 0.15, "output_per_million": 0.60},
    # Future models — uncomment and set correct rates when adding support:
    # "gpt-4o":                        {"input_per_million": 2.50,  "output_per_million": 10.00},
    # "gpt-4o-mini":                   {"input_per_million": 0.15,  "output_per_million": 0.60},
    # "claude-3-5-sonnet-20241022":    {"input_per_million": 3.00,  "output_per_million": 15.00},
    # "claude-3-5-haiku-20241022":     {"input_per_million": 0.80,  "output_per_million": 4.00},
}

# In-memory cache for rates (avoids API calls on every simulation)
_cached_rates: Tuple[float, float] | None = None


def _parse_price_per_token(pe: dict, price_per_unit: float) -> float:
    """
    Convert a Cloud Billing Catalog unit price to USD per token.

    Per the API spec (verified against the live Gemini 2.0 Flash SKUs):
      * ``unitPrice`` (units + nanos) is the price per ``usageUnit``.
      * ``baseUnitConversionFactor`` converts a usage unit into base units, so
        ``price_per_base_unit = unitPrice / baseUnitConversionFactor``. For the
        Gemini text SKUs the base unit is a single token (``usageUnit`` and
        ``baseUnit`` are both "count" with factor 1), so the per-token rate is
        simply ``unitPrice / baseUnitConversionFactor``.
      * ``displayQuantity`` (e.g. 1,000,000) is display-only — it controls how
        Google renders "$X per 1M" and must NOT be applied to the formula.

    The formula also handles SKUs expressed per larger unit (e.g. usageUnit
    "1M tokens" with baseUnitConversionFactor 1,000,000) without special-casing.
    """
    base_factor = pe.get("baseUnitConversionFactor")
    if not base_factor or base_factor <= 0:
        base_factor = 1
    return price_per_unit / base_factor


def _iter_skus(api_key: str):
    """
    Yield SKU dicts from the Cloud Billing Catalog API across all pages.

    The Vertex AI service has >5000 SKUs, so a single page does not contain
    every SKU (the Gemini text-output SKU lives on a later page). Following
    ``nextPageToken`` is required to reach them. Stops early on any request
    failure after logging it.
    """
    page_token = ""
    while True:
        url = (
            f"https://cloudbilling.googleapis.com/v1/services/{VERTEX_AI_SERVICE_ID}/skus"
            f"?currencyCode=USD&pageSize=5000"
        )
        if page_token:
            url += f"&pageToken={page_token}"
        try:
            # Pass the key via header rather than the query string so it can't
            # leak into proxy/access logs or error traces that capture the URL.
            req = Request(
                url,
                headers={"Accept": "application/json", "x-goog-api-key": api_key},
            )
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
        except (URLError, HTTPError, json.JSONDecodeError, OSError) as e:
            logger.warning("Cloud Billing Catalog API request failed: %s", e)
            return

        for sku in data.get("skus", []):
            yield sku

        page_token = data.get("nextPageToken") or ""
        if not page_token:
            return


def _fetch_sku_price(api_key: str, sku_id: str) -> float | None:
    """
    Fetch price per token for a SKU from Cloud Billing Catalog API.
    Returns USD per token, or None on failure / not found.
    """
    for sku in _iter_skus(api_key):
        if sku.get("skuId") != sku_id:
            continue
        pricing_info = sku.get("pricingInfo") or []
        if not pricing_info:
            continue
        pe = pricing_info[0].get("pricingExpression") or {}
        tiered = pe.get("tieredRates") or []
        if not tiered:
            continue
        rate = tiered[0]
        unit_price = rate.get("unitPrice") or {}
        units = int(unit_price.get("units", 0) or 0)
        nanos = int(unit_price.get("nanos", 0) or 0)
        price_per_unit = units + nanos / 1e9
        return _parse_price_per_token(pe, price_per_unit)

    # SKU IDs are hardcoded and can be deprecated/renamed by Google. If the
    # configured SKU is missing, the caller falls back to static rates silently;
    # log it so a stale SKU ID is visible rather than failing quietly.
    logger.warning(
        "SKU %s not found in Cloud Billing Catalog response for service %s",
        sku_id,
        VERTEX_AI_SERVICE_ID,
    )
    return None


def get_gemini_2_flash_rates() -> Tuple[float, float]:
    """
    Get input and output token rates (USD per token) for Gemini 2.0 Flash.
    Uses Cloud Billing Catalog API when GCP_BILLING_API_KEY is set.
    """
    global _cached_rates
    if _cached_rates is not None:
        return _cached_rates

    api_key = os.environ.get("GCP_BILLING_API_KEY", "").strip()
    input_per_token = None
    output_per_token = None

    if api_key:
        input_per_token = _fetch_sku_price(api_key, GEMINI_2_FLASH_INPUT_SKU)
        output_per_token = _fetch_sku_price(api_key, GEMINI_2_FLASH_OUTPUT_SKU)

    # Only cache when both rates came from the live API. Caching fallback rates
    # would let a transient API failure (or a not-yet-set key) lock the process
    # into fallback for its entire lifetime; instead we retry the API next call.
    if input_per_token is not None and output_per_token is not None:
        _cached_rates = (input_per_token, output_per_token)
        return _cached_rates

    if input_per_token is None:
        input_per_token = FALLBACK_INPUT_PER_MILLION / 1_000_000
        logger.debug("Using fallback input rate: $%.6f per token", input_per_token)
    if output_per_token is None:
        output_per_token = FALLBACK_OUTPUT_PER_MILLION / 1_000_000
        logger.debug("Using fallback output rate: $%.6f per token", output_per_token)

    return (input_per_token, output_per_token)


def compute_cost(
    input_tokens: int,
    output_tokens: int,
) -> float:
    """
    Compute total cost in USD for Gemini 2.0 Flash (uses Billing API or fallback).
    Kept for backward compatibility — prefer compute_cost_for_model for new code.
    """
    input_rate, output_rate = get_gemini_2_flash_rates()
    return (input_tokens * input_rate) + (output_tokens * output_rate)


def compute_cost_for_model(
    model_name: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """
    Compute total cost in USD for a given model using the MODEL_PRICING table.
    Falls back to Gemini 2.0 Flash rates if the model is not in the table.

    Args:
        model_name: LLM model identifier (e.g. "gemini-2.0-flash")
        input_tokens: Number of input/prompt tokens
        output_tokens: Number of output/completion tokens

    Returns:
        Total cost in USD
    """
    # For Gemini models, prefer the live billing API rates
    if model_name.startswith("gemini"):
        return compute_cost(input_tokens, output_tokens)

    rates = MODEL_PRICING.get(model_name)
    if rates is None:
        # Unknown model: pricing it at Gemini's rates silently would badly
        # mis-bill more expensive models, so make the fallback visible.
        logger.warning(
            "Model %r not in MODEL_PRICING; billing at Gemini 2.0 Flash rates",
            model_name,
        )
        rates = MODEL_PRICING["gemini-2.0-flash"]
    input_rate = rates["input_per_million"] / 1_000_000
    output_rate = rates["output_per_million"] / 1_000_000
    return (input_tokens * input_rate) + (output_tokens * output_rate)


def compute_prompt_and_eval_cost(
    prompt_input: int,
    prompt_output: int,
    eval_input: int,
    eval_output: int,
    model_name: str = "gemini-2.0-flash",
) -> Tuple[float, float]:
    """
    Compute prompt cost and eval cost separately for a given model.
    Returns (prompt_cost_usd, eval_cost_usd).
    """
    prompt_cost = compute_cost_for_model(model_name, prompt_input, prompt_output)
    eval_cost = compute_cost_for_model(model_name, eval_input, eval_output)
    return round(prompt_cost, 6), round(eval_cost, 6)
