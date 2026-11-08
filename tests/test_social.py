import unittest
from unittest.mock import patch

from flask import Flask
from psycopg.errors import UndefinedTable

with patch("dotenv.load_dotenv", return_value=False):
    from api.comments import routes as comments
    from api.posts import routes as posts
    from api.subreddits import routes as communities
    from api.users import routes as users


class SocialRoutesTest(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="social-test-only-secret")
        for blueprint in (posts.posts, comments.comments, communities.subreddits, users.users):
            app.register_blueprint(blueprint)
        self.client = app.test_client()
        self.databases = {}
        self.cursors = {}
        for name, module in (("posts", posts), ("comments", comments), ("communities", communities), ("users", users)):
            mock = patch.object(module, "database_cursor")
            database = mock.start()
            self.addCleanup(mock.stop)
            self.databases[name] = database
            self.cursors[name] = database.return_value.__enter__.return_value
        self.post = {"id": 9, "author_id": 7, "subreddit_id": 2, "title": "Orbit", "body": "Hello", "created_at": "2026-01-01", "score": 3}
        self.comment = {"id": 12, "post_id": 9, "author_id": 7, "parent_comment_id": None, "body": "Hello", "created_at": "2026-01-01"}

    def login(self):
        with self.client.session_transaction() as session:
            session["user_id"] = 7

    def test_new_mutations_require_session_before_database_access(self):
        for method, path, body in (
            ("patch", "/api/posts/9", {"title": "New"}),
            ("put", "/api/posts/9/vote", {"value": 1}),
            ("patch", "/api/comments/12", {"body": "New"}),
            ("put", "/api/subreddits/2/membership", {"joined": True}),
            ("put", "/api/users/7", {"bio": "Hello"}),
        ):
            with self.subTest(path=path):
                self.assertEqual(getattr(self.client, method)(path, json=body).status_code, 401)
        for database in self.databases.values():
            database.assert_not_called()

    def test_author_feed_filter_and_top_sort_are_public_and_bound(self):
        cursor = self.cursors["posts"]
        cursor.fetchall.return_value = [self.post.copy()]

        response = self.client.get("/api/posts?author_id=7&sort=top")

        self.assertEqual(response.status_code, 200)
        query, parameters = cursor.execute.call_args.args
        self.assertIn("p.author_id = %s", query)
        self.assertIn("ORDER BY score DESC", query)
        self.assertEqual(parameters, (7, 20, 0))
        self.assertEqual(response.get_json()[0]["user_vote"], 0)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertEqual(self.client.get("/api/posts?author_id=7%20OR%201=1").status_code, 400)

    def test_signed_in_feed_reads_only_the_sessions_votes(self):
        self.login()
        cursor = self.cursors["posts"]
        cursor.fetchall.side_effect = [[self.post.copy()], [{"post_id": 9, "value": -1}]]

        response = self.client.get("/api/posts?user_id=999")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()[0]["user_vote"], -1)
        self.assertEqual(cursor.execute.call_args.args[1], (7, [9]))
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_public_reads_survive_unapplied_social_migration(self):
        cursor = self.cursors["posts"]
        cursor.execute.side_effect = [UndefinedTable(), None]
        cursor.fetchall.return_value = [{**self.post, "score": 0}]

        response = self.client.get("/api/posts?sort=top")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()[0]["score"], 0)
        self.assertNotIn("public.post_votes", cursor.execute.call_args.args[0])

    def test_post_patch_is_author_only_and_cannot_change_author(self):
        self.login()
        cursor = self.cursors["posts"]
        cursor.fetchone.return_value = {"author_id": 8, "title": "Old", "body": "Kept"}
        self.assertEqual(self.client.patch("/api/posts/9", json={"title": "New"}).status_code, 403)

        cursor.reset_mock()
        cursor.fetchone.side_effect = [{"author_id": 7, "title": "Old", "body": "Kept"}, {**self.post, "title": "New", "body": "Kept"}]
        response = self.client.patch("/api/posts/9", json={"title": "New", "author_id": 999})
        self.assertEqual(response.status_code, 200)
        query, parameters = cursor.execute.call_args.args
        self.assertNotIn("SET author_id", query)
        self.assertEqual(parameters, ("New", "Kept", 9))

    def test_post_delete_checks_owner_then_removes_entire_comment_tree(self):
        self.login()
        cursor = self.cursors["posts"]
        cursor.fetchone.return_value = {"author_id": 8}
        self.assertEqual(self.client.delete("/api/posts/9").status_code, 403)
        self.assertEqual(cursor.execute.call_count, 1)
        cursor.reset_mock()
        cursor.fetchone.return_value = {"author_id": 7}

        self.assertEqual(self.client.delete("/api/posts/9").status_code, 204)

        statements = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertEqual(statements[-2:], ["DELETE FROM public.comments WHERE post_id = %s", "DELETE FROM public.posts WHERE id = %s"])

    def test_content_length_bounds_are_enforced_before_database_access(self):
        self.login()
        for method, path, payload in (
            ("post", "/api/posts", {"title": "x" * 301, "body": "ok", "subreddit_id": 2}),
            ("post", "/api/posts", {"title": "ok", "body": "x" * 20001, "subreddit_id": 2}),
            ("patch", "/api/posts/9", {"body": "x" * 20001}),
            ("post", "/api/posts/9/comments", {"body": "x" * 10001}),
            ("patch", "/api/comments/12", {"body": "x" * 10001}),
            ("put", "/api/users/7", {"bio": "x" * 2001}),
        ):
            with self.subTest(path=path, method=method):
                self.assertEqual(getattr(self.client, method)(path, json=payload).status_code, 400)
        for database in self.databases.values():
            database.assert_not_called()

    def test_reply_requires_parent_from_same_post_and_uses_session_author(self):
        self.login()
        cursor = self.cursors["comments"]
        cursor.fetchone.side_effect = [{"id": 9}, None]
        response = self.client.post("/api/posts/9/comments", json={"body": "Hi", "parent_comment_id": 99})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(any("INSERT" in call.args[0] for call in cursor.execute.call_args_list))

        cursor.reset_mock()
        cursor.fetchone.side_effect = [{"id": 9}, {"id": 12}, {**self.comment, "id": 14, "parent_comment_id": 12}]
        response = self.client.post("/api/posts/9/comments", json={"body": "Hi", "parent_comment_id": 12, "author_id": 999})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(cursor.execute.call_args.args[1], (9, 7, 12, "Hi"))

    def test_comment_edits_require_author_and_cannot_restore_tombstones(self):
        self.login()
        cursor = self.cursors["comments"]
        cursor.fetchone.return_value = {"author_id": 8, "body": "Old"}
        self.assertEqual(self.client.patch("/api/comments/12", json={"body": "New"}).status_code, 403)
        cursor.fetchone.return_value = {"author_id": 7, "body": "[deleted]"}
        self.assertEqual(self.client.patch("/api/comments/12", json={"body": "New"}).status_code, 409)
        cursor.fetchone.side_effect = [{"author_id": 7, "body": "Old"}, {**self.comment, "body": "New"}]
        self.assertEqual(self.client.patch("/api/comments/12", json={"body": "New"}).status_code, 200)
        self.assertEqual(cursor.execute.call_args.args[1], ("New", 12))

    def test_comment_delete_keeps_replies_via_tombstone_and_removes_leaf(self):
        self.login()
        cursor = self.cursors["comments"]
        for child, expected in (({"id": 13}, "UPDATE public.comments SET body = '[deleted]'"), (None, "DELETE FROM public.comments")):
            with self.subTest(child=child):
                cursor.fetchone.side_effect = [{"author_id": 7}, child]
                self.assertEqual(self.client.delete("/api/comments/12").status_code, 204)
                self.assertIn(expected, cursor.execute.call_args.args[0])

    def test_vote_validation_rejects_booleans_and_out_of_range_values(self):
        self.login()
        for value in (True, False, None, "1", -2, 2):
            with self.subTest(value=value):
                self.assertEqual(self.client.put("/api/posts/9/vote", json={"value": value}).status_code, 400)
        self.databases["posts"].assert_not_called()

    def test_votes_are_idempotent_replaceable_and_bound_to_session(self):
        self.login()
        state = {(88, 9): 1}
        calls = []
        cursor = self.cursors["posts"]
        result = {}

        def execute(query, parameters):
            calls.append((query, parameters))
            if "SELECT id FROM public.posts" in query:
                result.update(id=9)
            elif "INSERT INTO public.post_votes" in query:
                self.assertIn("ON CONFLICT (user_id, post_id) DO UPDATE", query)
                state[(parameters[0], parameters[1])] = parameters[2]
            elif "DELETE FROM public.post_votes" in query:
                state.pop(parameters, None)
            elif "SUM(value)" in query:
                current_user, post_id = parameters
                result.clear()
                result.update(score=sum(value for (owner, post), value in state.items() if post == post_id), user_vote=state.get((current_user, post_id), 0))
        cursor.execute.side_effect = execute
        cursor.fetchone.side_effect = lambda: result.copy()
        for value, score in ((1, 2), (1, 2), (-1, 0), (0, 1), (0, 1)):
            with self.subTest(value=value):
                response = self.client.put("/api/posts/9/vote", json={"value": value, "user_id": 999})
                self.assertEqual(response.get_json(), {"score": score, "user_vote": value})
        self.assertNotIn((999, 9), state)

    def test_vote_missing_post_and_missing_migration_are_clear_errors(self):
        self.login()
        cursor = self.cursors["posts"]
        cursor.fetchone.return_value = None
        self.assertEqual(self.client.put("/api/posts/9/vote", json={"value": 1}).status_code, 404)
        cursor.fetchone.return_value = {"id": 9}
        cursor.execute.side_effect = [None, UndefinedTable()]
        response = self.client.put("/api/posts/9/vote", json={"value": 1})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["code"], "migration_required")

    def test_community_search_is_bound_and_signed_membership_is_personalized(self):
        self.login()
        cursor = self.cursors["communities"]
        cursor.fetchall.side_effect = [[{"id": 2, "name": "Earth", "description": None, "created_at": "2026-01-01", "post_count": 1, "member_count": 3}], [{"subreddit_id": 2}]]
        response = self.client.get("/api/subreddits", query_string={"q": "Earth' OR 1=1 --"})
        self.assertTrue(response.get_json()[0]["is_member"])
        first_query, first_parameters = cursor.execute.call_args_list[0].args
        self.assertNotIn("Earth'", first_query)
        self.assertEqual(first_parameters, ("%Earth' OR 1=1 --%", "%Earth' OR 1=1 --%"))
        self.assertEqual(cursor.execute.call_args.args[1], (7, [2]))
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_membership_join_leave_are_idempotent_and_ignore_forged_user(self):
        self.login()
        state = {(88, 2)}
        cursor = self.cursors["communities"]
        result = {}

        def execute(query, parameters):
            if "SELECT id FROM public.subreddits" in query:
                result.update(id=2)
            elif "INSERT INTO public.community_memberships" in query:
                self.assertIn("ON CONFLICT (user_id, subreddit_id) DO NOTHING", query)
                state.add(parameters)
            elif "DELETE FROM public.community_memberships" in query:
                state.discard(parameters)
            elif "COUNT(*) AS member_count" in query:
                result.clear()
                result.update(member_count=sum(community == parameters[0] for owner, community in state))
        cursor.execute.side_effect = execute
        cursor.fetchone.side_effect = lambda: result.copy()
        for joined, count in ((True, 2), (True, 2), (False, 1), (False, 1)):
            with self.subTest(joined=joined):
                response = self.client.put("/api/subreddits/2/membership", json={"joined": joined, "user_id": 999})
                self.assertEqual(response.get_json(), {"joined": joined, "member_count": count})
        self.assertNotIn((999, 2), state)

    def test_membership_requires_real_boolean_and_existing_community(self):
        self.login()
        for joined in (None, 1, "true"):
            self.assertEqual(self.client.put("/api/subreddits/2/membership", json={"joined": joined}).status_code, 400)
        self.databases["communities"].assert_not_called()
        self.cursors["communities"].fetchone.return_value = None
        self.assertEqual(self.client.put("/api/subreddits/2/membership", json={"joined": True}).status_code, 404)

    def test_bio_update_is_owner_only_and_preserves_public_response(self):
        self.login()
        self.assertEqual(self.client.put("/api/users/8", json={"bio": "Forged"}).status_code, 403)
        self.databases["users"].assert_not_called()
        cursor = self.cursors["users"]
        cursor.fetchone.return_value = {"id": 7, "username": "traveler", "bio": "Hi", "created_at": "2026-01-01", "updated_at": "2026-01-02"}
        self.assertEqual(self.client.put("/api/users/7", json={"bio": "Hi", "id": 999}).status_code, 200)
        self.assertEqual(cursor.execute.call_args.args[1], ("Hi", 7))

    def test_public_profile_comments_are_paged_and_link_to_posts(self):
        cursor = self.cursors["users"]
        cursor.fetchone.return_value = {"id": 7}
        cursor.fetchall.return_value = [{**self.comment, "author_username": "traveler", "post_title": "Orbit", "subreddit_id": 2, "subreddit_name": "Earth"}]
        response = self.client.get("/api/users/7/comments?limit=5&offset=10")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()[0]["post_title"], "Orbit")
        self.assertEqual(cursor.execute.call_args.args[1], (7, 5, 10))
        self.assertNotIn("password_hash", cursor.execute.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
