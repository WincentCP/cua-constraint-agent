import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { OllamaModel } from "../src/agent/ollama.ts";

test("model provenance requires local exact Ollama tag and SHA-256 digest", async () => {
  let mode: "valid" | "missing" | "invalid" = "valid";
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    if (mode === "missing") {
      response.end(JSON.stringify({ models: [] }));
    } else if (mode === "invalid") {
      response.end(
        JSON.stringify({
          models: [
            {
              model: "my-research-model:Q4_K_M",
              digest: "NOT_A_DIGEST",
            },
          ],
        }),
      );
    } else {
      response.end(
        JSON.stringify({
          models: [
            {
              name: "my-research-model:Q4_K_M",
              digest: "A".repeat(64),
            },
          ],
        }),
      );
    }
  });
  server.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string")
      throw new Error("Unexpected listener");
    const model = new OllamaModel(
      "my-research-model:Q4_K_M",
      "http://127.0.0.1:" + addr.port,
    );
    assert.equal(await model.resolveDigest(), "a".repeat(64));
    mode = "missing";
    await assert.rejects(model.resolveDigest(), /model missing/);
    mode = "invalid";
    await assert.rejects(model.resolveDigest(), /digest unavailable/);
    assert.throws(
      () => new OllamaModel("x", "https://remote.example"),
      /local/,
    );
  } finally {
    server.close();
    await once(server, "close");
  }
});
