import unittest
from unittest.mock import patch
from flask import Flask, jsonify
from api.astrobot.routes import install_astrobot
from api.astrobot import storage


class AstroBotRouteTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.secret_key = "test"

        @self.app.post("/api/posts")
        def create_post():
            return jsonify(id=42), 201

        @self.app.post("/api/posts/<int:post_id>/comments")
        def create_comment(post_id):
            return jsonify(id=99, post_id=post_id), 201

        @self.app.patch("/api/posts/<int:source_id>")
        @self.app.patch("/api/comments/<int:source_id>")
        def edit_content(source_id):
            return jsonify(id=source_id)

        install_astrobot(self.app)
        install_astrobot(self.app)  # Registration is idempotent.
        self.client = self.app.test_client()
        self.key = patch("api.astrobot.storage.public_client_key", return_value="client")
        self.key.start()
        self.addCleanup(self.key.stop)

    def test_invalid_payloads_do_not_call_provider(self):
        with patch("api.astrobot.service.generate_reply") as generate:
            for payload in ([], {}, {"message": 5}, {"message": " "}, {"message": "x" * 1601}):
                self.assertEqual(self.client.post("/api/ai/chat", json=payload).status_code, 400)
            generate.assert_not_called()

    def test_chat_success(self):
        with patch("api.astrobot.storage.enforce_quota") as quota, patch("api.astrobot.service.generate_reply", return_value="Europa is icy."):
            response = self.client.post("/api/ai/chat", json={"message": "Europa?"})
        quota.assert_called_once_with("client")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {"sender": "AstroBot", "is_ai": True, "response": "Europa is icy."})

    def test_quota_stops_provider(self):
        with patch("api.astrobot.storage.enforce_quota", side_effect=storage.LimitReached), patch("api.astrobot.service.generate_reply") as generate:
            response = self.client.post("/api/ai/chat", json={"message": "hello"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["Retry-After"], "900")
        generate.assert_not_called()

    def test_database_outage_stops_provider(self):
        with patch("api.astrobot.storage.enforce_quota", side_effect=RuntimeError("private database error")), patch("api.astrobot.service.generate_reply") as generate, self.assertLogs("api.astrobot.routes", level="ERROR"):
            response = self.client.post("/api/ai/chat", json={"message": "hello"})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private", response.get_data(as_text=True))
        generate.assert_not_called()

    def test_provider_error_is_safe(self):
        with patch("api.astrobot.storage.enforce_quota"), patch("api.astrobot.service.generate_reply", side_effect=ValueError("secret-provider-details")), self.assertLogs("api.astrobot.routes", level="ERROR"):
            response = self.client.post("/api/ai/chat", json={"message": "hello"})
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("secret-provider-details", response.get_data(as_text=True))

    def test_mentions_preserve_create_response(self):
        with patch("api.astrobot.routes.generate_mention", return_value="completed") as mention:
            response = self.client.post("/api/posts", json={"title": "@AstroBot", "body": "hello"})
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json["id"], 42)
            self.assertEqual(response.headers["X-AstroBot-Status"], "pending")
            mention.assert_not_called()
            response.close()  # WSGI closes the iterable after sending the body.
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["id"], 42)
        self.assertEqual(response.headers["X-AstroBot-Status"], "pending")
        mention.assert_called_once_with("post", 42, "client")
        with patch("api.astrobot.routes.generate_mention", side_effect=RuntimeError("offline")), self.assertLogs("api.astrobot.routes", level="ERROR"):
            response = self.client.post("/api/posts/42/comments", json={"body": "@AstroBot hello"})
            self.assertEqual(response.json["id"], 99)
            response.close()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.headers["X-AstroBot-Status"], "pending")

    def test_no_mention_skips_generation(self):
        with patch("api.astrobot.routes.generate_mention") as mention:
            self.client.post("/api/posts", json={"title": "hello", "body": "everyone"})
        mention.assert_not_called()

    def test_mentions_added_by_edit_trigger_replies(self):
        for path, kind, source_id in (("/api/posts/42", "post", 42), ("/api/comments/99", "comment", 99)):
            with self.subTest(kind=kind), patch("api.astrobot.routes.generate_mention", return_value="completed") as mention:
                response = self.client.patch(path, json={"body": "@AstroBot explain"})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers["X-AstroBot-Status"], "pending")
                mention.assert_not_called()
                response.close()
                mention.assert_called_once_with(kind, source_id, "client")

    def test_edits_without_mentions_skip_generation(self):
        with patch("api.astrobot.routes.generate_mention") as mention:
            self.client.patch("/api/comments/99", json={"body": "hello"})
        mention.assert_not_called()

    def test_post_title_is_part_of_bot_question(self):
        source = {"title": "@AstroBot why is Mars red?", "body": "Tell me more", "author": "human", "post_id": 42}
        with patch("api.astrobot.storage.fetch_source", return_value=source), patch("api.astrobot.storage.reserve_mention", return_value=True), patch("api.astrobot.storage.enforce_quota"), patch("api.astrobot.storage.discussion_context", return_value=""), patch("api.astrobot.service.generate_reply", return_value="Iron oxide.") as generate, patch("api.astrobot.storage.complete_mention") as complete:
            from api.astrobot.routes import generate_mention
            self.assertEqual(generate_mention("post", 42, "client"), "completed")
        self.assertIn(source["title"], generate.call_args.args[0])
        self.assertIsNone(complete.call_args.kwargs["parent_comment_id"])

    def test_duplicate_mention_does_not_generate(self):
        with patch("api.astrobot.storage.fetch_source", return_value={"title": "@AstroBot", "body": "hello"}), patch("api.astrobot.storage.reserve_mention", return_value=False), patch("api.astrobot.service.generate_reply") as generate:
            from api.astrobot.routes import generate_mention
            self.assertEqual(generate_mention("post", 42, "client"), "duplicate")
        generate.assert_not_called()

    def test_comment_mention_saves_threaded_reply(self):
        source = {"title": "Europa", "post_body": "An icy moon", "body": "@AstroBot explain", "author": "human", "post_id": 42}
        with patch("api.astrobot.storage.fetch_source", return_value=source), patch("api.astrobot.storage.reserve_mention", return_value=True), patch("api.astrobot.storage.enforce_quota"), patch("api.astrobot.storage.discussion_context", return_value="discussion"), patch("api.astrobot.service.generate_reply", return_value="An answer"), patch("api.astrobot.storage.complete_mention") as complete:
            from api.astrobot.routes import generate_mention
            self.assertEqual(generate_mention("comment", 99, "client"), "completed")
        self.assertEqual(complete.call_args.kwargs, {"post_id": 42, "parent_comment_id": 99})


if __name__ == "__main__":
    unittest.main()
