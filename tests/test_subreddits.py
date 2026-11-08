import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from flask import Flask

with patch("dotenv.load_dotenv", return_value=False):
    from api.subreddits import routes


class SubredditRoutesTest(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="communities-test-only-secret")
        app.register_blueprint(routes.subreddits)
        self.client = app.test_client()
        database_patch = patch.object(routes, "database_cursor")
        self.database = database_patch.start()
        self.addCleanup(database_patch.stop)
        self.cursor = self.database.return_value.__enter__.return_value
        self.community = {
            "id": 2,
            "name": "firstcontact",
            "description": "Meet your cosmic neighbors.",
            "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
            "post_count": 0, "member_count": 0, "is_member": False,
        }

    def test_popular_communities_are_public_and_include_real_post_counts(self):
        self.cursor.fetchall.return_value = [{**self.community, "post_count": 12}]

        response = self.client.get("/api/subreddits?sort=popular&limit=6")

        self.assertEqual(response.status_code, 200)
        communities = response.get_json()
        self.assertIsInstance(communities, list)
        self.assertEqual(set(communities[0]), {*self.community, "post_count"})
        self.assertEqual(communities[0]["post_count"], 12)
        self.assertEqual(communities[0]["created_at"], "2026-01-01T00:00:00+00:00")
        query, parameters = self.cursor.execute.call_args.args
        self.assertIn("COUNT(*) FROM public.posts", query)
        self.assertIn("p.subreddit_id = s.id", query)
        self.assertIn("ORDER BY post_count DESC, s.id ASC", query)
        self.assertIn("LIMIT %s", query)
        self.assertEqual(parameters, (6,))

    def test_popular_defaults_to_six_and_caps_explicit_limit_at_twenty(self):
        self.cursor.fetchall.return_value = []
        for query, expected in (("sort=popular", 6), ("sort=popular&limit=500", 20)):
            with self.subTest(query=query):
                self.assertEqual(self.client.get(f"/api/subreddits?{query}").status_code, 200)
                self.assertEqual(self.cursor.execute.call_args.args[1], (expected,))

    def test_default_list_preserves_fields_order_and_unlimited_contract(self):
        self.cursor.fetchall.return_value = [self.community.copy()]

        response = self.client.get("/api/subreddits")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.get_json()[0]), set(self.community))
        query, parameters = self.cursor.execute.call_args.args
        self.assertIn("ORDER BY s.id ASC", query)
        self.assertIn("member_count", query)
        self.assertNotIn("LIMIT", query)
        self.assertEqual(parameters, ())

    def test_explicit_id_sort_can_use_a_parameterized_limit(self):
        self.cursor.fetchall.return_value = []

        response = self.client.get("/api/subreddits?sort=id&limit=3")

        self.assertEqual(response.status_code, 200)
        query, parameters = self.cursor.execute.call_args.args
        self.assertTrue(query.endswith("ORDER BY s.id ASC LIMIT %s"))
        self.assertEqual(parameters, (3,))

    def test_invalid_sort_and_limits_are_rejected_without_database_access(self):
        for parameters in (
            {"sort": ""}, {"sort": "new"}, {"sort": "popular; DROP TABLE users"},
            {"limit": ""}, {"limit": "bad"}, {"limit": "1.5"}, {"limit": 0}, {"limit": -1},
        ):
            with self.subTest(parameters=parameters):
                response = self.client.get("/api/subreddits", query_string=parameters)
                self.assertEqual(response.status_code, 400)
                self.assertIsInstance(response.get_json()["error"], str)
        self.database.assert_not_called()

    def test_empty_popular_list_is_an_empty_array(self):
        self.cursor.fetchall.return_value = []

        self.assertEqual(self.client.get("/api/subreddits?sort=popular").get_json(), [])

    def test_create_community_still_requires_authentication(self):
        response = self.client.post("/api/subreddits", json={"name": "new_world"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Login required"})
        self.database.assert_not_called()


if __name__ == "__main__":
    unittest.main()
