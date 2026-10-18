import { parse } from "yaml";
import type { Locator } from "playwright";
import type {
  AccessibleControl,
  ConstraintSpec,
  Probe,
} from "../core/types.ts";

export type AccessibleNode = {
  role: string;
  name: string;
  text: string;
  states: string;
  url?: string;
  children: AccessibleNode[];
};

export const flatten = (nodes: AccessibleNode[]): AccessibleNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

export function parseAccessibilitySnapshot(snapshot: string): AccessibleNode[] {
  const visit = (raw: unknown): AccessibleNode[] => {
    if (Array.isArray(raw)) return raw.flatMap(visit);
    if (typeof raw === "string") return [make(raw, undefined)];
    if (!raw || typeof raw !== "object") return [];
    return Object.entries(raw)
      .filter(([key]) => !key.startsWith("/"))
      .map(([key, value]) => make(key, value));
  };

  const make = (key: string, value: unknown): AccessibleNode => {
    const match = /^(\w+)(?: "((?:[^"\\]|\\.)*)")?(.*)$/.exec(key);
    const name = match?.[2] ? (JSON.parse(`"${match[2]}"`) as string) : "";
    const url = Array.isArray(value)
      ? value.find(
          (item) => item && typeof item === "object" && "/url" in item,
        )?.["/url"]
      : undefined;

    return {
      role: match?.[1] ?? "text",
      name,
      text: typeof value === "string" ? value : "",
      states: match?.[3] ?? "",
      url: typeof url === "string" ? url : undefined,
      children: visit(value),
    };
  };

  return visit(parse(snapshot));
}

function isControlRole(role: string): role is AccessibleControl["role"] {
  return ["link", "button", "textbox", "combobox"].includes(role);
}

export function extractControls(snapshot: string): AccessibleControl[] {
  const nodes = flatten(parseAccessibilitySnapshot(snapshot));
  const controls: AccessibleControl[] = [];
  let serial = 0;

  for (const node of nodes) {
    if (!isControlRole(node.role)) continue;
    const name = node.name.trim();
    if (!name && node.role !== "textbox") continue;
    controls.push({
      id: `control-${++serial}`,
      role: node.role,
      name,
      url: node.url,
    });
  }

  return controls;
}

function normalized(value: string) {
  return value.toLocaleLowerCase("en-US");
}

export function constraintsForControl(
  control: AccessibleControl,
  constraints: ConstraintSpec[],
) {
  const haystack = normalized(`${control.name} ${control.url ?? ""}`);
  return constraints
    .filter((constraint) =>
      constraint.hints.some((hint) => haystack.includes(normalized(hint))),
    )
    .map((constraint) => constraint.id);
}

export function probesFromControls(
  controls: AccessibleControl[],
  constraints: ConstraintSpec[],
  subject = "task",
): Probe[] {
  return controls.map((control, order) => ({
    id: `${control.role}:${order}:${control.name || control.url || "unnamed"}`,
    subject,
    label: control.name || control.url || `control-${order}`,
    control,
    may_answer: constraintsForControl(control, constraints),
    forward_cost: 1,
    order,
  }));
}


// OpenApps' bank account rows are visible clickable <div hx-get=...> elements,
// not ARIA buttons or links. The AX tree includes their text but not a control
// role. This supplement discovers their public UI affordance without giving the
// model URL endpoints, HTML attributes, hidden values or evaluator state.
// Both policy arms receive the identical candidates and interaction adapter.
export const NONSEMANTIC_CLICK_SELECTOR = "div[hx-get], div[hx-post]";

export async function extractVisibleClickables(root: Locator): Promise<AccessibleControl[]> {
  // Critical: one browser-side read. HTMX can replace account rows between
  // count(), isVisible(), getAttribute(), and innerText() calls; a stale nth(i)
  // locator otherwise waits the default 30 seconds and invalidates an episode.
  // Keep indices from the entire matched set so the subsequent click locates
  // the same public UI row, even when hidden rows precede it.
  const items = await root.locator(NONSEMANTIC_CLICK_SELECTOR).evaluateAll(
    (elements) => elements.slice(0, 150).flatMap((element, i) => {
      if (!(element instanceof HTMLElement)) return [];
      if (element.getClientRects().length === 0) return [];
      if (getComputedStyle(element).visibility !== "visible") return [];
      if (element.closest('[aria-hidden="true"]')) return [];
      const role = (element.getAttribute("role") ?? "").toLowerCase();
      if (role === "button" || role === "link") return [];
      const label = element.innerText.replace(/\s+/g, " ").trim().slice(0, 240);
      if (!label) return [];
      return [{ domIndex: i, label }];
    }),
  );
  return items.map(({ domIndex, label }) => ({
    id: "visible-clickable-" + domIndex,
    role: "clickable" as const,
    name: label,
    domIndex,
  }));
}
