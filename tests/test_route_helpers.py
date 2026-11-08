"""Requires Flask (normally already installed for the SpaceChat backend)."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.astrobot.routes import _created_id


class ResponseShapeTests(unittest.TestCase):
    def test_post(self):
        self.assertEqual(_created_id({'id': 6}, 'post'), 6)
        self.assertEqual(_created_id({'post_id': 7}, 'post'), 7)
        self.assertEqual(_created_id({'post': {'id': 8}}, 'post'), 8)

    def test_comment(self):
        self.assertEqual(_created_id({'comment_id': 9}, 'comment'), 9)
        self.assertEqual(_created_id({'comment': {'id': 10}}, 'comment'), 10)
        self.assertIsNone(_created_id({'message':'Created'}, 'comment'))


if __name__ == '__main__':
    unittest.main()
