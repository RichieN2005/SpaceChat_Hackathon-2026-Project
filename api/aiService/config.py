"""Shared model configuration for AstroBot and its diagnostic script."""
import os

DEFAULT_MODEL = "gemini-3.1-flash-lite"


def get_model():
    return (os.getenv("GEMINI_MODEL") or "").strip() or DEFAULT_MODEL
