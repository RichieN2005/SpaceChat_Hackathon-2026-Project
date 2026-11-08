import importlib.util
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from flask import Flask

with patch("dotenv.load_dotenv", return_value=False):
    from api.comments import routes as comment_routes
    from api.posts import routes as post_routes


class PublicContentRoutesTest(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="content-test-only-secret")
        app.register_blueprint(post_routes.posts)
        app.register_blueprint(comment_routes.comments)
        self.client = app.test_client()

        post_patch = patch.object(post_routes, "database_cursor")
        comment_patch = patch.object(comment_routes, "database_cursor")
        self.post_database = post_patch.start()
        self.comment_database = comment_patch.start()
        self.addCleanup(post_patch.stop)
        self.addCleanup(comment_patch.stop)
        self.post_cursor = self.post_database.return_value.__enter__.return_value
        self.comment_cursor = self.comment_database.return_value.__enter__.return_value
        timestamp = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.post = {
            "id": 9, "author_id": 7, "subreddit_id": 2,
            "title": "Hello, other worlds", "body": "A transmission from Earth.",
            "created_at": timestamp, "author_username": "cosmic_traveler",
            "subreddit_name": "firstcontact", "comment_count": 2,
        }
        self.comment = {
            "id": 12, "post_id": 9, "author_id": 8, "parent_comment_id": None,
            "body": "Signal received.", "created_at": timestamp,
            "author_username": "orbit_observer",
        }

    def test_public_feed_keeps_array_and_original_fields_with_read_metadata(self):
        self.post_cursor.fetchall.return_value = [self.post.copy()]

        response = self.client.get("/api/posts")

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertIsInstance(result, list)
        self.assertEqual(set(result[0]), set(self.post))
        self.assertEqual(result[0]["author_username"], "cosmic_traveler")
        self.assertEqual(result[0]["subreddit_name"], "firstcontact")
        self.assertEqual(result[0]["comment_count"], 2)
        self.assertEqual(result[0]["created_at"], "2026-01-01T00:00:00+00:00")
        query, parameters = self.post_cursor.execute.call_args.args
        self.assertIn("LEFT JOIN public.users", query)
        self.assertIn("LEFT JOIN public.subreddits", query)
        self.assertIn("ORDER BY p.created_at DESC, p.id DESC", query)
        self.assertEqual(parameters, (20, 0))
        self.assertNotIn("password_hash", query)

    def test_search_filter_sort_and_pagination_bind_user_input(self):
        self.post_cursor.fetchall.return_value = []
        search = "orbit' OR 1=1 --"

        response = self.client.get("/api/posts", query_string={
            "subreddit_id": 2, "q": search, "sort": "discussed", "limit": 10, "offset": 30,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [])
        query, parameters = self.post_cursor.execute.call_args.args
        self.assertNotIn(search, query)
        self.assertIn("p.subreddit_id = %s", query)
        self.assertIn("p.title ILIKE %s OR p.body ILIKE %s", query)
        self.assertIn("ORDER BY comment_count DESC, p.created_at DESC, p.id DESC", query)
        self.assertEqual(parameters, (2, f"%{search}%", f"%{search}%", 10, 30))

    def test_search_treats_like_wildcards_as_literal_text(self):
        self.post_cursor.fetchall.return_value = []

        response = self.client.get("/api/posts", query_string={"q": "  100%_\\orbit  "})

        self.assertEqual(response.status_code, 200)
        parameters = self.post_cursor.execute.call_args.args[1]
        self.assertEqual(parameters, ("%100\\%\\_\\\\orbit%", "%100\\%\\_\\\\orbit%", 20, 0))

    def test_limit_is_capped_and_highest_offset_is_accepted(self):
        self.post_cursor.fetchall.return_value = []

        response = self.client.get("/api/posts?limit=500&offset=100000")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.post_cursor.execute.call_args.args[1], (50, 100000))

    def test_invalid_feed_parameters_are_rejected_before_database_access(self):
        invalid = [
            {"limit": ""}, {"limit": "no"}, {"limit": "1.5"}, {"limit": 0}, {"limit": -1},
            {"offset": ""}, {"offset": "no"}, {"offset": -1}, {"offset": 100001},
            {"q": "x" * 201}, {"sort": "top"}, {"sort": "new; DROP TABLE users"},
            {"subreddit_id": ""}, {"subreddit_id": 0}, {"subreddit_id": -1},
            {"subreddit_id": "2 OR 1=1"}, {"subreddit_id": 2**63},
        ]
        for parameters in invalid:
            with self.subTest(parameters=parameters):
                response = self.client.get("/api/posts", query_string=parameters)
                self.assertEqual(response.status_code, 400)
                self.assertIsInstance(response.get_json()["error"], str)
        self.post_database.assert_not_called()

    def test_empty_public_feed_is_an_empty_array(self):
        self.post_cursor.fetchall.return_value = []

        self.assertEqual(self.client.get("/api/posts").get_json(), [])

    def test_public_post_detail_includes_names_and_comment_count(self):
        self.post_cursor.fetchone.return_value = self.post.copy()

        response = self.client.get("/api/posts/9")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["id"], 9)
        self.assertEqual(response.get_json()["comment_count"], 2)
        self.assertEqual(set(response.get_json()), set(self.post))
        self.assertEqual(self.post_cursor.execute.call_args.args[1], (9,))

    def test_missing_post_is_not_found(self):
        self.post_cursor.fetchone.return_value = None

        response = self.client.get("/api/posts/9")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {"error": "Post not found"})

    def test_invalid_post_identifiers_do_not_reach_database(self):
        for post_id in (0, 2**63):
            with self.subTest(post_id=post_id):
                self.assertEqual(self.client.get(f"/api/posts/{post_id}").status_code, 404)
                self.assertEqual(self.client.get(f"/api/posts/{post_id}/comments").status_code, 404)
        self.post_database.assert_not_called()
        self.comment_database.assert_not_called()

    def test_public_comments_preserve_thread_fields_and_add_author_names(self):
        self.comment_cursor.fetchone.return_value = {"id": 9}
        self.comment_cursor.fetchall.return_value = [self.comment.copy()]

        response = self.client.get("/api/posts/9/comments")

        self.assertEqual(response.status_code, 200)
        comment = response.get_json()[0]
        self.assertEqual(set(comment), set(self.comment))
        self.assertEqual(comment["author_username"], "orbit_observer")
        self.assertIsNone(comment["parent_comment_id"])
        query, parameters = self.comment_cursor.execute.call_args.args
        self.assertIn("LEFT JOIN public.users", query)
        self.assertIn("ORDER BY c.created_at, c.id", query)
        self.assertEqual(parameters, (9,))

    def test_comments_for_missing_post_are_not_found(self):
        self.comment_cursor.fetchone.return_value = None

        response = self.client.get("/api/posts/9/comments")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {"error": "Post not found"})
        self.comment_cursor.fetchall.assert_not_called()

    def test_existing_write_routes_still_require_login(self):
        for method, path in (
            ("post", "/api/posts"), ("delete", "/api/posts/9"),
            ("post", "/api/posts/9/comments"), ("delete", "/api/comments/12"),
        ):
            with self.subTest(method=method, path=path):
                response = getattr(self.client, method)(path, json={"body": "test"})
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.get_json(), {"error": "Login required"})
        self.post_database.assert_not_called()
        self.comment_database.assert_not_called()


class AppAvailabilityTest(unittest.TestCase):
    def test_missing_ai_key_does_not_block_app_startup_or_health(self):
        name = "spacechat_availability_test"
        spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1] / "app.py")
        module = importlib.util.module_from_spec(spec)
        with (
            patch.dict("os.environ", {"SECRET_KEY": "availability-test-only-secret"}, clear=True),
            patch("dotenv.load_dotenv", return_value=False),
            patch("google.genai.Client", side_effect=ValueError("No API key configured")) as constructor,
            patch("api.common.get_db_connection", side_effect=AssertionError("Database access forbidden")),
            patch.dict(sys.modules, {name: module}),
        ):
            spec.loader.exec_module(module)
            client = module.app.test_client()
            self.assertEqual(client.get("/api/health").status_code, 200)
            constructor.assert_not_called()

            # The existing AI error response remains scoped to the AI request.
            response = client.post("/api/ai/chat", json={"message": "Hello"})
            self.assertEqual(response.status_code, 200)
            self.assertIn("Communications link failure", response.get_json()["response"])
            constructor.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
