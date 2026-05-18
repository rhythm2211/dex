"""Post leadership digest summaries to Slack incoming webhooks."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger("dex-slack")


def post_slack_message(webhook_url: str, text: str, blocks: Optional[list] = None) -> bool:
    if not webhook_url or not str(webhook_url).strip().lower().startswith("https://"):
        return False
    payload: Dict[str, Any] = {"text": text[:30000]}
    if blocks:
        payload["blocks"] = blocks
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(webhook_url, json=payload, headers={"Content-Type": "application/json"})
            if r.status_code not in (200, 201):
                logger.warning(f"Slack webhook failed: {r.status_code} {r.text[:200]}")
                return False
    except Exception as e:
        logger.warning(f"Slack post error: {e}")
        return False
    return True
