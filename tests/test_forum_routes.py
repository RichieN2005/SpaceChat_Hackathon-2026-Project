import unittest
from contextlib import contextmanager
from unittest.mock import patch
from flask import Flask
from api.posts.routes import posts
from api.comments.routes import comments
from api.votes import votes


class Cursor:
    def __init__(self):
        self.calls = []
        self.value = 0
        self.result = None

    def execute(self, sql, params=()):
        self.calls.append((sql, params))
        if sql.startswith("SELECT id"):
            self.result = {"id": 7}
        elif "INSERT INTO" in sql:
            self.value = params[2]
        elif "DELETE FROM" in sql:
            self.value = 0
        elif "FILTER" in sql:
            self.result = {"upvotes": int(self.value == 1), "downvotes": int(self.value == -1), "score": self.value}

    def fetchone(self):
        return self.result

    def fetchall(self):
        return []


class ForumRoutesTest(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.secret_key = "test"
        for blueprint in (posts, comments, votes):
            app.register_blueprint(blueprint)
        self.client = app.test_client()
        self.cursor = Cursor()

        @contextmanager
        def db():
            yield self.cursor

        for module in ("api.posts.routes", "api.comments.routes", "api.votes"):
            patcher = patch(module + ".database_cursor", db)
            patcher.start()
            self.addCleanup(patcher.stop)

    def login(self):
        with self.client.session_transaction() as session:
            session["user_id"] = 2

    def test_vote_switch_and_clear(self):
        self.login()
        for target in ("posts", "comments"):
            for value, expected in ((1, (1, 0)), (-1, (0, 1)), (0, (0, 0))):
                response = self.client.put(f"/api/{target}/7/vote", json={"value": value})
                self.assertEqual(response.status_code, 200)
                self.assertEqual((response.json["upvotes"], response.json["downvotes"]), expected)
                self.assertEqual(response.json["user_vote"], value)
        self.assertTrue(any("ON CONFLICT" in sql for sql, _ in self.cursor.calls))

    def test_vote_requires_login_and_valid_value(self):
        self.assertEqual(self.client.put("/api/posts/7/vote", json={"value": 1}).status_code, 401)
        self.login()
        for value in (True, 2, "1", None):
            self.assertEqual(self.client.put("/api/posts/7/vote", json={"value": value}).status_code, 400)
        self.assertEqual(self.cursor.calls, [])

    def test_post_sort_and_community_filter(self):
        for sort, order in (("newest", "p.created_at DESC"), ("top", "score DESC"), ("discussed", "comment_count DESC")):
            response = self.client.get(f"/api/posts?subreddit_id=3&sort={sort}")
            self.assertEqual(response.status_code, 200)
            sql, params = self.cursor.calls[-1]
            self.assertIn("WHERE p.subreddit_id = %s", sql)
            self.assertIn("ORDER BY " + order, sql)
            self.assertEqual(params, (None, 3))
        self.assertEqual(self.client.get("/api/posts?sort=invalid").status_code, 400)

    def test_comments_rank_by_upvotes_then_recency(self):
        self.assertEqual(self.client.get("/api/posts/7/comments").status_code, 200)
        self.assertIn("ORDER BY upvotes DESC, c.created_at DESC, c.id DESC", self.cursor.calls[-1][0])


if __name__ == "__main__":
    unittest.main()
