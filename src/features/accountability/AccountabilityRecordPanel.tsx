import type { AccountabilityRecordDto } from "@isonia/types";
import type { ReactNode } from "react";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { IsoStatusPill, IsoTransactionHash } from "../../ui-kit";
import { formatAddress, formatLabel } from "../../utils/format";
import {
  executionStatusTone,
  formatIsoDateTime,
  formatOptionalText,
  isNotFoundApiError,
} from "./accountability-display";
import { ExternalResourceRefList } from "./ExternalResourceCard";
import { SourceDisclosureBadge } from "./SourceDisclosureBadge";
import { TrustBoundaryNotice } from "./TrustBoundaryNotice";

interface AccountabilityRecordPanelProps {
  readonly blockExplorerUrl?: string;
  readonly orgId: string;
  readonly proposalId: string;
}

export function AccountabilityRecordPanel({
  blockExplorerUrl,
  orgId,
  proposalId,
}: AccountabilityRecordPanelProps): JSX.Element {
  const client = useIsoniaClient();
  const accountability = useIsoniaQuery(
    () => client.accountability.get(orgId, proposalId),
    [client, orgId, proposalId],
  );

  if (accountability.loading) {
    return (
      <AccountabilityState
        title="Loading accountability record"
        message="Reading the v0.8 accountability read model."
      />
    );
  }

  if (isNotFoundApiError(accountability.error)) {
    return (
      <AccountabilityState
        title="Accountability record not available yet"
        message="This Control Plane does not have a v0.8 accountability record for this proposal yet."
      />
    );
  }

  if (accountability.error) {
    return (
      <AccountabilityState
        actionLabel="Retry"
        message={accountability.error.message}
        title="Unable to load accountability record"
        onAction={accountability.reload}
      />
    );
  }

  if (!accountability.data) {
    return (
      <AccountabilityState
        title="Accountability record missing"
        message="No accountability record was returned for this proposal."
      />
    );
  }

  return (
    <AccountabilityRecordContent
      blockExplorerUrl={blockExplorerUrl}
      record={accountability.data}
    />
  );
}

