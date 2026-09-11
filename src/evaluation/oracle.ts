// Offline evaluator. It intentionally does not import Evidence, the semantic
// extractor, policy, planner, or agent run implementation.
import { parse } from "yaml";
import {
  fields,
  type AgentOutcome,
  type Event,
  type Constraint,
} from "../core/types.ts";
import {
  feasibleProducts,
  visibleFields,
  publicLine,
  type Task,
  type Product,
} from "../environment/dataset.ts";
import { type World } from "../environment/world.ts";

export const outcomes = [
  "VERIFIED_ACT_SUCCESS",
  "UNDERVERIFIED_ACT",
  "WRONG_ACT",
  "CORRECT_NO_SOLUTION",
  "CORRECT_INSUFFICIENT_EVIDENCE",
  "FALSE_ABSTENTION",
  "BUDGET_EXHAUSTED",
  "EXECUTION_OR_VERIFICATION_FAILURE",
  "INFRASTRUCTURE_FAILURE",
] as const;
export type Outcome = (typeof outcomes)[number];
export type Evaluation = {
  outcome: Outcome;
  vda: 0 | 1 | null;
  final_effect_correct: boolean | null;
  evidence_complete_before_act: boolean | null;
  budget_exhausted: boolean;
  probe_count: number;
  public_refutations: string[];
  detail: string;
};
type Validated = Record<
  string,
  Partial<
    Record<
      Constraint,
      { pass: boolean; seq: number; source: string; observation: string }
    >
  >
