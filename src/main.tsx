import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { AppProviders } from "./app/AppProviders";
import { createWalletSetup } from "./chain/wallet-setup";
import { loadRuntimeConfig } from "./config/runtime-config";
import "@isonia/theme-default/theme.css";
import "./styles/global.css";

async function bootstrap(): Promise<void> {
  const runtimeConfig = await loadRuntimeConfig();
  const walletSetup = await createWalletSetup(runtimeConfig);
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Missing root element.");
  }

  createRoot(rootElement).render(
    <StrictMode>
      <AppProviders runtimeConfig={runtimeConfig} walletSetup={walletSetup}>
        <App />
      </AppProviders>
    </StrictMode>,
  );
}

bootstrap().catch((error: unknown) => {
  const rootElement = document.getElementById("root");
  const message = error instanceof Error ? error.message : "Unknown error";

  if (rootElement) {
    rootElement.innerHTML = `<main class="fatal-screen"><h1>Unable to start IsoniaOS</h1><p>${escapeHtml(
      message,
    )}</p></main>`;
  }
});

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}
