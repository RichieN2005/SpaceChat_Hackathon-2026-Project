"""Pure tests; can be run without Gemini credentials or a database."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.astrobot.service import is_mentioned


class MentionTests(unittest.TestCase):
    def test_explicit_mention(self):
        self.assertTrue(is_mentioned('Hello @AstroBot, is Europa icy?'))
        self.assertTrue(is_mentioned('@astrobot'))
        self.assertTrue(is_mentioned(None, 'Can you help, @ASTROBOT?'))

    def test_false_positives(self):
        self.assertFalse(is_mentioned('astrobot'))
        self.assertFalse(is_mentioned('hello@AstroBot.com'))
        self.assertFalse(is_mentioned('@AstroBot123'))
        self.assertFalse(is_mentioned(None, 'Hello universe'))


if __name__ == '__main__':
    unittest.main()
