import { Copy01Icon, LinkSquare01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useIsoToast } from "../feedback/useIsoToast";

export interface IsoTransactionHashProps {
  readonly blockExplorerUrl?: string;
  readonly className?: string;
  readonly label?: string;
  readonly txHash?: `0x${string}`;
}

export function IsoTransactionHash({
  blockExplorerUrl,
  className,
  txHash,
}: IsoTransactionHashProps): JSX.Element | null {
  const toast = useIsoToast();

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
      toast.error("Clipboard unavailable");
      return;
    }

    try {
      await navigator.clipboard.writeText(txHash);
      toast.success("Transaction hash copied");
    } catch {
      toast.error("Unable to copy transaction hash");
    }
  }

  return (
    <span
      aria-label={`Transaction hash ${txHash}`}
      className={rootClassName}
      title={txHash}
    >
      <code className="iso-transaction-hash-value">{displayHash}</code>
      <span className="iso-transaction-hash-actions">
        <button
          aria-label={`Copy transaction hash ${txHash}`}
          className="iso-icon-button"
          title="Copy transaction hash"
          type="button"
          onClick={() => {
            void copyToClipboard();
          }}
        >
          <HugeiconsIcon icon={Copy01Icon} size={16} strokeWidth={1.8} />
        </button>
        {txUrl ? (
          <a
            aria-label={`Open transaction ${txHash} in block explorer`}
            className="iso-icon-button"
            href={txUrl}
            rel="noreferrer"
            target="_blank"
            title="Open in block explorer"
          >
            <HugeiconsIcon icon={LinkSquare01Icon} size={16} strokeWidth={1.8} />
          </a>
        ) : (
          <button
            aria-label="Block explorer unavailable for this network"
            className="iso-icon-button"
            disabled
            title="Block explorer unavailable"
            type="button"
          >
            <HugeiconsIcon icon={LinkSquare01Icon} size={16} strokeWidth={1.8} />
          </button>
        )}
      </span>
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
