import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from google.genai import errors
from api.aiService.ai_service import get_ai_client


class AstroBotRoutesTest(unittest.TestCase):
    def setUp(self):
        get_ai_client.cache_clear()
        self.addCleanup(get_ai_client.cache_clear)
        name = "spacechat_ai_test"
        spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / "app.py")
        self.module = importlib.util.module_from_spec(spec)
        self.provider = Mock()
        self.provider.models.generate_content.return_value = SimpleNamespace(text="Signal received, Earthling.")
        constructor_patch = patch("google.genai.Client", return_value=self.provider)
        self.constructor = constructor_patch.start()
        self.addCleanup(constructor_patch.stop)
        with (
            patch.dict("os.environ", {"SECRET_KEY": "ai-test-only-secret"}, clear=True),
            patch("dotenv.load_dotenv", return_value=False),
            patch.dict(sys.modules, {name: self.module}),
        ):
            spec.loader.exec_module(self.module)
        self.module.app.testing = True
        self.client = self.module.app.test_client()
        env = patch.dict("os.environ", {"GEMINI_API_KEY": "test-api-key"})
        env.start()
        self.addCleanup(env.stop)
        quota = patch("api.astrobot.storage.enforce_quota")
        quota.start()
        self.addCleanup(quota.stop)
        key = patch("api.astrobot.storage.public_client_key", return_value="test-client")
        key.start()
        self.addCleanup(key.stop)

    def login(self):
        with self.client.session_transaction() as session:
            session["user_id"] = 7

    def test_shared_quota_rejects_before_provider_call(self):
        from api.astrobot.storage import LimitReached
        self.login()
        with patch("api.astrobot.storage.enforce_quota", side_effect=LimitReached):
            response = self.client.post("/api/ai/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["Retry-After"], "900")
        self.constructor.assert_not_called()

    def test_chat_fails_closed_when_quota_database_is_unavailable(self):
        self.login()
        with patch("api.astrobot.storage.enforce_quota", side_effect=RuntimeError("private-db-detail")):
            response = self.client.post("/api/ai/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private-db-detail", response.get_data(as_text=True))
        self.constructor.assert_not_called()

    def test_ai_blueprint_is_registered_once_without_public_alias(self):
        ai_rules = [rule for rule in self.module.app.url_map.iter_rules()
                    if rule.rule == "/api/ai/chat"]
        self.assertEqual(len(ai_rules), 1)
        self.assertEqual(self.client.post("/api/chat", json={"message": "hello"}).status_code, 404)

    def test_ai_requires_login_without_calling_provider(self):
        self.assertEqual(self.client.post("/api/ai/chat", json={"message": "Hello"}).status_code, 401)
        self.constructor.assert_not_called()

    def test_ai_rejects_invalid_payloads_without_calling_provider(self):
        self.login()
        for payload in ([], None, {}, {"message": 42}, {"message": "   "}, {"message": "x" * 2001}):
            with self.subTest(payload_type=type(payload).__name__):
                self.assertEqual(self.client.post("/api/ai/chat", json=payload).status_code, 400)
        self.constructor.assert_not_called()

    def test_ai_trims_message_and_retains_space_persona(self):
        self.login()
        response = self.client.post("/api/ai/chat", json={"message": "  Hello  "})
        self.assertEqual(response.get_json(), {"sender": "AstroBot", "response": "Signal received, Earthling."})
        arguments = self.provider.models.generate_content.call_args.kwargs
        self.assertEqual(arguments["contents"], "Hello")
        self.assertIn("AstroBot", arguments["config"].system_instruction)
        self.assertIn("core answers accurate", arguments["config"].system_instruction)

    def test_provider_failures_never_expose_raw_exception(self):
        self.login()
        self.provider.models.generate_content.side_effect = RuntimeError("private-provider-details")
        response = self.client.post("/api/ai/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private-provider-details", response.get_data(as_text=True))
        self.assertEqual(set(response.get_json()), {"error", "code"})
        self.assertEqual(response.get_json()["code"], "ai_unavailable")

    def test_oversized_requests_return_json_413(self):
        self.login()
        response = self.client.post("/api/ai/chat", json={"message": "x" * (128 * 1024)})
        self.assertEqual(response.status_code, 413)
        self.assertIn("error", response.get_json())
        self.constructor.assert_not_called()

    def test_provider_status_is_logged_without_raw_details(self):
        self.login()
        self.provider.models.generate_content.side_effect = errors.ClientError(429, {"error": {"status": "RESOURCE_EXHAUSTED", "message": "private-provider-details-and-key"}})
        with self.assertLogs(self.module.app.logger, level="WARNING") as captured:
            response = self.client.post("/api/ai/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.get_json()["code"], "ai_usage_limit")
        logs = " ".join(captured.output)
        self.assertIn("code=429", logs)
        self.assertIn("ai_usage_limit", logs)
        self.assertNotIn("private-provider-details-and-key", logs)
        self.assertNotIn("private-provider-details-and-key", response.get_data(as_text=True))
        self.provider.models.generate_content.assert_called_once()
        self.constructor.assert_called_once()
        self.assertEqual(self.constructor.call_args.kwargs["api_key"], "test-api-key")
        self.assertEqual(self.constructor.call_args.kwargs["http_options"].timeout, 20000)

    def test_configuration_failures_have_safe_server_diagnostics(self):
        self.login()
        self.constructor.side_effect = ValueError("private-config-value")
        with self.assertLogs(self.module.app.logger, level="ERROR") as captured:
            response = self.client.post("/api/ai/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["code"], "ai_configuration")
        self.assertIn("category=ai_configuration", " ".join(captured.output))
        self.assertNotIn("private-config-value", " ".join(captured.output))

    def test_upstream_credentials_and_model_errors_do_not_expire_user_session(self):
        self.login()
        for status in (401, 403, 404):
            with self.subTest(status=status):
                self.provider.models.generate_content.side_effect = errors.ClientError(status, {"error": {"message": "private-provider-detail"}})
                response = self.client.post("/api/ai/chat", json={"message": "Hello"})
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.get_json()["code"], "ai_model_unavailable" if status == 404 else "ai_configuration")
                self.assertNotIn("private-provider-detail", response.get_data(as_text=True))
                with self.client.session_transaction() as session:
                    self.assertEqual(session["user_id"], 7)

    def test_transient_errors_use_unavailable_category_without_outer_retries(self):
        self.login()
        failures = (
            errors.ServerError(500, {"error": {"message": "private-provider-detail"}}),
            errors.ServerError(503, {"error": {"message": "private-provider-detail"}}),
            ConnectionError("private-network-detail"),
        )
        for failure in failures:
            with self.subTest(failure_type=type(failure).__name__):
                self.provider.models.generate_content.reset_mock()
                self.provider.models.generate_content.side_effect = failure
                response = self.client.post("/api/ai/chat", json={"message": "private-user-prompt"})
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.get_json()["code"], "ai_unavailable")
                self.provider.models.generate_content.assert_called_once()
                self.assertNotIn("private-", response.get_data(as_text=True))

    def test_empty_provider_text_has_actionable_message(self):
        self.login()
        self.provider.models.generate_content.return_value = SimpleNamespace(text="   ")
        response = self.client.post("/api/ai/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["code"], "ai_empty_response")

    def test_daily_provider_quota_has_distinct_message_and_actual_retry_time(self):
        self.login()
        self.provider.models.generate_content.side_effect = errors.ClientError(429, {"error": {
            "message": "Requests per day limit exceeded; private-provider-detail",
            "details": [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "3600.5s"}],
        }})
        response = self.client.post("/api/ai/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json["code"], "ai_daily_usage_limit")
        self.assertIn("daily", response.json["error"])
        self.assertEqual(response.headers["Retry-After"], "3601")
        self.assertNotIn("private-provider-detail", response.get_data(as_text=True))

    def test_app_daily_limit_does_not_claim_fifteen_minute_reset(self):
        from api.astrobot.storage import LimitReached
        self.login()
        with patch("api.astrobot.storage.enforce_quota", side_effect=LimitReached(scope="global", retry_after=18000)):
            response = self.client.post("/api/ai/chat", json={"message": "Hello"})
        self.assertIn("daily", response.json["error"])
        self.assertEqual(response.headers["Retry-After"], "18000")
        self.constructor.assert_not_called()

    def test_upstream_deadline_is_a_clear_timeout(self):
        self.login()
        self.provider.models.generate_content.side_effect = errors.ServerError(504, {"error": {"message": "private-provider-detail"}})
        response = self.client.post("/api/ai/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.json["code"], "ai_timeout")
        self.assertIn("too long", response.json["error"])

    def test_default_uses_verified_flash_lite_model(self):
        self.login()
        with patch.dict("os.environ", {"GEMINI_MODEL": ""}):
            response = self.client.post("/api/ai/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.provider.models.generate_content.call_args.kwargs["model"], "gemini-3.1-flash-lite")

    def test_blank_or_padded_model_setting_is_normalized(self):
        from api.aiService.config import get_model
        with patch.dict("os.environ", {"GEMINI_MODEL": "   "}):
            self.assertEqual(get_model(), "gemini-3.1-flash-lite")
        with patch.dict("os.environ", {"GEMINI_MODEL": " custom-model "}):
            self.assertEqual(get_model(), "custom-model")

    def test_model_can_be_selected_without_changing_code(self):
        self.login()
        with patch.dict("os.environ", {"GEMINI_MODEL": "configured-test-model"}):
            response = self.client.post("/api/ai/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.provider.models.generate_content.call_args.kwargs["model"], "configured-test-model")


if __name__ == "__main__":
    unittest.main()
