import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { AppProviders } from "./app/AppProviders";
import {
  createWalletSetup,
  isWalletSetupError,
  type WalletSetupDiagnostic,
} from "./chain/wallet-setup";
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
  const diagnostics = isWalletSetupError(error) ? error.diagnostics : [];

  console.error("Unable to start IsoniaOS.", error);

  if (rootElement) {
    rootElement.innerHTML = renderFatalScreen(message, diagnostics);
  }
});

function renderFatalScreen(
  message: string,
  diagnostics: readonly WalletSetupDiagnostic[],
): string {
  const diagnosticList =
    diagnostics.length > 0
      ? `<ul class="fatal-diagnostics">${diagnostics
          .map(renderFatalDiagnostic)
          .join("")}</ul>`
      : "";

  return `<main class="fatal-screen"><h1>Unable to start IsoniaOS</h1><p>${escapeHtml(
    message,
  )}</p>${diagnosticList}</main>`;
}

function renderFatalDiagnostic(diagnostic: WalletSetupDiagnostic): string {
  const detail = diagnostic.detail
    ? `<span>${escapeHtml(diagnostic.detail)}</span>`
    : "";

  return `<li><strong>${escapeHtml(diagnostic.message)}</strong>${detail}</li>`;
}

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
