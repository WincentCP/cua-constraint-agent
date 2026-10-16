import { createApprovedMainFreeze } from "../src/experiment/main-freeze.ts";

function option(name: string) {
  const pos = process.argv.indexOf("--" + name);
  return pos < 0 ? undefined : process.argv[pos + 1];
}
try {
  const experimentId = option("experiment-id");
  const digests = option("model-digests");
  const resetEvidence = option("reset-evidence");
  const approvedBy = option("approved-by");
  const approvalReference = option("approval-ref");
  if (!experimentId || !digests || !resetEvidence || !approvedBy || !approvalReference) {
    throw new Error(
      "Usage: npm run main:freeze -- --experiment-id thesis-v1 " +
      "--model-digests <local-json> --reset-evidence <local-reset-log> " +
      "--approved-by <supervisor> --approval-ref <approval-document>",
    );
  }
  const result = createApprovedMainFreeze({
    experimentId,
    digestsPath: digests,
    resetEvidencePath: resetEvidence,
    approvedBy,
    approvalReference,
    pilotRoot: option("pilot-output"),
    catalogPath: option("catalog"),
  });
  console.log("Research identity frozen: " + result.path);
  console.log("SHA-256: " + result.freeze.sha256);
  console.log("Note: this freezes the protocol; it does not run main episodes.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
