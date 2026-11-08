"""Read-only AstroBot configuration/schema checks; --probe sends one tiny Gemini request."""
import argparse
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.aiService.config import get_model


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--probe", action="store_true")
    parser.add_argument("--models", action="store_true", help="List Gemini model names available to this API key")
    parser.add_argument("--model", help="Check a specific model without changing environment variables")
    args = parser.parse_args()
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    model = (args.model or "").strip() or get_model()
    report = {"credentials": bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")), "model": model}
    try:
        with psycopg.connect(os.getenv("DATABASE_URL"), connect_timeout=5) as conn:
            with conn.cursor() as cursor:
                tables = ("users", "posts", "comments", "ai_rate_limit", "ai_mentions", "comment_votes")
                cursor.execute("SELECT name, to_regclass('public.' || name) IS NOT NULL FROM unnest(%s::text[]) name", (list(tables),))
                report["tables"] = dict(cursor.fetchall())
                cursor.execute("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='is_bot')")
                report["is_bot_column"] = cursor.fetchone()[0]
                if report["is_bot_column"]:
                    cursor.execute("SELECT EXISTS(SELECT 1 FROM public.users WHERE username='AstroBot' AND email='astrobot@spacechat.invalid' AND is_bot=true)")
                    report["bot_account"] = cursor.fetchone()[0]
    except Exception as error:
        # Never print exception text; connection errors can contain credentials.
        report["database_error"] = type(error).__name__
        report["sqlstate"] = getattr(error, "sqlstate", None)
    if (args.probe or args.models) and report["credentials"]:
        try:
            from google import genai
            from google.genai import types
            with genai.Client(api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"), http_options=types.HttpOptions(timeout=20000, retry_options=types.HttpRetryOptions(attempts=1))) as client:
                if args.models:
                    report["models"] = [model.name for model in client.models.list() if "generateContent" in (model.supported_actions or [])]
                if not args.probe:
                    print(json.dumps(report, indent=2))
                    return
                result = client.models.generate_content(model=model, contents="Reply with OK.", config=types.GenerateContentConfig(max_output_tokens=1024, thinking_config=types.ThinkingConfig(thinking_level="low") if model.removeprefix("models/").startswith("gemini-3") else None))
                report["provider_answered"] = bool(result.text and result.text.strip())
                report["finish_reason"] = str(result.candidates[0].finish_reason) if result.candidates else None
        except Exception as error:
            report["provider_error"] = type(error).__name__
            report["provider_status"] = getattr(error, "code", None)
            message = str(getattr(error, "message", ""))
            for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "DATABASE_URL", "SECRET_KEY"):
                secret = os.getenv(name)
                if secret:
                    message = message.replace(secret, "[redacted]")
            report["provider_message"] = re.sub(r"AIza[\w-]+", "[redacted]", message)[:600]
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
