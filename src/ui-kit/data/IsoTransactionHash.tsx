import { useState } from "react";

export interface IsoTransactionHashProps {
  readonly blockExplorerUrl?: string;
  readonly className?: string;
  readonly label?: string;
  readonly txHash?: `0x${string}`;
}

export function IsoTransactionHash({
  blockExplorerUrl,
  className,
  label = "Tx",
  txHash,
}: IsoTransactionHashProps): JSX.Element | null {
  const [copied, setCopied] = useState(false);

  if (!txHash) {
    return null;
  }

  const txUrl = buildBlockExplorerTransactionUrl(blockExplorerUrl, txHash);
  const displayHash = shortenTransactionHash(txHash);
  const rootClassName = ["iso-transaction-hash", className]
    .filter(Boolean)
    .join(" ");

  async function copyToClipboard(): Promise<void> {
    if (!txHash || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <span className={rootClassName}>
      <span className="iso-transaction-hash-label">{label}</span>
      {txUrl ? (
        <a
          className="iso-transaction-hash-value"
          href={txUrl}
          rel="noreferrer"
          target="_blank"
          title={txHash}
        >
          {displayHash}
        </a>
      ) : (
        <code className="iso-transaction-hash-value" title={txHash}>
          {displayHash}
        </code>
      )}
      <button
        className="address-copy-button"
        type="button"
        onClick={() => {
          void copyToClipboard();
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

function buildBlockExplorerTransactionUrl(
  blockExplorerUrl: string | undefined,
  txHash: `0x${string}`,
): string | undefined {
  const trimmedUrl = blockExplorerUrl?.trim();
  if (!trimmedUrl) {
    return undefined;
  }

  try {
    new URL(trimmedUrl);
  } catch {
    return undefined;
  }

  return `${trimmedUrl.replace(/\/+$/u, "")}/tx/${txHash}`;
}

function shortenTransactionHash(txHash: `0x${string}`): string {
  if (txHash.length <= 20) {
    return txHash;
  }

  return `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
}
