import type { IsoniaControlPlaneClient } from "@isonia/sdk";
import type {
  BodyDto,
  MandateDto,
  OrganizationDto,
  OrganizationPolicyDto,
  RoleDto,
} from "@isonia/types";
import type {
  BodyCreatedLog,
  MandateAssignedLog,
  OrganizationCreatedLog,
  PolicyRuleSetLog,
  RoleCreatedLog,
} from "../../chain/setup-contracts";
import type {
  AssignMandatePayload,
  SetPolicyRulePayload,
} from "./setup-action-execution-types";
import {
  delay,
  sameAddress,
  sameHex,
  sameStringArray,
  toError,
} from "./setup-action-execution-helpers";

const INDEXER_POLL_INTERVAL_MS = 1_500;
const INDEXER_TIMEOUT_MS = 60_000;

export async function waitForIndexedOrganization({
  client,
  created,
  txHash,
}: {
  readonly client: IsoniaControlPlaneClient;
  readonly created: OrganizationCreatedLog;
  readonly txHash: `0x${string}`;
}): Promise<OrganizationDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const organizations = await client.getOrganizations();
      const byTxHash = organizations.find((organization) =>
        sameHex(organization.createdTxHash, txHash),
      );
      if (byTxHash) {
        return byTxHash;
      }

      const byCreatedId = organizations.find(
        (organization) =>
          organization.orgId === created.orgId &&
          sameAddress(organization.adminAddress, created.adminAddress) &&
          organization.slug === created.slug,
      );
      if (byCreatedId) {
        return byCreatedId;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: organization from ${txHash} did not appear in Control Plane read models within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

export async function waitForIndexedBody({
  client,
  created,
  txHash,
}: {
  readonly client: IsoniaControlPlaneClient;
  readonly created: BodyCreatedLog;
  readonly txHash: `0x${string}`;
}): Promise<BodyDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const bodies = await client.getBodies(created.orgId);
      const byCreatedId = bodies.find(
        (body) =>
          body.orgId === created.orgId &&
          body.bodyId === created.bodyId &&
          body.kind === created.kind,
      );
      if (byCreatedId) {
        return byCreatedId;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: body #${created.bodyId} from ${txHash} did not appear in Control Plane read models within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

export async function waitForIndexedRole({
  client,
  created,
  txHash,
}: {
  readonly client: IsoniaControlPlaneClient;
  readonly created: RoleCreatedLog;
  readonly txHash: `0x${string}`;
}): Promise<RoleDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const roles = await client.getRoles(created.orgId);
      const byCreatedId = roles.find(
        (role) =>
          role.orgId === created.orgId &&
          role.bodyId === created.bodyId &&
          role.roleId === created.roleId &&
          role.roleType === created.roleType,
      );
      if (byCreatedId) {
        return byCreatedId;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: role #${created.roleId} from ${txHash} did not appear in Control Plane read models within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

export async function waitForIndexedMandate({
  assigned,
  client,
  payload,
  txHash,
}: {
  readonly assigned: MandateAssignedLog;
  readonly client: IsoniaControlPlaneClient;
  readonly payload: AssignMandatePayload;
  readonly txHash: `0x${string}`;
}): Promise<MandateDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const mandates = await client.getMandates(assigned.orgId);
      const byCreatedId = mandates.find((mandate) =>
        mandateMatchesAssignedLog(mandate, assigned),
      );
      if (byCreatedId) {
        return byCreatedId;
      }

      const byContext = mandates.find((mandate) =>
        mandateMatchesPayloadContext(mandate, payload),
      );
      if (byContext) {
        return byContext;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: mandate #${assigned.mandateId} from ${txHash} did not appear in Control Plane read models within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

export async function waitForIndexedPolicyRule({
  client,
  payload,
  policySet,
  txHash,
}: {
  readonly client: IsoniaControlPlaneClient;
  readonly payload: SetPolicyRulePayload;
  readonly policySet: PolicyRuleSetLog;
  readonly txHash: `0x${string}`;
}): Promise<OrganizationPolicyDto> {
  const deadline = Date.now() + INDEXER_TIMEOUT_MS;
  let lastError: Error | undefined;

  while (Date.now() < deadline) {
    try {
      const policies = await client.policies.list(policySet.orgId);
      const byVersion = policies.find((policy) =>
        policyMatchesPolicySetLog(policy, policySet),
      );
      if (byVersion) {
        assertIndexedPolicyMatchesPayload(byVersion, payload);
        return byVersion;
      }
    } catch (error: unknown) {
      lastError = toError(error);
    }

    await delay(INDEXER_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Indexer timeout: policy ${policySet.proposalType} v${policySet.version} from ${txHash} did not appear in Control Plane read models within ${
      INDEXER_TIMEOUT_MS / 1_000
    } seconds.${lastError ? ` Last API error: ${lastError.message}` : ""}`,
  );
}

function mandateMatchesAssignedLog(
  mandate: MandateDto,
  assigned: MandateAssignedLog,
): boolean {
  return (
    mandate.orgId === assigned.orgId &&
    mandate.mandateId === assigned.mandateId &&
    mandate.bodyId === assigned.bodyId &&
    mandate.roleId === assigned.roleId &&
    sameAddress(mandate.holderAddress, assigned.holderAddress) &&
    mandate.startTime === assigned.startTime &&
    mandate.endTime === assigned.endTime &&
    mandate.proposalTypeMask === assigned.proposalTypeMask &&
    mandate.spendingLimit === assigned.spendingLimit
  );
}

function mandateMatchesPayloadContext(
  mandate: MandateDto,
  payload: AssignMandatePayload,
): boolean {
  return (
    mandate.orgId === payload.orgId &&
    mandate.roleId === payload.roleId &&
    sameAddress(mandate.holderAddress, payload.holderAddress) &&
    mandate.startTime === payload.startTime &&
    mandate.endTime === payload.endTime &&
    mandate.proposalTypeMask === payload.proposalTypeMask &&
    mandate.spendingLimit === payload.spendingLimit &&
    mandate.active &&
    !mandate.revoked
  );
}

function assertIndexedPolicyMatchesPayload(
  policy: OrganizationPolicyDto,
  payload: SetPolicyRulePayload,
): void {
  if (!sameStringArray(policy.requiredApprovalBodies, payload.requiredApprovalBodyIds)) {
    throw new Error(
      "Indexed policy approval bodies do not match the resolved draft bodyIds.",
    );
  }

  if (!sameStringArray(policy.vetoBodies, payload.vetoBodyIds)) {
    throw new Error(
      "Indexed policy veto bodies do not match the resolved draft bodyIds.",
    );
  }

  if ((policy.executorBody ?? "0") !== payload.executorBodyId) {
    throw new Error(
      `Indexed policy executor body #${policy.executorBody ?? "0"} does not match expected #${payload.executorBodyId}.`,
    );
  }

  if (policy.timelockSeconds !== payload.timelockSeconds) {
    throw new Error(
      `Indexed policy timelock ${policy.timelockSeconds} does not match expected ${payload.timelockSeconds}.`,
    );
  }

  if (policy.enabled !== payload.enabled) {
    throw new Error(
      `Indexed policy enabled=${String(policy.enabled)} does not match expected enabled=${String(payload.enabled)}.`,
    );
  }
}

function policyMatchesPolicySetLog(
  policy: OrganizationPolicyDto,
  policySet: PolicyRuleSetLog,
): boolean {
  return (
    policy.orgId === policySet.orgId &&
    policy.proposalType === policySet.proposalType &&
    policy.version === policySet.version &&
    sameStringArray(policy.requiredApprovalBodies, policySet.requiredApprovalBodies) &&
    sameStringArray(policy.vetoBodies, policySet.vetoBodies) &&
    (policy.executorBody ?? "0") === policySet.executorBody &&
    policy.timelockSeconds === policySet.timelockSeconds &&
    policy.enabled === policySet.enabled
  );
}
