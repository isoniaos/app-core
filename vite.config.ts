import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

const workspaceSourcesEnabled = env.ISONIA_WORKSPACE_SOURCES === "true";

function getManualChunk(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, "/");

  if (
    normalizedId.indexOf("/node_modules/viem/") !== -1 ||
    normalizedId.indexOf("/node_modules/wagmi/") !== -1 ||
    normalizedId.indexOf("/node_modules/@wagmi/") !== -1 ||
    normalizedId.indexOf("/node_modules/@reown/") !== -1 ||
    normalizedId.indexOf("/node_modules/@walletconnect/") !== -1 ||
    normalizedId.indexOf("/node_modules/ox/") !== -1
  ) {
    return "web3-vendor";
  }

  return undefined;
}

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
  build: {
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
  },
});

function fromConfigFile(relativePath: string): string {
  const pathname = new URL(relativePath, import.meta.url).pathname;
  return pathname.replace(/^\/([A-Za-z]:\/)/, "$1");
}