function AccountabilityRecordContent({
  blockExplorerUrl,
  record,
}: {
  readonly blockExplorerUrl?: string;
  readonly record: AccountabilityRecordDto;
}): JSX.Element {
  return (
    <div className="accountability-panel-stack">
      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Accountability</h2>
            <p>
              Follow-through records are read-only accountability context.
              Manual updates are annotations, not protocol truth.
            </p>
          </div>
          <div className="chip-row">
            <IsoStatusPill tone={executionStatusTone(record.executionStatus)}>
              {formatLabel(record.executionStatus)}
            </IsoStatusPill>
            <SourceDisclosureBadge disclosure={record.sourceDisclosure} />
          </div>
        </div>

        <TrustBoundaryNotice disclosure={record.sourceDisclosure} />

        <dl className="accountability-detail-grid">
          <Detail
            label="Responsible party"
            value={formatOptionalText(record.responsibleParty?.label)}
          />
          <Detail
            label="Responsible wallet"
            value={
              record.responsibleParty?.walletAddress
                ? formatAddress(record.responsibleParty.walletAddress)
                : "Not provided"
            }
          />
          <Detail label="Due date" value={formatIsoDateTime(record.dueDate)} />
          <Detail
            label="Execution status"
            value={formatLabel(record.executionStatus)}
          />
          <Detail
            label="Decision record"
            value={formatOptionalText(record.decisionRecordId)}
            mono
          />
          <Detail label="Record ID" value={record.id} mono />
        </dl>

        {record.responsibleParty?.externalIdentityUrl ? (
          <a
            className="accountability-external-link"
            href={record.responsibleParty.externalIdentityUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open responsible party reference
          </a>
        ) : null}
      </section>

      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Linked Transaction Proof</h2>
            <p>
              Observed transaction evidence is not automatically a completed
              business outcome unless the accountability status says so.
            </p>
          </div>
          {record.linkedTransaction ? (
            <SourceDisclosureBadge
              disclosure={record.linkedTransaction.sourceDisclosure}
            />
          ) : null}
        </div>
        {record.linkedTransaction ? (
          <>
            <TrustBoundaryNotice
              disclosure={record.linkedTransaction.sourceDisclosure}
            />
            <dl className="accountability-detail-grid">
              <Detail
                label="Chain ID"
                value={String(record.linkedTransaction.chainId)}
              />
              <Detail
                label="Observed status"
                value={
                  record.linkedTransaction.observedStatus
                    ? formatLabel(record.linkedTransaction.observedStatus)
                    : "Not provided"
                }
              />
              <Detail
                label="Transaction"
                value={
                  <IsoTransactionHash
                    blockExplorerUrl={blockExplorerUrl}
                    txHash={record.linkedTransaction.txHash}
                  />
                }
              />
              <Detail
                label="Explorer URL"
                value={
                  record.linkedTransaction.explorerUrl ? (
                    <a
                      href={record.linkedTransaction.explorerUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open observed transaction
                    </a>
                  ) : (
                    "Not provided"
                  )
                }
              />
            </dl>
          </>
        ) : (
          <AccountabilityState
            title="No linked transaction"
            message="No observed transaction proof is linked to this accountability record."
          />
        )}
      </section>

      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>External Proofs</h2>
            <p>External records attached by the Control Plane.</p>
          </div>
        </div>
        <ExternalResourceRefList refs={record.externalProofs} />
      </section>

      <section className="product-card">
        <div className="product-card-header">
          <div>
            <h2>Manual Updates</h2>
            <p>Manual annotations about execution progress.</p>
          </div>
        </div>
        {record.manualUpdates.length === 0 ? (
          <AccountabilityState
            title="No manual annotations"
            message="No manual execution updates were recorded."
          />
        ) : (
          <div className="manual-update-list">
            {record.manualUpdates.map((update) => (
              <article className="manual-update-card" key={update.updatedAt}>
                <header>
                  <div>
                    <strong>Manual annotation</strong>
                    <span>{formatIsoDateTime(update.updatedAt)}</span>
                  </div>
                  <div className="chip-row">
                    <IsoStatusPill tone={executionStatusTone(update.status)}>
                      {formatLabel(update.status)}
                    </IsoStatusPill>
                    <SourceDisclosureBadge disclosure={update.sourceDisclosure} />
                  </div>
                </header>
                <TrustBoundaryNotice disclosure={update.sourceDisclosure} />
                <dl className="accountability-detail-grid">
                  <Detail
                    label="Updated by"
                    value={formatOptionalText(update.updatedBy)}
                  />
                  <Detail label="Reason" value={formatOptionalText(update.reason)} />
                  <Detail label="Note" value={formatOptionalText(update.note)} />
                </dl>
                <ExternalResourceRefList
                  emptyMessage="No evidence was attached to this manual annotation."
                  refs={update.evidence ?? []}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      {record.completionConfirmation ? (
        <section className="product-card">
          <div className="product-card-header">
            <div>
              <h2>Completion Confirmation</h2>
              <p>Confirmation annotation associated with the record.</p>
            </div>
            <SourceDisclosureBadge
              disclosure={record.completionConfirmation.sourceDisclosure}
            />
          </div>
          <TrustBoundaryNotice
            disclosure={record.completionConfirmation.sourceDisclosure}
          />
          <dl className="accountability-detail-grid">
            <Detail
              label="Confirmed by"
              value={formatOptionalText(record.completionConfirmation.confirmedBy)}
            />
            <Detail
              label="Confirmed"
              value={formatIsoDateTime(
                record.completionConfirmation.confirmedAt,
              )}
            />
            <Detail
              label="Note"
              value={formatOptionalText(record.completionConfirmation.note)}
            />
          </dl>
          <ExternalResourceRefList
            emptyMessage="No evidence was attached to this completion confirmation."
            refs={record.completionConfirmation.evidence ?? []}
          />
        </section>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  mono = false,
  value,
}: {
  readonly label: string;
  readonly mono?: boolean;
  readonly value: ReactNode;
}): JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? "technical-code" : undefined}>{value}</dd>
    </div>
  );
}

function AccountabilityState({
  actionLabel,
  message,
  onAction,
  title,
}: {
  readonly actionLabel?: string;
  readonly message: string;
  readonly onAction?: () => void;
  readonly title: string;
}): JSX.Element {
  return (
    <div className="calm-state accountability-state">
      <strong>{title}</strong>
      <span>{message}</span>
      {onAction && actionLabel ? (
        <button className="button button-small" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
