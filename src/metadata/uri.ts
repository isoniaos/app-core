import type { NormalizedMetadataUri } from "./types";

export function normalizeMetadataUri(
  uri: string | undefined,
  ipfsGatewayUrl: string,
): NormalizedMetadataUri | undefined {
  const originalUri = uri?.trim();
  if (!originalUri) {
    return undefined;
  }

  if (isIpfsUri(originalUri)) {
    return normalizeIpfsUri(originalUri, ipfsGatewayUrl);
  }

  if (isHttpUri(originalUri)) {
    try {
      const parsed = new URL(originalUri);
      const scheme = parsed.protocol === "https:" ? "https" : "http";
      return {
        originalUri,
        fetchUri: parsed.toString(),
        cacheKey: parsed.toString(),
        scheme,
      };
    } catch {
      return {
        originalUri,
        fetchUri: originalUri,
        cacheKey: originalUri,
        scheme: "unknown",
      };
    }
  }

  return {
    originalUri,
    fetchUri: originalUri,
    cacheKey: originalUri,
    scheme: "unknown",
  };
}

export function normalizeIpfsUri(
  uri: string,
  ipfsGatewayUrl: string,
): NormalizedMetadataUri | undefined {
  const originalUri = uri.trim();
  if (!isIpfsUri(originalUri)) {
    return undefined;
  }

  const contentPath = originalUri.slice("ipfs://".length).replace(/^\/+/, "");
  if (!contentPath) {
    return undefined;
  }

  const gateway = normalizeGatewayPrefix(ipfsGatewayUrl);
  const fetchUri = `${gateway}${encodePathSegments(contentPath)}`;

  return {
    originalUri,
    fetchUri,
    cacheKey: `ipfs://${contentPath}`,
    scheme: "ipfs",
  };
}

function isIpfsUri(value: string): boolean {
  return value.toLowerCase().startsWith("ipfs://");
}

function isHttpUri(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizeGatewayPrefix(value: string): string {
  const trimmed = value.trim();
  const fallback = "https://ipfs.io/ipfs/";
  const gateway = trimmed.length > 0 ? trimmed : fallback;
  return gateway.endsWith("/") ? gateway : `${gateway}/`;
}

function encodePathSegments(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
