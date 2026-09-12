import {
  chromium,
  type Browser,
  type BrowserServer,
  type Page,
} from "playwright";
import {
  type Candidate,
  type Control,
  type Log,
  type Observation,
  RunFailure,
} from "../core/types.ts";
import { observationFrom, parseTree, flatten } from "./semantic.ts";
export type Capture = (page: Page, observation: Observation) => Promise<void>;

export class Driver {
  private candidates: Candidate[] = [];
  private serial = 0;
  private closing?: Promise<void>;
  constructor(
    readonly page: Page,
    private browser: Browser,
    private server: BrowserServer,
    private log: Log,
    private capture?: Capture,
  ) {}
  get version() {
    return this.browser.version();
  }
  async observe(step: number): Promise<Observation> {
    const snapshot = await this.page.locator("body").ariaSnapshot();
    if (snapshot.length > 18000)
      throw new RunFailure(
        "EXECUTION_OR_VERIFICATION_FAILURE",
        "accessibility_snapshot_overflow",
      );
    const u = new URL(this.page.url()),
      o = observationFrom(
        snapshot,
        u.pathname + u.search,
        this.candidates,
        step,
        `obs-${++this.serial}`,
      );
    this.candidates = o.candidates;
    // Instrumentation owns the immutable raw record; the agent gets a separate copy.
    this.log("OBSERVATION", structuredClone(o));
    await this.capture?.(this.page, structuredClone(o));
    return structuredClone(o);
  }
  async click(control: Control, timeout: number) {
    const scope = control.candidate
      ? this.page.getByRole("group", {
          name: this.candidates.find((c) => c.id === control.candidate)!.name,
          exact: true,
        })
      : this.page.getByRole("main");
    const locator = scope.getByRole(control.role, {
      name: control.name,
      exact: true,
    });
    if ((await locator.count()) !== 1)
      throw new RunFailure(
        "EXECUTION_OR_VERIFICATION_FAILURE",
        "ambiguous_or_stale_control",
      );
    const handle = await locator.elementHandle();
    if (!handle)
      throw new RunFailure(
        "EXECUTION_OR_VERIFICATION_FAILURE",
        "detached_control",
      );
    try {
      if (
        !(await handle.isVisible()) ||
        !(await handle.isEnabled()) ||
        !(await handle.evaluate((e) => e.isConnected))
      )
        throw new RunFailure(
          "EXECUTION_OR_VERIFICATION_FAILURE",
          "unavailable_control",
        );
      if (
        control.role === "link" &&
        (await handle.getAttribute("href")) !== control.url
      )
        throw new RunFailure(
          "EXECUTION_OR_VERIFICATION_FAILURE",
          "changed_destination",
        );
      await handle.click({ timeout });
      // Public busy state marks an in-place panel navigation. Capture only after
      // the UI has committed both the requested evidence and its URL.
      await this.page
        .locator('#product-information[aria-busy="true"]')
        .waitFor({ state: "detached", timeout });
    } finally {
      await handle.dispose();
    }
  }
  close(): Promise<void> {
    return (this.closing ??= (async () => {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          this.server.close(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error("close_timeout")), 5000);
          }),
        ]);
      } catch {
        await this.server.kill();
      } finally {
        clearTimeout(timer);
      }
    })());
  }
}
export async function openBrowser(
  origin: string,
  secret: string,
  log: Log,
  onViolation: () => void,
  executablePath = process.env.CHROMIUM_PATH,
  capture?: Capture,
) {
  const server = await chromium.launchServer({
    headless: true,
    executablePath,
    timeout: 15000,
  });
  try {
    const browser = await chromium.connect(server.wsEndpoint()),
      context = await browser.newContext({
        serviceWorkers: "block",
        acceptDownloads: false,
      });
    await context.addCookies([
      {
        name: "world",
        value: secret,
        url: origin,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      onViolation();
      return route.abort();
    });
    const page = await context.newPage();
    context.on("page", (extra) => {
      if (extra !== page) {
        onViolation();
        void extra.close();
      }
    });
    page.on("dialog", (dialog) => void dialog.dismiss());
    await page.goto(origin, { waitUntil: "load", timeout: 10000 });
    return new Driver(page, browser, server, log, capture);
  } catch (e) {
    await server.kill();
    throw e;
  }
}
export function verifyCart(
  o: Observation,
  candidate: string,
  size: string,
  color: string,
  price: number,
) {
  if (o.url !== "/cart") return false;
  const tree = parseTree(o.snapshot),
    nodes = flatten(tree),
    groups = nodes.filter((n) => n.role === "group");
  if (groups.length !== 1 || !nodes.some((n) => n.text === "Jumlah barang: 1"))
    return false;
  const item = flatten(groups[0].children);
  return (
    item.some((n) => n.url === `/product/${candidate}`) &&
    [
      `Varian: ${size} / ${color}`,
      `Harga satuan: Rp${price.toLocaleString("id-ID")}`,
      "Jumlah: 1",
    ].every((text) => item.some((n) => n.text === text))
  );
}
