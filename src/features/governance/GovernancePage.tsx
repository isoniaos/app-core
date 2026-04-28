import type { BodyDto, MandateDto, ProposalType, RoleDto } from "@isonia/types";
import { PROPOSAL_TYPE_CHAIN_MAP } from "@isonia/types";
import { useParams } from "react-router-dom";
import { useIsoniaClient } from "../../api/IsoniaClientProvider";
import { useIsoniaQuery } from "../../api/useIsoniaQuery";
import { AsyncContent } from "../../ui/AsyncContent";
import { DataStatusBadge, StatusBadge } from "../../ui/StatusBadge";
import { PageHeader } from "../../ui/PageHeader";
import {
  formatAddress,
  formatChainTime,
  formatLabel,
  formatNumericString,
} from "../../utils/format";
import { requireParam } from "../../utils/route-params";

interface GovernanceData {
  readonly bodies: readonly BodyDto[];
  readonly roles: readonly RoleDto[];
  readonly mandates: readonly MandateDto[];
}

interface PowerMapBody {
  readonly bodyId: string;
  readonly body: BodyDto | undefined;
  readonly roles: readonly PowerMapRole[];
}

interface PowerMapRole {
  readonly roleId: string;
  readonly role: RoleDto | undefined;
  readonly mandates: readonly MandateDto[];
}

type BadgeTone = "default" | "success" | "warning" | "danger" | "muted";

interface MandateState {
  readonly label: string;
  readonly tone: BadgeTone;
  readonly rank: "active" | "revoked" | "expired" | "not-yet-active" | "inactive";
}

interface ProposalScopeDisplay {
  readonly proposalTypes: readonly ProposalType[];
  readonly fallbackLabel: string | undefined;
}

