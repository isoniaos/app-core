import type { RuntimeMetadataConfig } from "../config/runtime-config";
import { getDemoMetadataRecord } from "./demo-metadata";
import type {
  MetadataRecord,
  MetadataResolver,
  NormalizedMetadataUri,
} from "./types";
import { normalizeMetadataUri } from "./uri";

export function createMetadataResolver(
  config: RuntimeMetadataConfig,
): MetadataResolver {
  const cache = new Map<string, Promise<MetadataRecord | undefined>>();

  return {
    enabled: config.enabled,
    normalize(uri: string | undefined): NormalizedMetadataUri | undefined {
      return normalizeMetadataUri(uri, config.ipfsGatewayUrl);
    },
    resolve(uri: string | undefined): Promise<MetadataRecord | undefined> {
      const normalized = normalizeMetadataUri(uri, config.ipfsGatewayUrl);
      if (!normalized || !config.enabled) {
        return Promise.resolve(undefined);
      }

      const demoRecord = getDemoMetadataRecord(
        normalized.cacheKey,
        normalized.fetchUri,
      );
      if (demoRecord) {
        return Promise.resolve(demoRecord);
      }

      const cached = cache.get(normalized.cacheKey);
      if (cached) {
        return cached;
      }

      const pending = fetchMetadata(normalized, config.timeoutMs);
      cache.set(normalized.cacheKey, pending);
      return pending;
    },
  };
}

async function fetchMetadata(
  normalized: NormalizedMetadataUri,
  timeoutMs: number,
): Promise<MetadataRecord | undefined> {
  if (normalized.scheme !== "http" && normalized.scheme !== "https" && normalized.scheme !== "ipfs") {
    return undefined;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(normalized.fetchUri, {
      cache: "force-cache",
      signal: controller.signal,
    });
    if (!response.ok) {
      return undefined;
    }

    const json = (await response.json()) as unknown;
    return toMetadataRecord(normalized, json);
  } catch {
    return undefined;
  } finally {
    window.clearTimeout(timeout);
  }
}

function toMetadataRecord(
  normalized: NormalizedMetadataUri,
  value: unknown,
): MetadataRecord | undefined {
  const raw = asRecord(value);
  if (!raw) {
    return undefined;
  }

  return {
    uri: normalized.originalUri,
    resolvedUri: normalized.fetchUri,
    name: readString(raw.name),
    title: readString(raw.title),
    description: readString(raw.description),
    image: readString(raw.image),
    externalUrl: readString(raw.external_url) ?? readString(raw.externalUrl),
    raw,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}
