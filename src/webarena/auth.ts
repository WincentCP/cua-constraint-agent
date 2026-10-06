import type { WebArenaConfig, WebArenaTask } from "./schema.ts";

const siteKeys: Record<string, string> = {
  shopping: "__SHOPPING__",
  shopping_admin: "__SHOPPING_ADMIN__",
  reddit: "__REDDIT__",
  gitlab: "__GITLAB__",
  wikipedia: "__WIKIPEDIA__",
  map: "__MAP__",
};

export function taskAllowedOrigins(task: WebArenaTask) {
  return [...new Set(task.start_urls.map((url) => new URL(url).origin))];
}

export function authHeadersForTask(task: WebArenaTask, config: WebArenaConfig) {
  const headers: Record<string, string> = {};
  for (const site of task.sites) {
    const environment = config.environments[siteKeys[site] ?? site];
    const credentials = environment?.credentials;
    if (!credentials) continue;
    const value = `${credentials.username}:${credentials.password}`;
    if (site === "shopping") headers["X-M2-Customer-Auto-Login"] = value;
    if (site === "shopping_admin") {
      headers["X-M2-Admin-Auto-Login"] = value;
    }
    if (site === "reddit") headers["X-Postmill-Auto-Login"] = value;
  }
  return headers;
}