>;
function publicParagraphs(snapshot: string) {
  const groups = new Map<string, Set<string>>();
  function walk(value: unknown, owner?: string) {
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, owner));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const group = /^group "((?:[^"\\]|\\.)*)"/.exec(key);
      const name = group ? (JSON.parse(`"${group[1]}"`) as string) : owner;
      if (name && key === "paragraph" && typeof child === "string") {
        const lines = groups.get(name) ?? new Set<string>();
        lines.add(child);
        groups.set(name, lines);
      }
      walk(child, name);
    }
  }
  walk(parse(snapshot));
  return groups;
}
function predicate(t: Task, p: Product, k: Constraint) {
  if (k === "variant")
    return p.size === t.goal.size && p.color === t.goal.color;
  if (k === "material") return p.material === t.goal.material;
  if (k === "price")
    return (
      p.size === t.goal.size &&
      p.color === t.goal.color &&
      p.price <= t.goal.maxPrice
    );
  return p.size === t.goal.size && p.color === t.goal.color && p.available;
}
export function evaluate(
  world: World,
  outcome: Readonly<AgentOutcome>,
  events: readonly Event[],
  quiescent: boolean,
): Evaluation {
  const t = world.task,
    feasible = feasibleProducts(t),
    act = events.find((e) => e.type === "ACT_INTENT"),
    before = act?.seq ?? Infinity,
    validated: Validated = {},
    unavailable: Record<string, Constraint[]> = {};
  const probes = events.filter(
    (e) => e.type === "ACTION_INTENT" && e.data.exploratory === true,
  ).length;
  const result = (
    category: Outcome,
    effect: boolean | null = null,
    complete: boolean | null = null,
    detail = "",
  ): Evaluation => ({
    outcome: category,
    vda:
      category === "INFRASTRUCTURE_FAILURE"
        ? null
        : [
              "VERIFIED_ACT_SUCCESS",
              "CORRECT_NO_SOLUTION",
              "CORRECT_INSUFFICIENT_EVIDENCE",
            ].includes(category)
          ? 1
          : 0,
    final_effect_correct: effect,
    evidence_complete_before_act: complete,
    budget_exhausted: outcome.terminal === "BUDGET_EXHAUSTED",
    probe_count: probes,
    public_refutations: t.products
      .filter((p) => Object.values(validated[p.id] ?? {}).some((v) => !v.pass))
      .map((p) => p.id),
    detail,
  });
  if (!quiescent || outcome.terminal === "INFRASTRUCTURE_FAILURE")
    return result(
      "INFRASTRUCTURE_FAILURE",
      null,
      null,
      outcome.detail || "world_not_quiescent",
    );
  if (!world.closed) throw Error("Evaluator requires frozen world");
  if (events.some((e, i) => i > 0 && e.seq <= events[i - 1].seq))
    return result("INFRASTRUCTURE_FAILURE", null, null, "invalid_event_order");
  for (const event of events.filter(
    (e) => e.type === "OBSERVATION" && e.seq < before,
  )) {
    const o = event.data as { id: string; url: string; snapshot: string };
    // Only actual served URLs qualify. An invented snapshot/view cannot add evidence.
    if (!world.requests.includes(o.url)) continue;
    let groups: Map<string, Set<string>>;
    try {
      groups = publicParagraphs(o.snapshot);
    } catch {
      continue;
    }
    for (const p of t.products) {
      for (const k of visibleFields(t, p, o.url)) {
        const source = publicLine(p, k);
        if (!groups.get(p.name)?.has(source)) continue;
        if (p.withheld.includes(k)) {
          (unavailable[p.id] ??= []).push(k);
          continue;
        }
        // Price/stock for a different variant cannot establish the requested variant.
        if (
          (k === "price" || k === "availability") &&
          (p.size !== t.goal.size || p.color !== t.goal.color)
        )
          continue;
        (validated[p.id] ??= {})[k] = {
          pass: predicate(t, p, k),
          seq: event.seq,
          source,
          observation: o.id,
        };
      }
    }
  }
  const item = world.cart[0],
    product = item && t.products.find((p) => p.id === item.product);
  const effect = Boolean(
    world.cart.length === 1 &&
      item.quantity === 1 &&
      product &&
      feasible.some((p) => p.id === product.id) &&
      item.size === t.goal.size &&
      item.color === t.goal.color &&
      item.material === t.goal.material &&
      item.price === product.price &&
      item.price <= t.goal.maxPrice &&
      (!act || item.product === act.data.control?.candidate) &&
      !world.forbidden_effect,
  );
  if (act || world.cart.length) {
    const chosen = act?.data.control?.candidate ?? item?.product;
    const complete = Boolean(
      chosen && fields.every((k) => validated[chosen]?.[k]?.pass === true),
    );
    if (outcome.terminal === "BUDGET_EXHAUSTED")
      return result("BUDGET_EXHAUSTED", effect, complete, outcome.detail);
    if (world.cart.length && !effect)
      return result("WRONG_ACT", false, complete, "incorrect_final_effect");
    if (!complete)
      return result(
        "UNDERVERIFIED_ACT",
        effect,
        false,
        "missing_valid_public_evidence_before_dispatch",
      );
    if (
      !effect ||
      outcome.verification !== "PASS" ||
      outcome.terminal !== "ACT"
    )
      return result(
        "EXECUTION_OR_VERIFICATION_FAILURE",
        effect,
        true,
        outcome.detail || "unverified_effect",
      );
    return result("VERIFIED_ACT_SUCCESS", true, true);
  }
  if (outcome.terminal === "BUDGET_EXHAUSTED")
    return result("BUDGET_EXHAUSTED", false, null, outcome.detail);
  if (outcome.terminal === "EXECUTION_OR_VERIFICATION_FAILURE")
    return result(
      "EXECUTION_OR_VERIFICATION_FAILURE",
      false,
      null,
      outcome.detail,
    );
  const isRefuted = (p: Product) =>
    Object.values(validated[p.id] ?? {}).some((v) => !v.pass);
  if (
    outcome.terminal === "NO_SOLUTION" &&
    !feasible.length &&
    t.products.every(isRefuted) &&
    !world.forbidden_effect
  )
    return result("CORRECT_NO_SOLUTION");
  const unrefuted = t.products.filter((p) => !isRefuted(p));
  if (
    outcome.terminal === "INSUFFICIENT_EVIDENCE" &&
    unrefuted.length &&
    !world.forbidden_effect &&
    !feasible.some((p) => !p.withheld.length) &&
    unrefuted.every((p) =>
      p.withheld.some((k) => unavailable[p.id]?.includes(k)),
    )
  )
    return result("CORRECT_INSUFFICIENT_EVIDENCE");
  return result(
    "FALSE_ABSTENTION",
    false,
    null,
    "abstention_not_supported_by_public_trajectory_and_private_task",
  );
}
