import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

const workspaceSourcesEnabled = env.ISONIA_WORKSPACE_SOURCES === "true";

export default defineConfig({
  plugins: [react()],
  resolve: workspaceSourcesEnabled
    ? {
        alias: {
          "@isonia/sdk": fromConfigFile("../sdk/src/index.ts"),
          "@isonia/types": fromConfigFile("../types/src/index.ts"),
        },
      }
    : undefined,
});

function fromConfigFile(relativePath: string): string {
  const pathname = new URL(relativePath, import.meta.url).pathname;
  return pathname.replace(/^\/([A-Za-z]:\/)/, "$1");
}
