"""Gemini integration for AstroBot.

The client is initialized lazily so missing AI configuration never prevents
non-AI application routes from starting.
"""

import os
from functools import lru_cache

from flask import current_app
from google import genai
from google.genai import errors, types


@lru_cache(maxsize=1)
def get_ai_client():
    return genai.Client()


class AstroBotError(Exception):
    """A fixed public error category, separate from provider diagnostics."""

    def __init__(self, code):
        messages = {
            "ai_usage_limit": "AstroBot has reached its AI usage limit. Please try again later.",
            "ai_configuration": "AstroBot’s AI service is unavailable. Please try again later.",
            "ai_unavailable": "AstroBot is temporarily unavailable. Please try again later.",
        }
        super().__init__(messages[code])
        self.code = code
        self.status = 429 if code == "ai_usage_limit" else 503


def ask_space_bot(user_message: str) -> str:
    """Send one independent message to Gemini using the AstroBot persona."""
    system_instruction = (
        "You are 'AstroBot', an AI communications officer aboard an interstellar orbital station. "
        "You must respond to every prompt using space-themed terminology, cosmic metaphors, "
        "and sci-fi flair (e.g., addressing users as 'Earthling', referring to data as 'telemetry', "
        "and formatting your sign-offs like 'End transmission'). Keep the core answers accurate "
        "while maintaining this immersive persona."
    )

    try:
        response = get_ai_client().models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash",
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
            ),
        )
        answer = response.text
    except errors.APIError as exc:
        # Never log a raw exception, key, prompt, or provider response.
        code = exc.code if type(exc.code) is int else 0
        if code == 429:
            category = "ai_usage_limit"
        elif code in (400, 401, 403, 404):
            category = "ai_configuration"
        else:
            category = "ai_unavailable"
        current_app.logger.warning("AstroBot Gemini request failed: code=%s category=%s", code, category)
        raise AstroBotError(category) from None
    except ValueError:
        current_app.logger.error("AstroBot Gemini request failed: code=0 category=ai_configuration")
        raise AstroBotError("ai_configuration") from None
    except Exception:
        current_app.logger.error("AstroBot Gemini request failed: code=0 category=ai_unavailable")
        raise AstroBotError("ai_unavailable") from None

    if isinstance(answer, str) and answer.strip():
        return answer
    current_app.logger.warning("AstroBot Gemini request failed: code=0 category=ai_unavailable")
    raise AstroBotError("ai_unavailable") from None
