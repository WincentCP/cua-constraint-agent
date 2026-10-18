import type { ConstraintSpec } from "../core/types.ts";

export type PocTask = {
  key: string;
  family: string;
  constraints: ConstraintSpec[];
};

const constraint = (id: string, description: string, hints: string[]): ConstraintSpec => ({
  id, description, hints, required: true,
});

// Only PUBLIC task instructions are encoded here. Expected ledger figures and
// OpenApps evaluator state MUST NEVER enter the agent prompt or this manifest.
export const pocTasks: PocTask[] = [
  {
    key: "add_todo_to_review_largest_card_charge",
    family: "ledger-extremum",
    constraints: [
      constraint("account", "Inspect the specified business checking account.", ["openbanking", "account", "chk"]),
      constraint("transaction_type", "Restrict the search to Card transactions.", ["card", "transaction", "type"]),
      constraint("maximum_charge", "Compare eligible charges and find the largest debit.", ["amount", "transaction", "card"]),
      constraint("todo", "Create the requested review-charge todo using the observed amount.", ["todo", "add", "new"]),
    ],
  },
  {
    key: "reconcile_the_largest_account",
    family: "cross-account-comparison",
    constraints: [
      constraint("comparison", "Inspect all accounts and compare available balances.", ["balance", "account", "available"]),
      constraint("identify", "Identify the account with the highest available balance.", ["account", "balance"]),
      constraint("message", "Send Alice the observed account name, with nothing else.", ["messages", "alice", "send"]),
      constraint("todo", "Add a reconciliation todo using the observed account name.", ["todo", "add", "new"]),
    ],
  },
  {
    key: "report_the_card_statement_balance_and_headroom",
    family: "card-metric-disambiguation",
    constraints: [
      constraint("account", "Inspect the specified business card account.", ["card", "openbanking", "account"]),
      constraint("statement", "Distinguish statement balance from current balance.", ["statement", "balance"]),
      constraint("headroom", "Read remaining available credit rather than the current balance.", ["available", "credit", "limit"]),
      constraint("message", "Send Bob exactly the observed statement balance.", ["message", "bob", "send"]),
      constraint("todo", "Add the requested Headroom todo using observed available credit.", ["todo", "new", "add"]),
    ],
  },
];

export function requirePocTask(key: string): PocTask {
  const task = pocTasks.find((entry) => entry.key === key);
  if (!task) {
    throw new Error("Unregistered PoC task: " + key +
      ". Pilot/main are BLOCKED until suitability, evaluator and reset gates pass.");
  }
  return task;
}

export function requireLoopbackUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error("Use a local HTTP OpenApps URL such as http://localhost:5001");
  }
  return url.origin + "/";
}
