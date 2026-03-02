"""
Pricing utility for Gemini 2.0 Flash using Google Cloud Billing Catalog API.

Fetches official list prices for input/output tokens and computes cost from token counts.
Falls back to hardcoded rates if the API is unavailable.

Set GCP_BILLING_API_KEY to fetch live rates from the Cloud Billing Catalog API.
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

# Fallback rates (USD per 1M tokens) - Gemini 2.0 Flash as of 2025
FALLBACK_INPUT_PER_MILLION = 0.10
FALLBACK_OUTPUT_PER_MILLION = 0.40

# In-memory cache for rates (avoids API calls on every simulation)
_cached_rates: Tuple[float, float] | None = None


def _parse_price_per_token(pe: dict, price_per_unit: float) -> float:
    """
    Convert API price to USD per token.
    Billing API may use usageUnit like '1' (per token) or displayQuantity for display.
    """
    display_qty = pe.get("displayQuantity")
    base_factor = pe.get("baseUnitConversionFactor")

    # Common patterns: price per 1M tokens (0.10), per 1K (0.0001), or per token (1e-7)
    if display_qty and display_qty > 0:
        # displayQuantity often indicates "per N units" for display
        return price_per_unit / display_qty
    if base_factor and base_factor != 0:
        return price_per_unit * base_factor
    # If price is already tiny (per-token range), use as-is
    if 0 < price_per_unit < 1e-4:
        return price_per_unit
    # Assume price is per 1M tokens
    return price_per_unit / 1_000_000


def _fetch_sku_price(api_key: str, sku_id: str) -> float | None:
    """
    Fetch price per token for a SKU from Cloud Billing Catalog API.
    Returns USD per token, or None on failure.
    """
    url = (
        f"https://cloudbilling.googleapis.com/v1/services/{VERTEX_AI_SERVICE_ID}/skus"
        f"?key={api_key}&currencyCode=USD&pageSize=5000"
    )
    try:
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except (URLError, HTTPError, json.JSONDecodeError, OSError) as e:
        logger.warning("Cloud Billing Catalog API request failed: %s", e)
        return None

    skus = data.get("skus", [])
    for sku in skus:
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

    if input_per_token is None:
        input_per_token = FALLBACK_INPUT_PER_MILLION / 1_000_000
        logger.debug("Using fallback input rate: $%.6f per token", input_per_token)
    if output_per_token is None:
        output_per_token = FALLBACK_OUTPUT_PER_MILLION / 1_000_000
        logger.debug("Using fallback output rate: $%.6f per token", output_per_token)

    _cached_rates = (input_per_token, output_per_token)
    return _cached_rates


def compute_cost(
    input_tokens: int,
    output_tokens: int,
) -> float:
    """
    Compute total cost in USD for given input and output token counts.
    Uses Gemini 2.0 Flash rates (from Billing API or fallback).
    """
    input_rate, output_rate = get_gemini_2_flash_rates()
    return (input_tokens * input_rate) + (output_tokens * output_rate)


def compute_prompt_and_eval_cost(
    prompt_input: int,
    prompt_output: int,
    eval_input: int,
    eval_output: int,
) -> Tuple[float, float]:
    """
    Compute prompt cost and eval cost separately.
    Returns (prompt_cost_usd, eval_cost_usd).
    """
    prompt_cost = compute_cost(prompt_input, prompt_output)
    eval_cost = compute_cost(eval_input, eval_output)
    return round(prompt_cost, 6), round(eval_cost, 6)
