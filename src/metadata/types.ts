export interface MetadataRecord {
  readonly uri: string;
  readonly resolvedUri: string;
  readonly name?: string;
  readonly title?: string;
  readonly description?: string;
  readonly image?: string;
  readonly externalUrl?: string;
  readonly raw?: Record<string, unknown>;
}

export interface NormalizedMetadataUri {
  readonly originalUri: string;
  readonly fetchUri: string;
  readonly cacheKey: string;
  readonly scheme: "http" | "https" | "ipfs" | "unknown";
}

export interface MetadataResolver {
  readonly enabled: boolean;
  normalize(uri: string | undefined): NormalizedMetadataUri | undefined;
  resolve(uri: string | undefined): Promise<MetadataRecord | undefined>;
}
