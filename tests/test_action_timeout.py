"""Fail-closed BrowserGym 0.13.4 click timeout adapter tests (no browser)."""
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

DIR = Path(__file__).resolve().parents[1] / "scripts" / "browsergym"
spec = importlib.util.spec_from_file_location(
    "action_timeout", DIR / "action_timeout.py"
)
mod = importlib.util.module_from_spec(spec)
sys.modules["action_timeout"] = mod
spec.loader.exec_module(mod)


class StubActionSet:
    def __init__(self, *, retry=False, click_line=None):
        default_line = (
            "elem.click(button=button, modifiers=modifiers, "
            "force=force, timeout=500)"
        )
        line = default_line if click_line is None else click_line
        self.python_includes = (
            f"retry_with_force={retry!r}\n"
            "def fill(bid, value):\n"
            "    elem.fill(value, force=False, timeout=500)\n\n"
            "def click(bid):\n"
            "    def do(force):\n"
            f"        {line}\n"
            "    call_fun(do, retry_with_force)\n\n"
            "def dblclick(bid):\n"
            "    elem.click(button=button, modifiers=modifiers, "
            "force=False, timeout=500)\n\n"
            "def press(bid, key):\n"
            "    elem.press(key, timeout=500)\n"
        )
    def to_python_code(self, action):
        return self.python_includes + "\n" + action


class BrowserGymClickTimeoutTests(unittest.TestCase):
    def test_only_stock_click_source_widened_and_action_parser_unchanged(self):
        actions = StubActionSet()
        before = actions.to_python_code('click("20")')
        with patch.object(mod, "distribution_version", return_value="0.13.4"):
            installed = mod.configure_bounded_click_timeout(actions)
        after = actions.to_python_code('click("20")')
        self.assertEqual(installed, "0.13.4")
        self.assertIn('click("20")', after)
        self.assertEqual(after.count("timeout=3000"), 1)
        self.assertEqual(after.count("timeout=500"), before.count("timeout=500") - 1)
        self.assertIn("elem.fill(value, force=False, timeout=500)", after)
        self.assertIn("elem.press(key, timeout=500)", after)
        self.assertIn(
            "elem.click(button=button, modifiers=modifiers, "
            "force=False, timeout=500)", after
        )
        self.assertIn("retry_with_force=False", after)

    def test_different_browsergym_version_fails_closed_and_source_unchanged(self):
        actions = StubActionSet()
        before = actions.python_includes
        with patch.object(mod, "distribution_version", return_value="0.14.0"):
            with self.assertRaisesRegex(RuntimeError, "version changed"):
                mod.configure_bounded_click_timeout(actions)
        self.assertEqual(before, actions.python_includes)

    def test_modified_upstream_click_signature_fails_closed(self):
        actions = StubActionSet(
            click_line="elem.click(button=button, modifiers=modifiers, "
                       "force=force, timeout=1000)"
        )
        before = actions.python_includes
        with patch.object(mod, "distribution_version", return_value="0.13.4"):
            with self.assertRaisesRegex(RuntimeError, "stock click timeout"):
                mod.configure_bounded_click_timeout(actions)
        self.assertEqual(before, actions.python_includes)

    def test_forced_click_retry_never_permitted(self):
        actions = StubActionSet(retry=True)
        before = actions.python_includes
        with patch.object(mod, "distribution_version", return_value="0.13.4"):
            with self.assertRaisesRegex(RuntimeError, "retry_with_force"):
                mod.configure_bounded_click_timeout(actions)
        self.assertEqual(before, actions.python_includes)

    def test_repeat_configuration_fails_closed(self):
        actions = StubActionSet()
        with patch.object(mod, "distribution_version", return_value="0.13.4"):
            mod.configure_bounded_click_timeout(actions)
            with self.assertRaisesRegex(RuntimeError, "stock click timeout"):
                mod.configure_bounded_click_timeout(actions)


if __name__ == "__main__":
    unittest.main()
