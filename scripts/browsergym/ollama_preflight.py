"""Read-only local Ollama preflight for the BrowserGym/OpenApps thesis.

Checks the exact selected model tag, records the Ollama digest and performs
one harmless structured JSON chat. This NEVER starts a browser episode,
changes OpenApps state or claims task success.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
MODELS_FILE = ROOT / "config" / "models.json"


def validate_ollama_url(value: str) -> str:
    p = urlsplit(value)
    if (p.scheme != "http" or p.hostname not in ("127.0.0.1", "localhost")
            or p.port is None or p.username or p.password
            or p.path not in ("", "/") or p.query or p.fragment):
        raise ValueError("Ollama URL must be a loopback HTTP origin with port")
    return "http://" + p.hostname + ":" + str(p.port)


def get_model(models: list[dict], label: str) -> str:
    matching = [m["name"] for m in models if m.get("label") == label]
    if len(matching) != 1:
        raise ValueError("Unknown or ambiguous model label: " + label)
    return matching[0]


def find_installed_model(payload: dict, model: str) -> dict:
    entries = payload.get("models", [])
    if not isinstance(entries, list):
        raise ValueError("Malformed Ollama /api/tags model list")
    for entry in entries:
        if isinstance(entry, dict) and (entry.get("name") == model or entry.get("model") == model):
            return {"name": model, "digest": entry.get("digest")}
    raise LookupError("Selected model not installed: " + model)


def validate_structured_reply(payload: dict) -> bool:
    response = payload.get("message")
    if not isinstance(response, dict):
        raise ValueError("Ollama chat response missing message")
    content = response.get("content")
    if not isinstance(content, str) or not content.strip():
        # Ollama thinking models may exhaust num_predict before emitting
        # visible message.content. Only log metadata, never reasoning text.
        thought = response.get("thinking")
        diagnostic = {
            "done_reason": payload.get("done_reason"),
            "eval_count": payload.get("eval_count"),
            "thinking_characters": len(thought) if isinstance(thought, str) else 0,
        }
        raise ValueError(
            "Ollama chat response has empty content; diagnostic="
            + json.dumps(diagnostic, sort_keys=True)
        )
    obj = json.loads(content)
    if not isinstance(obj, dict) or obj.get("ready") is not True:
        raise ValueError('Expected a JSON object containing {"ready":true}')
    return True


def request_json(url: str, data: dict | None = None, timeout: int = 15) -> dict:
    body = None if data is None else json.dumps(data).encode("utf-8")
    req = Request(url, data=body, headers={"Content-Type": "application/json"} if body else {})
    with urlopen(req, timeout=timeout) as response:
        result = json.load(response)
    if not isinstance(result, dict):
        raise ValueError("Ollama returned non-object JSON")
    return result


def probe(model: str, base_url: str, do_chat: bool = True, client=request_json) -> dict:
    url = validate_ollama_url(base_url)
    status = find_installed_model(client(url + "/api/tags", timeout=15), model)
    outcome = {"model_name": status["name"], "model_digest": status["digest"],
               "tags_verified": True, "chat_verified": False}
    if do_chat:
        payload = {
            "model": model,
            "stream": False,
            # Qwen3.5 thinks by default. In Ollama this MUST be top-level:
            # placing 'think' inside 'options' is ignored.
            "think": False,
            "format": "json",
            "messages": [
                {"role": "system", "content": "Return only a JSON object, no markdown."},
                {"role": "user", "content": 'Reply with exactly {"ready":true}.'},
            ],
            "options": {"temperature": 0, "num_predict": 256},
        }
        validate_structured_reply(client(url + "/api/chat", data=payload, timeout=180))
        outcome["chat_verified"] = True
    return outcome


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--model-label", default="qwen3.5-9b")
    ap.add_argument("--url", default="http://127.0.0.1:11434")
    ap.add_argument("--tags-only", action="store_true")
    args = ap.parse_args(argv)
    output = ROOT / "output" / "ollama" / "preflight"
    output.mkdir(parents=True, exist_ok=True)
    artifact = output / (uuid4().hex + ".json")
    record = {"status": "invalid_preflight", "label": args.model_label,
              "test": "local model API / structured output only; no browser episode"}
    try:
        models = json.loads(MODELS_FILE.read_text(encoding="utf-8"))
        model = get_model(models, args.model_label)
        record["expected_model_name"] = model
        result = probe(model, args.url, do_chat=not args.tags_only)
        record.update(result)
        record["status"] = "preflight_pass"
    except (ValueError, LookupError, OSError, HTTPError, URLError, TimeoutError) as error:
        record["error"] = type(error).__name__ + ": " + str(error)
        print("INVALID OLLAMA PREFLIGHT: " + record["error"], file=sys.stderr)
        code = 2
    except Exception as error:
        record["error"] = type(error).__name__ + ": " + str(error)
        print("INVALID OLLAMA PREFLIGHT: " + record["error"], file=sys.stderr)
        code = 2
    else:
        print("PASS: local Ollama model tag" +
              (" and structured JSON chat" if not args.tags_only else " verified"))
        print("Model: " + record["model_name"])
        print("Digest: " + str(record["model_digest"]))
        print("No OpenApps state changed.")
        code = 0
    finally:
        artifact.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        print("Artifact: " + str(artifact))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
