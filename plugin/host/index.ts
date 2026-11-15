import type { HostContext, PluginConfig } from "./context.ts";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { PluginService } from "./service.ts";
export const name = "dsh-evidentloop";
export const inject = [
  "connection",
  "sessionController",
  "workspaceRegistry",
  "sessions",
  "agents",
  "tools",
  "llm",
  "agentDefaultModel",
  "sessionTitle",
];
export async function apply(
  ctx: HostContext,
  config: Partial<PluginConfig> = {},
) {
  const packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const home = process.env.DSH_HOME?.trim() || path.join(os.homedir(), ".dsh");
  const service = await new PluginService(ctx, {
    storageRoot:
      config.storageRoot || path.join(home, "storages", "dsh-evidentloop"),
    approvalFile: config.approvalFile,
    methodRoot: path.join(packageRoot, "skills/evidentloop-review"),
    assetRoot: path.join(packageRoot, "dist"),
  }).initialize();
  ctx.effect(() => () => service.close());
  // Cordis accepts only void or a cleanup function from an async plugin entry.
}
