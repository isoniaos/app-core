import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@isonia/sdk": fromConfigFile("../sdk/src/index.ts"),
      "@isonia/types": fromConfigFile("../types/src/index.ts"),
    },
  },
});

function fromConfigFile(relativePath: string): string {
  const pathname = new URL(relativePath, import.meta.url).pathname;
  return pathname.replace(/^\/([A-Za-z]:\/)/, "$1");
}
