import { spawnSync } from "node:child_process";
import { loadStudyProtocol } from "../experiment/study.ts";

export type CommandResult = {
  command: string;
  args: string[];
  status: number;
  stdout: string;
  stderr: string;
};

export function runCommand(command: string, args: string[]): CommandResult {
  // Do not use a Windows shell: PowerShell home paths may contain spaces,
  // and args should be passed as an argument vector rather than interpolated.
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
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

export function webArenaInvocation(args: string[]) {
  const protocol = loadStudyProtocol();
  return {
    command: process.platform === "win32" ? "uvx.exe" : "uvx",
    args: [
      "--from",
      `webarena-verified==${protocol.benchmark.pypi_version}`,
      "webarena-verified",
      ...args,
    ],
  };
}

export function webArenaVerified(args: string[]) {
  const invocation = webArenaInvocation(args);
  return runCommand(invocation.command, invocation.args);
}
