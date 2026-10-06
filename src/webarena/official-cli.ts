import { spawnSync } from "node:child_process";

export type CommandResult = {
  command: string;
  args: string[];
  status: number;
  stdout: string;
  stderr: string;
};

export function runCommand(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "pipe",
  });
  const status = result.status ?? (result.error ? 1 : 0);
  return {
    command,
    args,
    status,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${
      result.error ? `\n${result.error.message}` : ""
    }`.trim(),
  };
}

export function requireSuccess(result: CommandResult) {
  if (result.status !== 0) {
    throw new Error(
      `${result.command} ${result.args.join(" ")} failed (${result.status})\n${
        result.stderr || result.stdout
      }`,
    );
  }
  return result;
}

export function webArenaVerified(args: string[]) {
  return runCommand("uvx", ["webarena-verified", ...args]);
}
