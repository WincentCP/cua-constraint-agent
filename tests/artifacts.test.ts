import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureArtifactLayout,
  ensureMainRunLayout,
  mainTaskArtifactDir,
  refreshArtifactReport,
  taskArtifactDir,
} from "../src/experiment/artifacts.ts";

test("artifact layout separates research stages and generates an audit index", () => {
  const dir = mkdtempSync(join(tmpdir(), "cua-artifacts-"));
  try {
    const outputRoot = join(dir, "output", "poc");
    const reportRoot = join(dir, "reports", "poc");
    ensureArtifactLayout({
      stage: "poc",
      outputRoot,
      reportRoot,
      taskIds: [284],
    });

    const taskDir = taskArtifactDir(outputRoot, 284);
    assert(existsSync(join(taskDir, "accessibility")));
    assert(existsSync(join(outputRoot, "task-inputs")));
    assert(existsSync(join(outputRoot, "stage-manifest.json")));

    writeFileSync(join(taskDir, "network.har"), "{}", "utf8");
    const report = refreshArtifactReport({
      stage: "poc",
      outputRoot,
      reportRoot,
    });

    assert.equal(report.fileCount >= 2, true);
    assert(existsSync(report.indexJson));
    assert(existsSync(report.indexCsv));
    assert(existsSync(report.summary));
    assert.match(readFileSync(report.indexCsv, "utf8"), /284\/network\.har/);

    const mainRoot = join(dir, "output", "main", "exp-001");
    const mainReports = join(dir, "reports", "main", "exp-001");
    ensureArtifactLayout({
      stage: "main",
      experimentId: "exp-001",
      outputRoot: mainRoot,
      reportRoot: mainReports,
      taskIds: [284, 323],
    });
    ensureMainRunLayout({
      outputRoot: mainRoot,
      modelLabel: "qwen3.5-9b",
      method: "Baseline",
      taskIds: [284, 323],
    });

    assert(
      existsSync(
        join(
          mainTaskArtifactDir(mainRoot, "qwen3.5-9b", "Baseline", 284),
          "accessibility",
        ),
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
