import { parse } from "yaml";
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
