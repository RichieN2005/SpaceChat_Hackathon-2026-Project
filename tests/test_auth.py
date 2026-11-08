import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from flask import Flask

# Import the blueprint without loading local .env files or connecting to a database.
with patch("dotenv.load_dotenv", return_value=False):
    from api.auth import routes as auth_routes


class AuthRoutesTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(TESTING=True, SECRET_KEY="auth-test-only-secret")
        self.app.register_blueprint(auth_routes.auth)
        self.client = self.app.test_client()

        database_patch = patch.object(auth_routes, "database_cursor")
        self.database = database_patch.start()
        self.addCleanup(database_patch.stop)
        self.cursor = self.database.return_value.__enter__.return_value
        self.user = {
            "id": 7,
            "username": "cosmic_traveler",
            "bio": "Hello from Earth.",
            "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 1, 2, tzinfo=timezone.utc),
        }

    def set_session(self, user_id):
        with self.client.session_transaction() as session:
            session.clear()
            session["user_id"] = user_id
            session["old_state"] = "discard me"

    def test_me_requires_a_valid_signed_session(self):
        for user_id in (None, 0, -1, "7", True, 2**63):
            with self.subTest(user_id=user_id):
                self.set_session(user_id)
                response = self.client.get("/api/auth/me")
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.get_json(), {"error": "Login required"})
                self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.database.assert_not_called()

    def test_me_restores_user_from_session_without_password_hash(self):
        self.set_session(self.user["id"])
        self.cursor.fetchone.return_value = self.user.copy()

        response = self.client.get("/api/auth/me")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        user = response.get_json()["user"]
        self.assertEqual(set(user), {"id", "username", "bio", "created_at", "updated_at"})
        self.assertEqual(user["id"], 7)
        self.assertEqual(user["username"], "cosmic_traveler")
        self.assertEqual(user["created_at"], "2026-01-01T00:00:00+00:00")
        query, parameters = self.cursor.execute.call_args.args
        self.assertNotIn("password_hash", query)
        self.assertEqual(parameters, (7,))

        # A subsequent request uses the same browser session cookie.
        self.assertEqual(self.client.get("/api/auth/me").get_json(), response.get_json())

    def test_me_clears_session_when_user_was_deleted(self):
        self.set_session(self.user["id"])
        self.cursor.fetchone.return_value = None

        response = self.client.get("/api/auth/me")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Login required"})
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        with self.client.session_transaction() as session:
            self.assertEqual(dict(session), {})

    def test_logout_revokes_session_and_is_idempotent(self):
        self.set_session(self.user["id"])

        response = self.client.post("/api/auth/logout")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"message": "Logged out"})
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        with self.client.session_transaction() as session:
            self.assertEqual(dict(session), {})
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 200)
        self.database.assert_not_called()

    def test_login_sets_session_and_returns_public_user(self):
        with self.client.session_transaction() as session:
            session["old_state"] = "discard me"
        self.cursor.fetchmany.return_value = [{**self.user, "password_hash": "test-hash"}]

        with patch.object(auth_routes, "check_password_hash", return_value=True) as check_hash:
            response = self.client.post("/api/auth/login", json={
                "identifier": "cosmic_traveler", "password": "test-password",
            })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["id"], 7)
        self.assertNotIn("password_hash", response.get_json()["user"])
        check_hash.assert_called_once_with("test-hash", "test-password")
        with self.client.session_transaction() as session:
            self.assertEqual(dict(session), {"user_id": 7})

    def test_login_rejects_invalid_credentials(self):
        self.cursor.fetchmany.return_value = []

        response = self.client.post("/api/auth/login", json={
            "identifier": "unknown_traveler", "password": "test-password",
        })

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Invalid credentials"})
        with self.client.session_transaction() as session:
            self.assertNotIn("user_id", session)

    def test_register_preserves_response_contract_without_creating_session(self):
        self.cursor.fetchone.return_value = self.user.copy()

        with patch.object(auth_routes, "generate_password_hash", return_value="test-hash"):
            response = self.client.post("/api/auth/register", json={
                "username": "cosmic_traveler", "email": "TRAVELER@EARTH.TEST", "password": "test-password",
            })

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["id"], 7)
        self.assertNotIn("user", response.get_json())
        self.assertNotIn("password_hash", response.get_json())
        self.assertEqual(self.cursor.execute.call_args.args[1], ("cosmic_traveler", "traveler@earth.test", "test-hash"))
        with self.client.session_transaction() as session:
            self.assertNotIn("user_id", session)


if __name__ == "__main__":
    unittest.main()
