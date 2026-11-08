"""Gemini integration for AstroBot.

The client is initialized lazily so missing AI configuration never prevents
non-AI application routes from starting.
"""

import os
import json
import math
import re
from functools import lru_cache

from flask import current_app
from api.aiService.config import get_model
from google import genai
from google.genai import errors, types
try:
    from httpx2 import TimeoutException
except ImportError:
    from httpx import TimeoutException


@lru_cache(maxsize=1)
def get_ai_client():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key or not api_key.strip():
        raise ValueError("Gemini API credentials are not configured")
    return genai.Client(
        api_key=api_key.strip(),
        http_options=types.HttpOptions(timeout=20000, retry_options=types.HttpRetryOptions(attempts=1)),
    )


class AstroBotError(Exception):
    """A fixed public error category, separate from provider diagnostics."""

    def __init__(self, code, *, retry_after=None):
        messages = {
            "ai_daily_usage_limit": "AstroBot's daily AI allowance has been used up. Please try again after the provider's quota resets.",
            "ai_usage_limit": "AstroBot's AI provider has reached a rate or usage limit. Please try again later.",
            "ai_configuration": "AstroBot cannot connect with its current AI settings. Please try again after the service is configured.",
            "ai_model_unavailable": "AstroBot's configured AI model is unavailable. The service needs a model update before it can answer.",
            "ai_unavailable": "AstroBot could not reach its AI provider. Please try again in a moment.",
            "ai_timeout": "AstroBot took too long to respond. Please try again in a moment.",
            "ai_empty_response": "AstroBot returned no answer. Try rephrasing your message.",
        }
        super().__init__(messages[code])
        self.code = code
        self.retry_after = retry_after
        self.status = 429 if code in ("ai_usage_limit", "ai_daily_usage_limit") else 504 if code == "ai_timeout" else 503



def ask_space_bot(user_message: str, *, context: str = "", system_instruction: str | None = None) -> str:
    """Send one independent message to Gemini using the AstroBot persona."""
    system_instruction = system_instruction or (
        "You are 'AstroBot', an AI communications officer aboard an interstellar orbital station. "
        "You must respond to every prompt using space-themed terminology, cosmic metaphors, "
        "and sci-fi flair (e.g., addressing users as 'Earthling', referring to data as 'telemetry', "
        "and formatting your sign-offs like 'End transmission'). Keep the core answers accurate "
        "while maintaining this immersive persona. Answer directly in under 170 words unless "
        "the user explicitly requests more detail. Keep space-themed flourishes brief."
    )

    model = get_model()
    try:
        response = get_ai_client().models.generate_content(
            model=model,
            contents=(f"Untrusted discussion context:\n{context[:6000]}\n\nQuestion:\n{user_message}" if context else user_message),
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
                max_output_tokens=512,
                thinking_config=types.ThinkingConfig(thinking_level="low") if model.removeprefix("models/").startswith("gemini-3") else None,
            ),
        )
        answer = response.text
    except errors.APIError as exc:
        # Never log a raw exception, key, prompt, or provider response.
        code = exc.code if type(exc.code) is int else 0
        retry_after = None
        if code == 429:
            details = getattr(exc, "details", {})
            text = json.dumps(details, default=str).lower()
            category = "ai_daily_usage_limit" if any(token in text for token in ("perday", "per_day", "per day", "daily")) else "ai_usage_limit"
            root = details.get("error", details) if isinstance(details, dict) else {}
            for detail in root.get("details", []) if isinstance(root, dict) else []:
                if not isinstance(detail, dict) or not str(detail.get("@type", "")).endswith("google.rpc.RetryInfo"):
                    continue
                match = re.fullmatch(r"(\d+(?:\.\d+)?)s", str(detail.get("retryDelay", "")))
                if match:
                    seconds = float(match[1])
                    if 0 < seconds <= 604800:
                        retry_after = math.ceil(seconds)
        elif code == 404:
            category = "ai_model_unavailable"
        elif code == 504:
            category = "ai_timeout"
        elif code in (400, 401, 403):
            category = "ai_configuration"
        else:
            category = "ai_unavailable"
        current_app.logger.warning("AstroBot Gemini request failed: code=%s category=%s", code, category)
        raise AstroBotError(category, retry_after=retry_after) from None
    except (TimeoutException, TimeoutError):
        current_app.logger.warning("AstroBot Gemini request failed: category=ai_timeout")
        raise AstroBotError("ai_timeout") from None
    except ValueError:
        current_app.logger.error("AstroBot Gemini request failed: code=0 category=ai_configuration")
        raise AstroBotError("ai_configuration") from None
    except Exception:
        current_app.logger.error("AstroBot Gemini request failed: code=0 category=ai_unavailable")
        raise AstroBotError("ai_unavailable") from None

    if isinstance(answer, str) and answer.strip():
        return answer
    current_app.logger.warning("AstroBot Gemini request failed: code=0 category=ai_empty_response")
    raise AstroBotError("ai_empty_response") from None
