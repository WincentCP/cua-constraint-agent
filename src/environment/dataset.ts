// Private fixture module. Never import this module from agent/, browser/ or core/.
import { fields, type Constraint, type Goal } from "../core/types.ts";
import { hash, config } from "../core/config.ts";
import { collection } from "./catalog.ts";

export type TaskType = "solvable" | "no-solution" | "unavailable-evidence";
export type Subtype = "single-feasible" | "multi-feasible" | null;
export type Product = {
  id: string;
  name: string;
  size: string;
  color: string;
  material: string;
  price: number;
  available: boolean;
  withheld: Constraint[];
};
export type Task = {
  id: string;
  split: "development" | "main";
  type: TaskType;
  subtype: Subtype;
  unknown: 2 | 3 | 4;
  goal: Goal;
  instruction: string;
  initial: Constraint[];
  products: Product[];
};
export const panelFields: Record<string, Constraint[]> = {
  detail: ["variant", "material"],
  offer: ["price", "availability"],
  price: ["price"],
  material: ["material"],
  stock: ["availability"],
};
export const panelNames: Record<string, string> = {
  detail: "Varian dan bahan",
  offer: "Harga dan stok",
  price: "Rincian harga",
  material: "Informasi bahan",
  stock: "Ketersediaan",
};
export function rng(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
export function shuffle<T>(items: T[], random: () => number) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// U-level means "how many constraints are initially UNKNOWN", not a fixed
// hidden-constraint identity. Rotating the hidden combinations prevents RQ3
// from being confounded by always hiding the same facts at each U-level.
const hiddenPatterns: Record<Task["unknown"], Constraint[][]> = {
  2: [
    ["variant", "material"],
    ["variant", "price"],
    ["variant", "availability"],
    ["material", "price"],
    ["material", "availability"],
    ["price", "availability"],
  ],
  3: [
    ["variant", "material", "price"],
    ["variant", "material", "availability"],
    ["variant", "price", "availability"],
    ["material", "price", "availability"],
  ],
  4: [["variant", "material", "price", "availability"]],
};
const hiddenPattern = (unknown: Task["unknown"], ordinal: number) =>
  hiddenPatterns[unknown][ordinal % hiddenPatterns[unknown].length];

function generate(
  split: Task["split"],
  index: number,
  type: TaskType,
  subtype: Subtype,
  unknown: Task["unknown"],
  hidden: Constraint[],
  unavailableConstraint: Constraint | null,
): Task {
  const identity = `${split}:${index}`,
    random = rng(parseInt(hash(`attributes:${identity}`).slice(0, 8), 16));
  const goal: Goal = {
    size: ["S", "M", "L", "XL"][Math.floor(random() * 4)],
    color: ["merah", "biru", "hitam", "hijau"][Math.floor(random() * 4)],
    material: ["katun", "linen"][Math.floor(random() * 2)],
    maxPrice: 130000 + Math.floor(random() * 5) * 10000,
    quantity: 1,
  };
  // Keep one draw per product so task attributes remain reproducible; public
  // names come directly from the LEUCO collection.
  const products: Product[] = Array.from({ length: 3 }, (_, j) => {
    random();
    return {
      id: hash(`public:${identity}:${j}`).slice(0, 12),
      name: collection[j].name,
      size: goal.size,
      color: goal.color,
      material: goal.material,
      price: goal.maxPrice - 5000 - 1000 * j,
      available: true,
      withheld: [],
    };
  });
  const ordered = shuffle(products, random);
  const truthOrder = shuffle(
    [0, 1, 2],
    rng(parseInt(hash(`truth:${identity}`).slice(0, 8), 16)),
  );
  const feasibleCount =
    type === "solvable"
      ? subtype === "single-feasible"
        ? 1
        : 2
      : type === "unavailable-evidence"
        ? 1
        : 0;
  for (let rank = 0; rank < 3; rank++) {
    const p = ordered[truthOrder[rank]];
    if (rank < feasibleCount) {
      if (type === "unavailable-evidence") {
        if (!unavailableConstraint || !hidden.includes(unavailableConstraint))
          throw Error(`${identity}: invalid unavailable-evidence constraint`);
        p.withheld = [unavailableConstraint];
      }
      continue;
    }
    const field = fields[(index + rank) % 4];
    if (field === "variant") p.size = goal.size === "XL" ? "S" : "XL";
    if (field === "material")
      p.material = goal.material === "katun" ? "linen" : "katun";
    if (field === "price") p.price = goal.maxPrice + 15000;
    if (field === "availability") p.available = false;
  }
  const initial = fields.filter((k) => !hidden.includes(k));
  return {
    id: `${split}-${String(index + 1).padStart(2, "0")}`,
    split,
    type,
    subtype,
    unknown,
    goal,
    initial,
    products: ordered,
    instruction: `Cari satu kaos ${goal.color} ukuran ${goal.size}, berbahan ${goal.material}, maksimal Rp${goal.maxPrice.toLocaleString("id-ID")}, yang tersedia. Masukkan satu ke keranjang.`,
  };
}

const distributions = [
  {
    type: "solvable",
    subtype: "single-feasible",
    levels: [2, 2, 2, 3, 3, 4, 4, 4],
  },
  {
    type: "solvable",
    subtype: "multi-feasible",
    levels: [2, 2, 3, 3, 3, 4, 4, 4],
  },
  { type: "no-solution", subtype: null, levels: [2, 2, 2, 3, 3, 3, 4, 4] },
  {
    type: "unavailable-evidence",
    subtype: null,
    levels: [2, 2, 2, 3, 3, 4, 4, 4],
  },
] as const;

type Definition = {
  type: TaskType;
  subtype: Subtype;
  unknown: Task["unknown"];
};
function buildTasks(split: Task["split"], definitions: Definition[]) {
  const hiddenOrdinals: Record<Task["unknown"], number> = { 2: 0, 3: 0, 4: 0 },
    unavailableUse = Object.fromEntries(fields.map((k) => [k, 0])) as Record<
      Constraint,
      number
    >;
  return definitions.map((d, index) => {
    const hidden = hiddenPattern(d.unknown, hiddenOrdinals[d.unknown]++),
      unavailableConstraint =
        d.type === "unavailable-evidence"
          ? [...hidden].sort(
              (a, b) =>
                unavailableUse[a] - unavailableUse[b] ||
                fields.indexOf(a) - fields.indexOf(b),
            )[0]
          : null;
    if (unavailableConstraint) unavailableUse[unavailableConstraint]++;
    return generate(
      split,
      index,
      d.type,
      d.subtype,
      d.unknown,
      hidden,
      unavailableConstraint,
    );
  });
}

// Base IDs carry no category ordering. This permutation is independent of public identifiers.
const definitions: Definition[] = shuffle(
  distributions.flatMap((g) =>
    g.levels.map((unknown) => ({
      type: g.type,
      subtype: g.subtype,
      unknown,
    })),
  ),
  rng(81273),
);
export const mainTasks: Task[] = buildTasks("main", definitions);

const developmentDefinitions: Definition[] = Array.from(
  { length: 12 },
  (_, i) => ({
    type: i < 6 ? "solvable" : i < 9 ? "no-solution" : "unavailable-evidence",
    subtype: i < 3 ? "single-feasible" : i < 6 ? "multi-feasible" : null,
    unknown: (2 + (i % 3)) as Task["unknown"],
  }),
);
export const developmentTasks: Task[] = buildTasks(
  "development",
  developmentDefinitions,
);

export const loadTask = (id: string) => {
  const t = [...developmentTasks, ...mainTasks].find((t) => t.id === id);
  if (!t) throw Error(`Unknown task ${id}`);
  return structuredClone(t);
};
export function feasibleProducts(t: Task) {
  return t.products.filter(
    (p) =>
      p.size === t.goal.size &&
      p.color === t.goal.color &&
      p.material === t.goal.material &&
      p.price <= t.goal.maxPrice &&
      p.available,
  );
}
export function visibleFields(t: Task, p: Product, url: string): Constraint[] {
  const u = new URL(url, "http://fixture"),
    path = u.pathname;
  if (path === "/") return t.initial;
  if (path !== `/product/${p.id}`) return [];
  return [
    ...new Set([
      ...t.initial,
      ...(panelFields[u.searchParams.get("panel") ?? "detail"] ?? []),
    ]),
  ];
}
export function publicLine(p: Product, k: Constraint) {
  const variant = `${p.size} / ${p.color}`;
  const label =
    k === "variant"
      ? "Varian"
      : k === "material"
        ? "Bahan"
        : k === "price"
          ? `Harga untuk ${variant}`
          : `Stok untuk ${variant}`;
  const value = p.withheld.includes(k)
    ? "belum dipublikasikan"
    : k === "variant"
      ? variant
      : k === "material"
        ? p.material
        : k === "price"
          ? `Rp${p.price.toLocaleString("id-ID")}`
          : p.available
            ? "tersedia"
            : "tidak tersedia";
  return `${label}: ${value}`;
}

export function validateDataset(tasks: Task[] = mainTasks) {
  const errors: string[] = [],
    counts: Record<string, number> = {},
    hiddenPatternsSeen: Record<string, number> = {},
    unavailableConstraints: Record<string, number> = {};
  for (const t of tasks) {
    const key = t.subtype ?? t.type;
    counts[`${key}:U${t.unknown}`] = (counts[`${key}:U${t.unknown}`] ?? 0) + 1;
    const hidden = fields.filter((k) => !t.initial.includes(k)),
      hiddenKey = `U${t.unknown}:${hidden.join("+")}`;
    hiddenPatternsSeen[hiddenKey] = (hiddenPatternsSeen[hiddenKey] ?? 0) + 1;
    if (
      t.products.length !== 3 ||
      new Set(t.products.map((p) => p.id)).size !== 3 ||
      new Set(t.products.map((p) => p.name)).size !== 3
    )
      errors.push(`${t.id}: candidates`);
    if (
      t.initial.length !== 4 - t.unknown ||
      hidden.length !== t.unknown ||
      new Set(t.initial).size !== t.initial.length ||
      t.products.some((p) => p.withheld.some((k) => t.initial.includes(k)))
    )
      errors.push(`${t.id}: initial UNKNOWN`);
    const feasible = feasibleProducts(t),
      observable = feasible.filter((p) => !p.withheld.length);
    if (
      t.type === "solvable" &&
      (feasible.length !== (t.subtype === "single-feasible" ? 1 : 2) ||
        !observable.length)
    )
      errors.push(`${t.id}: feasible set`);
    if (t.type === "no-solution" && feasible.length)
      errors.push(`${t.id}: no-solution`);
    if (
      t.type === "unavailable-evidence" &&
      (!feasible.length ||
        observable.length ||
        !feasible.some((p) => p.withheld.length))
    )
      errors.push(`${t.id}: unavailable evidence`);
    if (t.type === "unavailable-evidence")
      for (const p of feasible)
        for (const k of p.withheld)
          unavailableConstraints[k] = (unavailableConstraints[k] ?? 0) + 1;
    if (
      t.type === "no-solution" &&
      t.products.some(
        (p) =>
          !(
            p.size !== t.goal.size ||
            p.color !== t.goal.color ||
            p.material !== t.goal.material ||
            p.price > t.goal.maxPrice ||
            !p.available
          ) || p.withheld.length,
      )
    )
      errors.push(`${t.id}: refutation path`);
  }
  if (tasks === mainTasks) {
    if (tasks.length !== 32) errors.push("main count");
    for (const g of distributions)
      for (const level of [2, 3, 4])
        if (
          counts[`${g.subtype ?? g.type}:U${level}`] !==
          g.levels.filter((x) => x === level).length
        )
          errors.push("distribution mismatch");
    for (const unknown of [2, 3] as const) {
      const values = hiddenPatterns[unknown].map(
        (pattern) =>
          hiddenPatternsSeen[`U${unknown}:${pattern.join("+")}`] ?? 0,
      );
      if (
        values.some((n) => n === 0) ||
        Math.max(...values) - Math.min(...values) > 1
      )
        errors.push(`U${unknown} hidden-pattern rotation`);
    }
    if (Object.keys(unavailableConstraints).length < 3)
      errors.push("unavailable-evidence constraint diversity");
  }
  // Constructive upper bound: inspect detail + offer for all 3 candidates; at most
  // 2 supporting returns per candidate, then one ACT. No private minimum path metric.
  const pathBounds = {
    exploratory_probes: 6,
    browser_actions: 12,
    model_calls: 6,
  };
  if (
    config.budget.probes < 6 ||
    config.budget.actions < 12 ||
    config.budget.model_calls < 6
  )
    errors.push("budget below exhaustive public route bound");
  return {
    passed: errors.length === 0,
    tasks: tasks.length,
    main_policy_runs: 64,
    distribution: counts,
    hidden_patterns: hiddenPatternsSeen,
    unavailable_constraints: unavailableConstraints,
    path_bounds: pathBounds,
    errors,
  };
}
