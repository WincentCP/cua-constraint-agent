import { parse } from "yaml";
import {
  type Candidate,
  type Constraint,
  type Control,
  type Fact,
  type Observation,
} from "../core/types.ts";

export type Node = {
  role: string;
  name: string;
  text: string;
  states: string;
  url?: string;
  children: Node[];
};
export const flatten = (nodes: Node[]): Node[] =>
  nodes.flatMap((n) => [n, ...flatten(n.children)]);
export function parseTree(snapshot: string): Node[] {
  const visit = (raw: unknown): Node[] => {
    if (Array.isArray(raw)) return raw.flatMap(visit);
    if (typeof raw === "string") return [make(raw, undefined)];
    if (!raw || typeof raw !== "object") return [];
    return Object.entries(raw)
      .filter(([k]) => !k.startsWith("/"))
      .map(([k, v]) => make(k, v));
  };
  const make = (key: string, value: unknown): Node => {
    const m = /^(\w+)(?: "((?:[^"\\]|\\.)*)")?(.*)$/.exec(key);
    const name = m?.[2] ? (JSON.parse(`"${m[2]}"`) as string) : "";
    const url = Array.isArray(value)
      ? value.find((v) => v && typeof v === "object" && "/url" in v)?.["/url"]
      : undefined;
    return {
      role: m?.[1] ?? "text",
      name,
      text:
        typeof value === "string"
          ? value
          : key.startsWith("text ")
            ? key.slice(5)
            : "",
      states: m?.[3] ?? "",
      url,
      children: visit(value),
    };
  };
  return visit(parse(snapshot));
}
export const coverage = (name: string): Constraint[] => {
  const text = name.toLocaleLowerCase("id");
  return [
    text.includes("varian") ? "variant" : null,
    text.includes("bahan") ? "material" : null,
    text.includes("harga") ? "price" : null,
    /stok|ketersediaan/.test(text) ? "availability" : null,
  ].filter((x): x is Constraint => x !== null);
};
export function observationFrom(
  snapshot: string,
  url: string,
  known: Candidate[],
  step: number,
  id: string,
): Observation {
  const timestamp = new Date().toISOString(),
    tree = parseTree(snapshot),
    all = flatten(tree),
    candidates = [...known];
  for (const group of all.filter((n) => n.role === "group")) {
    const link = flatten(group.children).find(
      (n) => n.role === "link" && n.url?.startsWith("/product/"),
    );
    if (link) {
      const candidate = link.url!.split("?")[0].split("/").at(-1)!;
      if (!candidates.some((c) => c.id === candidate))
        candidates.push({ id: candidate, name: group.name });
    }
  }
  const controls: Control[] = [],
    facts: Fact[] = [];
  for (const node of all.filter(
    (n) => n.role === "link" && (n.url === "/" || n.url === "/cart"),
  ))
    controls.push({
      candidate: "",
      name: node.name,
      role: "link",
      url: node.url!,
      kind: "back",
    });
  for (const candidate of candidates) {
    for (const group of all.filter(
      (n) => n.role === "group" && n.name === candidate.name,
    )) {
      for (const node of flatten(group.children)) {
        if (
          node.role === "link" &&
          node.url?.startsWith(`/product/${candidate.id}`) &&
          coverage(node.name).length
        )
          controls.push({
            candidate: candidate.id,
            name: node.name,
            role: "link",
            url: node.url,
            kind: "probe",
          });
        if (node.role === "button" && node.name === "Tambah satu ke keranjang")
          controls.push({
            candidate: candidate.id,
            name: node.name,
            role: "button",
            url: `/add/${candidate.id}`,
            kind: "act",
          });
        if (node.role !== "paragraph") continue;
        const text = node.text || node.name;
        let constraint: Constraint | undefined,
          value: Fact["value"] = null,
          scope: Fact["scope"];
        const variant = /^Varian: (\S+) \/ (.+)$/.exec(text),
          material = /^Bahan: (.+)$/.exec(text),
          price = /^Harga untuk (\S+) \/ (.+): (.+)$/.exec(text),
          stock = /^Stok untuk (\S+) \/ (.+): (.+)$/.exec(text);
        if (variant) {
          constraint = "variant";
          value = { size: variant[1], color: variant[2] };
        }
        if (text === "Varian: belum dipublikasikan") {
          constraint = "variant";
          value = null;
        }
        if (material) {
          constraint = "material";
          value = material[1] === "belum dipublikasikan" ? null : material[1];
        }
        if (price) {
          constraint = "price";
          scope = { size: price[1], color: price[2] };
          value = /^Rp[\d.]+$/.test(price[3])
            ? Number(price[3].slice(2).replaceAll(".", ""))
            : null;
        }
        if (stock) {
          constraint = "availability";
          scope = { size: stock[1], color: stock[2] };
          value =
            stock[3] === "tersedia"
              ? true
              : stock[3] === "tidak tersedia"
                ? false
                : null;
        }
        if (constraint)
          facts.push({
            candidate: candidate.id,
            constraint,
            value,
            scope,
            source: text,
            observation: id,
            step,
            timestamp,
          });
      }
    }
  }
  return { id, url, snapshot, candidates, controls, facts, step, timestamp };
}
