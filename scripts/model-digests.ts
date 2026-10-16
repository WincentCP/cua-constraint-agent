import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { OllamaModel } from "../src/agent/ollama.ts";

async function main() {
  const path = resolve("config/model-digests.local.json");
  if (existsSync(path)) {
    throw new Error(
      "Model digest manifest already exists; preserve its contents and archive before regenerating.",
    );
  }
  const models = JSON.parse(
    readFileSync("config/models.json", "utf8"),
  ) as Array<{
    label: string;
    name: string;
  }>;
  const manifest = [];
  for (const model of models) {
    const digest = await new OllamaModel(model.name).resolveDigest();
    manifest.push({ label: model.label, name: model.name, digest });
    console.log(
      "Resolved model " + model.label + ": " + digest.slice(0, 12) + "...",
    );
  }
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log("Created local digest manifest (gitignored): " + path);
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
