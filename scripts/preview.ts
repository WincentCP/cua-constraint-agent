import { createServer, request } from "node:http";
import { parseArgs } from "node:util";
import { loadTask } from "../src/environment/dataset.ts";
import { openWorld } from "../src/environment/world.ts";

const { values } = parseArgs({
  options: {
    task: { type: "string", default: "development-01" },
    port: { type: "string", default: "4173" },
  },
});
const task = loadTask(values.task!);
if (task.split !== "development")
  throw Error("Preview hanya untuk task development.");
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("Port harus 1024-65535.");
const world = await openWorld(task);
// Manual loopback preview only. The benchmark continues using openWorld directly.
const server = createServer((req, res) => {
  if (
    req.headers.host !== `127.0.0.1:${port}` &&
    req.headers.host !== `localhost:${port}`
  ) {
    res.writeHead(403).end();
    return;
  }
  const upstream = request(
    world.origin + (req.url ?? "/"),
    {
      method: req.method,
      headers: {
        cookie: `world=${world.secret}`,
        "content-type":
          req.headers["content-type"] ?? "application/x-www-form-urlencoded",
      },
    },
    (incoming) => {
      res.writeHead(incoming.statusCode ?? 502, incoming.headers);
      incoming.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502).end("Preview tidak tersedia.");
  });
  req.pipe(upstream);
});
try {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
} catch (error) {
  await world.close();
  throw error;
}
console.log(
  `Preview LEUCO: http://127.0.0.1:${port}\n${task.instruction}\nDevelopment saja, bukan hasil penelitian. Mulai ulang untuk mengosongkan keranjang.`,
);
const close = async () => {
  server.closeAllConnections();
  server.close();
  await world.close();
};
process.once("SIGINT", () => {
  void close();
});
process.once("SIGTERM", () => {
  void close();
});
