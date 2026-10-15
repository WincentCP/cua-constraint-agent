import type { WebArenaConfig, WebArenaTask } from "./schema.ts";

function assertShoppingOnly(task: WebArenaTask) {
  if (task.sites.length !== 1 || task.sites[0] !== "shopping") {
    throw new Error(
      `Shopping-only scope does not allow sites: ${task.sites.join(", ")}`,
    );
  }
}

export function taskAllowedOrigins(task: WebArenaTask) {
  assertShoppingOnly(task);
  return [...new Set(task.start_urls.map((url) => new URL(url).origin))];
}

export function authHeadersForTask(task: WebArenaTask, config: WebArenaConfig) {
  assertShoppingOnly(task);
  const credentials = config.environments["__SHOPPING__"]?.credentials;
  if (!credentials) {
    throw new Error("Missing Shopping credentials in local config");
  }
  return {
    "X-M2-Customer-Auto-Login": `${credentials.username}:${credentials.password}`,
  };
}
