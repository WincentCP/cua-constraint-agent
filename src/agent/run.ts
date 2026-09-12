import { type Config } from "../core/config.ts";
import {
  GoalSchema,
  emptyCounters,
  fields,
  RunFailure,
  type Goal,
  type Policy,
  type Log,
  type Control,
  type Observation,
  type Probe,
  type AgentOutcome,
} from "../core/types.ts";
import {
  Evidence,
  satisfied,
  refuted,
  evidenceUnavailable,
} from "../core/evidence.ts";
import { selectProbe } from "../core/policy.ts";
import { coverage } from "../browser/semantic.ts";
import { type Driver, verifyCart } from "../browser/session.ts";
import { type Model, sharedInput, scoreProbes } from "./planner.ts";

export async function runAgent(
  driver: Driver,
  publicGoal: Goal,
  policy: Policy,
  model: Model,
  config: Config,
  log: Log,
  externalSignal?: AbortSignal,
): Promise<AgentOutcome> {
  const goal = GoalSchema.parse(structuredClone(publicGoal)),
    started = Date.now(),
    counters = emptyCounters(),
    evidence = new Evidence(),
    known = new Map<string, Control>(),
    visited = new Set<string>(),
    history: { probe_id: string; name: string }[] = [];
  const deadline = AbortSignal.timeout(config.budget.deadline_ms),
    signal = externalSignal
      ? AbortSignal.any([externalSignal, deadline])
      : deadline;
  let selected: string | null = null,
    verification: AgentOutcome["verification"] = "NOT_RUN";
  const interrupt = () => {
    void driver.close().catch(() => {});
  };
  signal.addEventListener("abort", interrupt, { once: true });
  const check = () => {
    if (deadline.aborted)
      throw new RunFailure("BUDGET_EXHAUSTED", "run_deadline");
    if (externalSignal?.aborted)
      throw new RunFailure("INFRASTRUCTURE_FAILURE", "process_interrupted");
  };
  const capture = async () => {
    check();
    const o = await driver.observe(counters.probes);
    check();
    counters.observations++;
    evidence.add(o.facts);
    for (const c of o.controls)
      if (c.kind === "probe" && !known.has(c.url)) known.set(c.url, c);
    log("EVIDENCE_STATE", {
      observation: o.id,
      ledger: evidence.ledger(o.candidates, goal),
    });
    return o;
  };
  const action = async (control: Control, exploratory: boolean) => {
    check();
    if (
      counters.actions >= config.budget.actions ||
      (exploratory && counters.probes >= config.budget.probes)
    )
      throw new RunFailure("BUDGET_EXHAUSTED", "interaction_limit");
    log(control.kind === "act" ? "ACT_INTENT" : "ACTION_INTENT", {
      control,
      exploratory,
      step: counters.probes,
    });
    // Durable intent above must succeed before an action is dispatched.
    counters.actions++;
    if (exploratory) counters.probes++;
    await driver.click(
      control,
      Math.max(
        1,
        Math.min(
          config.budget.action_ms,
          config.budget.deadline_ms - (Date.now() - started),
        ),
      ),
    );
    check();
  };
  const navigate = async (
    target: Control,
    o: Observation,
  ): Promise<Observation> => {
    if (o.controls.some((c) => c.url === target.url && c.kind === target.kind))
      return o;
    if (o.url !== "/") {
      const back = o.controls.find((c) => c.url === "/");
      if (!back)
        throw new RunFailure(
          "EXECUTION_OR_VERIFICATION_FAILURE",
          "missing_return",
        );
      await action(back, false);
      o = await capture();
    }
    if (target.url.includes("?") || target.kind === "act") {
      const detail = o.controls.find(
        (c) => c.url === `/product/${target.candidate}`,
      );
      if (!detail)
        throw new RunFailure(
          "EXECUTION_OR_VERIFICATION_FAILURE",
          "missing_restore",
        );
      await action(detail, false);
      o = await capture();
    }
    return o;
  };
  const finish = (
    terminal: AgentOutcome["terminal"],
    detail = "",
  ): AgentOutcome => ({
    terminal,
    detail,
    selected,
    verification,
    counters: structuredClone(counters),
    started: new Date(started).toISOString(),
    ended: new Date().toISOString(),
    wall_ms: Date.now() - started,
  });
  try {
    let o = await capture();
    if (o.candidates.length !== 3)
      throw new RunFailure(
        "EXECUTION_OR_VERIFICATION_FAILURE",
        "three_candidates_required",
      );
    for (;;) {
      check();
      const ledger = evidence.ledger(o.candidates, goal),
        ready = o.candidates.find((c) => satisfied(ledger, c.id));
      if (ready) {
        selected = ready.id;
        o = await navigate(
          {
            candidate: ready.id,
            name: "Tambah satu ke keranjang",
            role: "button",
            url: `/add/${ready.id}`,
            kind: "act",
          },
          o,
        );
        const fresh = evidence.ledger(o.candidates, goal);
        if (!satisfied(fresh, ready.id))
          throw new RunFailure(
            "EXECUTION_OR_VERIFICATION_FAILURE",
            "act_guard_rejected",
          );
        const add = o.controls.find(
          (c) => c.kind === "act" && c.candidate === ready.id,
        );
        if (!add)
          throw new RunFailure(
            "EXECUTION_OR_VERIFICATION_FAILURE",
            "missing_act_control",
          );
        const price = fresh[ready.id].price.sources.find(
          (f) => typeof f.value === "number",
        )!.value as number;
        log("PRE_ACT_EVIDENCE", {
          candidate: ready.id,
          ledger: fresh[ready.id],
          observation: o.id,
          step: counters.probes,
        });
        await action(add, false);
        o = await capture();
        verification = verifyCart(o, ready.id, goal.size, goal.color, price)
          ? "PASS"
          : "FAIL";
        if (verification === "FAIL") {
          o = await capture();
          verification = verifyCart(o, ready.id, goal.size, goal.color, price)
            ? "PASS"
            : "FAIL";
        }
        log("VERIFICATION", { status: verification });
        return finish(
          verification === "PASS" ? "ACT" : "EXECUTION_OR_VERIFICATION_FAILURE",
          verification === "PASS" ? "" : "cart_postcondition_failed",
        );
      }
      const viable = o.candidates.filter((c) => !refuted(ledger, c.id));
      if (!viable.length) return finish("NO_SOLUTION");
      if (viable.every((c) => evidenceUnavailable(ledger, c.id)))
        return finish("INSUFFICIENT_EVIDENCE");
      const probes: Probe[] = [...known.values()]
        .map((c, order) => {
          const cost = o.controls.some((x) => x.url === c.url)
            ? 1
            : (o.url === "/" ? 0 : 1) + (c.url.includes("?") ? 2 : 1);
          return {
            id: c.url,
            candidate: c.candidate,
            name: c.name,
            url: c.url,
            may_answer: coverage(c.name),
            forward_cost: cost,
            action_cost: cost,
            order,
          };
        })
        .filter((p) => !visited.has(p.id) && !refuted(ledger, p.candidate));
      const eligible = probes.filter(
        (p) =>
          p.action_cost <= config.budget.actions - counters.actions &&
          counters.probes < config.budget.probes,
      );
      if (!eligible.length) {
        if (probes.length)
          throw new RunFailure("BUDGET_EXHAUSTED", "interaction_limit");
        return finish("INSUFFICIENT_EVIDENCE", "supported_routes_exhausted");
      }
      const input = sharedInput(goal, o, ledger, eligible, history, {
        probes: config.budget.probes - counters.probes,
        actions: config.budget.actions - counters.actions,
        model_calls: config.budget.model_calls - counters.model_calls,
      });
      const scores =
        eligible.length === 1
          ? { [eligible[0].id]: 0 }
          : await scoreProbes(model, input, counters, config, signal, log);
      const probe = selectProbe(policy, eligible, ledger, scores);
      log("PROBE_SELECTION", {
        input,
        scores,
        selected: probe,
        reason:
          eligible.length === 1
            ? "SINGLE_ELIGIBLE"
            : policy === "Proposed"
              ? "UNKNOWN_COVERAGE"
              : "GENERIC_PROGRESS",
      });
      const target = known.get(probe.id)!;
      o = await navigate(target, o);
      let failed: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt) {
          if (counters.recoveries >= config.budget.recoveries) break;
          counters.recoveries++;
          log("BROWSER_RECOVERY", { probe: probe.id });
          o = await capture();
        }
        try {
          const live = o.controls.find((c) => c.url === target.url);
          if (!live)
            throw new RunFailure(
              "EXECUTION_OR_VERIFICATION_FAILURE",
              "stale_probe",
            );
          await action(live, true);
          o = await capture();
          if (o.url !== target.url)
            throw new RunFailure(
              "EXECUTION_OR_VERIFICATION_FAILURE",
              "probe_postcondition_failed",
            );
          failed = undefined;
          break;
        } catch (e) {
          check();
          if (e instanceof RunFailure && e.terminal === "BUDGET_EXHAUSTED")
            throw e;
          failed = e;
        }
      }
      if (failed) throw failed;
      visited.add(probe.id);
      history.push({ probe_id: probe.id, name: probe.name });
      const after = evidence.ledger(o.candidates, goal);
      if (
        o.candidates.some((c) =>
          fields.some(
            (k) =>
              ledger[c.id][k].state === "UNKNOWN" &&
              after[c.id][k].state !== "UNKNOWN",
          ),
        )
      )
        counters.informative_probes++;
    }
  } catch (e) {
    if (deadline.aborted) return finish("BUDGET_EXHAUSTED", "run_deadline");
    if (externalSignal?.aborted)
      return finish("INFRASTRUCTURE_FAILURE", "process_interrupted");
    const detail = e instanceof Error ? e.message : String(e);
    return finish(
      e instanceof RunFailure
        ? e.terminal
        : /closed|crash|connect|storage/i.test(detail)
          ? "INFRASTRUCTURE_FAILURE"
          : "EXECUTION_OR_VERIFICATION_FAILURE",
      detail,
    );
  } finally {
    signal.removeEventListener("abort", interrupt);
  }
}