export function GovernancePage(): JSX.Element {
  const client = useIsoniaClient();
  const orgId = requireParam(useParams().orgId, "orgId");
  const governance = useIsoniaQuery(
    async (): Promise<GovernanceData> => {
      const [bodies, roles, mandates] = await Promise.all([
        client.getBodies(orgId),
        client.getRoles(orgId),
        client.getMandates(orgId),
      ]);
      return { bodies, roles, mandates };
    },
    [client, orgId],
  );

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow={`Org #${orgId}`}
        title="Governance Structure"
        description="A read-only power map of bodies, roles, mandate holders, scopes, and current authority state."
      />
      <AsyncContent state={governance}>
        {(data) => {
          const nowSeconds = Math.floor(Date.now() / 1_000);
          const powerMap = buildPowerMap(data);
          const summary = getGovernanceSummary(data, powerMap, nowSeconds);

          return (
            <>
              <div className="metric-grid">
                <div className="metric">
                  <span>Bodies</span>
                  <strong>{summary.bodies}</strong>
                </div>
                <div className="metric">
                  <span>Roles</span>
                  <strong>{summary.roles}</strong>
                </div>
                <div className="metric">
                  <span>Mandate holders</span>
                  <strong>{summary.holders}</strong>
                </div>
                <div className="metric">
                  <span>Active mandates</span>
                  <strong>{summary.activeMandates}</strong>
                </div>
              </div>

              <section className="panel power-map-panel">
                <div className="panel-header">
                  <div>
                    <h2>Power Map</h2>
                    <p className="panel-subtitle">
                      Bodies contain roles. Roles carry holder mandates with
                      proposal scopes and spending constraints.
                    </p>
                  </div>
                  <StatusBadge tone="muted">Read only</StatusBadge>
                </div>

                {powerMap.length === 0 ? (
                  <PowerEmptyState
                    title="No bodies"
                    message="No bodies have been indexed for this organization yet."
                  />
                ) : (
                  <div className="power-map">
                    {powerMap.map((bodyGroup) => (
                      <BodyPowerSection
                        bodyGroup={bodyGroup}
                        key={bodyGroup.bodyId}
                        nowSeconds={nowSeconds}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          );
        }}
      </AsyncContent>
    </section>
  );
}

function BodyPowerSection({
  bodyGroup,
  nowSeconds,
}: {
  readonly bodyGroup: PowerMapBody;
  readonly nowSeconds: number;
}): JSX.Element {
  const bodyName = getBodyName(bodyGroup.body, bodyGroup.bodyId);

  return (
    <article className="power-body">
      <div className="power-body-header">
        <div className="power-title">
          <h3>{bodyName}</h3>
          <span>Body #{bodyGroup.bodyId}</span>
        </div>
        <div className="chip-row">
          {bodyGroup.body ? (
            <>
              <StatusBadge tone={bodyGroup.body.active ? "success" : "muted"}>
                {bodyGroup.body.active ? "Active" : "Inactive"}
              </StatusBadge>
              <DataStatusBadge status={bodyGroup.body.dataStatus} />
            </>
          ) : (
            <StatusBadge tone="warning">Body not indexed</StatusBadge>
          )}
        </div>
      </div>

      <dl className="detail-list detail-list-wide power-detail-list">
        <Detail label="Kind" value={getBodyKindLabel(bodyGroup.body)} />
        <Detail
          label="Created block"
          value={bodyGroup.body?.createdBlock ?? "Not indexed"}
        />
        <Detail
          label="Metadata"
          value={bodyGroup.body?.metadataUri ?? "No metadata URI indexed"}
        />
      </dl>

      <div className="power-role-list">
        {bodyGroup.roles.length === 0 ? (
          <PowerEmptyState
            title="Body has no roles"
            message={`${bodyName} does not have any indexed roles.`}
          />
        ) : (
          bodyGroup.roles.map((roleGroup) => (
            <RolePowerSection
              key={roleGroup.roleId}
              nowSeconds={nowSeconds}
              roleGroup={roleGroup}
            />
          ))
        )}
      </div>
    </article>
  );
}

function RolePowerSection({
  roleGroup,
  nowSeconds,
}: {
  readonly roleGroup: PowerMapRole;
  readonly nowSeconds: number;
}): JSX.Element {
  const roleName = getRoleName(roleGroup.role, roleGroup.roleId);

  return (
    <section className="power-role">
      <div className="power-role-header">
        <div className="power-title">
          <h4>{roleName}</h4>
          <span>Role #{roleGroup.roleId}</span>
        </div>
        <div className="chip-row">
          {roleGroup.role ? (
            <>
              <StatusBadge tone="muted">
                {formatLabel(roleGroup.role.roleType)}
              </StatusBadge>
              <StatusBadge tone={roleGroup.role.active ? "success" : "muted"}>
                {roleGroup.role.active ? "Active" : "Inactive"}
              </StatusBadge>
              <DataStatusBadge status={roleGroup.role.dataStatus} />
            </>
          ) : (
            <StatusBadge tone="warning">Role not indexed</StatusBadge>
          )}
        </div>
      </div>

      <dl className="detail-list power-role-details">
        <Detail
          label="Role type"
          value={
            roleGroup.role
              ? formatLabel(roleGroup.role.roleType)
              : "Role type unavailable"
          }
        />
        <Detail
          label="Metadata"
          value={roleGroup.role?.metadataUri ?? "No metadata URI indexed"}
        />
      </dl>

      {roleGroup.mandates.length === 0 ? (
        <PowerEmptyState
          title="Role has no mandates"
          message={`${roleName} has no indexed mandate holders.`}
        />
      ) : (
        <div className="power-holder-list">
          {roleGroup.mandates.map((mandate) => (
            <MandateHolderRow
              key={mandate.mandateId}
              mandate={mandate}
              nowSeconds={nowSeconds}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MandateHolderRow({
  mandate,
  nowSeconds,
}: {
  readonly mandate: MandateDto;
  readonly nowSeconds: number;
}): JSX.Element {
  const mandateState = getMandateState(mandate, nowSeconds);
  const holderLabel = getHolderLabel(mandate.holderAddress);

  return (
    <article className="power-holder">
      <div className="power-holder-header">
        <div className="power-title">
          <h5>{holderLabel}</h5>
          <span>Mandate #{mandate.mandateId}</span>
        </div>
        <div className="chip-row">
          <StatusBadge tone={mandateState.tone}>{mandateState.label}</StatusBadge>
          <DataStatusBadge status={mandate.dataStatus} />
        </div>
      </div>

      <dl className="detail-list detail-list-wide power-mandate-details">
        <div>
          <dt>Proposal scope</dt>
          <dd>
            <ProposalScopeChips mask={mandate.proposalTypeMask} />
          </dd>
        </div>
        <Detail
          label="Spending limit"
          value={formatSpendingLimit(mandate.spendingLimit)}
        />
        <Detail label="Starts" value={formatMandateStart(mandate.startTime)} />
        <Detail label="Ends" value={formatMandateEnd(mandate.endTime)} />
      </dl>
    </article>
  );
}

function ProposalScopeChips({
  mask,
}: {
  readonly mask: string;
}): JSX.Element {
  const scope = getProposalScopeDisplay(mask);

  if (scope.proposalTypes.length === 0) {
    return (
      <span className="chip">
        {scope.fallbackLabel ?? "No proposal types"}
      </span>
    );
  }

  return (
    <span className="chip-row">
      {scope.proposalTypes.map((proposalType) => (
        <span className="chip" key={proposalType}>
          {formatLabel(proposalType)}
        </span>
      ))}
      {scope.fallbackLabel ? (
        <span className="chip">{scope.fallbackLabel}</span>
      ) : null}
    </span>
  );
}

function Detail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PowerEmptyState({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}): JSX.Element {
  return (
    <div className="power-empty-state">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

function buildPowerMap(data: GovernanceData): readonly PowerMapBody[] {
  const bodiesById = new Map(data.bodies.map((body) => [body.bodyId, body]));
  const rolesById = new Map(data.roles.map((role) => [role.roleId, role]));
  const bodyIds = new Set<string>();

  for (const body of data.bodies) {
    bodyIds.add(body.bodyId);
  }

  for (const role of data.roles) {
    bodyIds.add(role.bodyId);
  }

  for (const mandate of data.mandates) {
    bodyIds.add(mandate.bodyId);
  }

  return [...bodyIds].sort(compareNumericString).map((bodyId) => {
    const roleIds = new Set<string>();

    for (const role of data.roles) {
      if (role.bodyId === bodyId) {
        roleIds.add(role.roleId);
      }
    }

    for (const mandate of data.mandates) {
      if (mandate.bodyId === bodyId) {
        roleIds.add(mandate.roleId);
      }
    }

    return {
      bodyId,
      body: bodiesById.get(bodyId),
      roles: [...roleIds].sort(compareNumericString).map((roleId) => ({
        roleId,
        role: rolesById.get(roleId),
        mandates: data.mandates
          .filter(
            (mandate) =>
              mandate.bodyId === bodyId && mandate.roleId === roleId,
          )
          .sort((left, right) =>
            compareNumericString(left.mandateId, right.mandateId),
          ),
      })),
    };
  });
}

function getGovernanceSummary(
  data: GovernanceData,
  powerMap: readonly PowerMapBody[],
  nowSeconds: number,
): {
  readonly bodies: number;
  readonly roles: number;
  readonly holders: number;
  readonly activeMandates: number;
} {
  const holders = new Set(
    data.mandates.map((mandate) => mandate.holderAddress.toLowerCase()),
  );

  return {
    bodies: Math.max(data.bodies.length, powerMap.length),
    roles: data.roles.length,
    holders: holders.size,
    activeMandates: data.mandates.filter(
      (mandate) => getMandateState(mandate, nowSeconds).rank === "active",
    ).length,
  };
}

function getBodyName(body: BodyDto | undefined, bodyId: string): string {
  const name = body?.name.trim();
  return name && name.length > 0 ? name : `Body #${bodyId}`;
}

function getRoleName(role: RoleDto | undefined, roleId: string): string {
  const name = role?.name.trim();
  return name && name.length > 0 ? name : `Role #${roleId}`;
}

function getBodyKindLabel(body: BodyDto | undefined): string {
  return body ? formatLabel(body.kind) : "Body kind unavailable";
}

function getHolderLabel(holderAddress: string): string {
  const trimmed = holderAddress.trim();
  return trimmed.length > 0 ? formatAddress(trimmed) : "Holder address";
}

function getMandateState(
  mandate: MandateDto,
  nowSeconds: number,
): MandateState {
  const startTime = parseNumericBigInt(mandate.startTime);
  const endTime = parseNumericBigInt(mandate.endTime);
  const now = BigInt(nowSeconds);

  if (mandate.revoked) {
    return { label: "Revoked", tone: "danger", rank: "revoked" };
  }

  if (startTime !== undefined && startTime > now) {
    return {
      label: "Not yet active",
      tone: "warning",
      rank: "not-yet-active",
    };
  }

  if (endTime !== undefined && endTime > 0n && endTime <= now) {
    return { label: "Expired", tone: "muted", rank: "expired" };
  }

  if (mandate.active) {
    return { label: "Active", tone: "success", rank: "active" };
  }

  return { label: "Inactive", tone: "muted", rank: "inactive" };
}

function getProposalScopeDisplay(mask: string): ProposalScopeDisplay {
  const parsedMask = parseNumericBigInt(mask);
  if (parsedMask === undefined) {
    return { proposalTypes: [], fallbackLabel: `Mask ${mask}` };
  }

  const proposalTypes = Object.entries(
    PROPOSAL_TYPE_CHAIN_MAP.valuesByCode,
  ).flatMap(([code, proposalType]) => {
    const bit = 1n << BigInt(code);
    return (parsedMask & bit) !== 0n ? [proposalType] : [];
  });

  if (parsedMask === 0n) {
    return { proposalTypes, fallbackLabel: "No proposal types" };
  }

  return {
    proposalTypes,
    fallbackLabel: proposalTypes.length === 0 ? `Mask ${mask}` : undefined,
  };
}

function formatSpendingLimit(value: string): string {
  const parsed = parseNumericBigInt(value);
  if (parsed === 0n) {
    return "No spending limit";
  }

  return `${formatNumericString(value)} raw units`;
}

function formatMandateStart(value: string): string {
  return parseNumericBigInt(value) === 0n ? "Immediate" : formatChainTime(value);
}

function formatMandateEnd(value: string): string {
  return parseNumericBigInt(value) === 0n ? "No end time" : formatChainTime(value);
}

function parseNumericBigInt(value: string): bigint | undefined {
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function compareNumericString(left: string, right: string): number {
  const leftValue = Number(left);
  const rightValue = Number(right);

  if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
    return leftValue - rightValue;
  }

  return left.localeCompare(right);
}
