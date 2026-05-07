import { useMemo } from "react";
import { isoToaster } from "./IsoToaster";

export type IsoToastStatus = "success" | "error" | "info" | "warning";

export interface IsoToastApi {
  readonly success: (message: string, description?: string) => void;
  readonly error: (message: string, description?: string) => void;
  readonly info: (message: string, description?: string) => void;
  readonly warning: (message: string, description?: string) => void;
}

const TOAST_DURATION_MS = 2600;
const MAX_TOAST_TEXT_LENGTH = 140;

export function useIsoToast(): IsoToastApi {
  return useMemo(
    () => ({
      error: (message, description) => {
        showToast("error", message, description);
      },
      info: (message, description) => {
        showToast("info", message, description);
      },
      success: (message, description) => {
        showToast("success", message, description);
      },
      warning: (message, description) => {
        showToast("warning", message, description);
      },
    }),
    [],
  );
}

function showToast(
  status: IsoToastStatus,
  message: string,
  description?: string,
): void {
  isoToaster[status]({
    description: description ? sanitizeToastText(description) : undefined,
    duration: TOAST_DURATION_MS,
    title: sanitizeToastText(message),
  });
}

function sanitizeToastText(value: string): string {
  const normalized = value.replace(/\s+/gu, " ").trim();

  if (normalized.length <= MAX_TOAST_TEXT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_TOAST_TEXT_LENGTH - 3)}...`;
}
