"""Narrow, fail-closed BrowserGym v0.13.4 click timeout adaptation.

BrowserGym's official HighLevelActionSet bid click action hardcodes 500 ms,
even when BrowserEnv.timeout is larger. We retain the official action parser
and evaluator and change only that exact line in THIS action-set instance.

Never retry/force a timed-out click: it may already have had a side effect.
This DEVELOPMENT-only change must be applied identically to both arms and
frozen before pilot/main; the episode records the configured timeout.
"""
from __future__ import annotations

from importlib.metadata import version as distribution_version

EXPECTED_BROWSERGYM_CORE_VERSION = "0.13.4"
UPSTREAM_CLICK_TIMEOUT_MS = 500
DEV_CLICK_TIMEOUT_MS = 3000

# The exact source expression in BrowserGym v0.13.4's
# browsergym.core.action.functions.click(), not dblclick().
_CLICK_LINE = (
    "elem.click(button=button, modifiers=modifiers, force=force, timeout=500)"
)


def configure_bounded_click_timeout(action_set) -> str:
    """Return installed version, or refuse incompatible source/version.

    This modifies the generated source for the stock 'click' action within
    this action-set object ONLY. It does not change BrowserGym's evaluator,
    action names/args, safety guards, or another module/process.
    """
    installed = distribution_version("browsergym-core")
    if installed != EXPECTED_BROWSERGYM_CORE_VERSION:
        raise RuntimeError(
            "BrowserGym core version changed; timeout adapter not audited "
            f"for {installed!r} (expected {EXPECTED_BROWSERGYM_CORE_VERSION}). "
            "Keep OpenApps uv.lock pinned instead of patching blindly."
        )
    source = getattr(action_set, "python_includes", None)
    if not isinstance(source, str):
        raise RuntimeError("BrowserGym action generator has no inspectable source")
    if source.count("retry_with_force=False") != 1:
        raise RuntimeError("Refuse unsafe BrowserGym click retry_with_force configuration")
    marker = "\ndef click("
    if source.count(marker) != 1:
        raise RuntimeError("BrowserGym click function source not uniquely found")
    start = source.index(marker)
    next_def = source.find("\ndef ", start + len(marker))
    if next_def == -1:
        next_def = len(source)
    original = source[start:next_def]
    if original.count(_CLICK_LINE) != 1:
        raise RuntimeError(
            "BrowserGym stock click timeout line changed; refusing unverified adapter"
        )
    updated = original.replace(
        _CLICK_LINE,
        _CLICK_LINE.replace(
            f"timeout={UPSTREAM_CLICK_TIMEOUT_MS}",
            f"timeout={DEV_CLICK_TIMEOUT_MS}",
        ),
    )
    action_set.python_includes = source[:start] + updated + source[next_def:]
    return installed
