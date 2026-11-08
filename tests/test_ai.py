import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch


class AstroBotRoutesTest(unittest.TestCase):
    def setUp(self):
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

    def login(self):
        with self.client.session_transaction() as session:
            session["user_id"] = 7

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
        self.assertEqual(set(response.get_json()), {"error"})

    def test_oversized_requests_return_json_413(self):
        self.login()
        response = self.client.post("/api/ai/chat", json={"message": "x" * (128 * 1024)})
        self.assertEqual(response.status_code, 413)
        self.assertIn("error", response.get_json())
        self.constructor.assert_not_called()


if __name__ == "__main__":
    unittest.main()
