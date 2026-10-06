import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { extractControls } from "./accessibility.ts";

export type InspectionSessionOptions = {
  harPath: string;
  headless?: boolean;
  extraHTTPHeaders?: Record<string, string>;
  allowedOrigins?: string[];
};

export type InspectionSnapshot = {
  url: string;
  title: string;
  accessibility: string;
  controls: ReturnType<typeof extractControls>;
  captured_at: string;
};

export class InspectionSession {
  constructor(
    private browser: Browser,
    private context: BrowserContext,
    readonly page: Page,
  ) {}

  async goto(url: string) {
    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
  }

  async capture(): Promise<InspectionSnapshot> {
    const accessibility = await this.page.locator("body").ariaSnapshot();
    return {
      url: this.page.url(),
      title: await this.page.title(),
      accessibility,
      controls: extractControls(accessibility),
      captured_at: new Date().toISOString(),
    };
  }

  async close() {
    await this.context.close();
    await this.browser.close();
  }
}

export async function openInspectionSession(options: InspectionSessionOptions) {
  mkdirSync(dirname(options.harPath), { recursive: true });
  const browser = await chromium.launch({ headless: options.headless ?? true });
  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: "block",
    recordHar: { path: options.harPath, mode: "full", content: "embed" },
    extraHTTPHeaders: options.extraHTTPHeaders,
  });

  if (options.allowedOrigins?.length) {
    const allowed = new Set(
      options.allowedOrigins.map((origin) => new URL(origin).origin),
    );
    await context.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      if (!/^https?:/i.test(requestUrl)) return route.continue();
      const origin = new URL(requestUrl).origin;
      if (allowed.has(origin)) return route.continue();
      return route.abort("blockedbyclient");
    });
  }

  const page = await context.newPage();
  page.on("dialog", (dialog) => void dialog.dismiss());
  return new InspectionSession(browser, context, page);
}
