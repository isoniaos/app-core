import type { Abi } from "viem";

export const ISONIA_PROTOCOL_ERROR_ABI = [
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "EmptySlug", inputs: [] },
  { type: "error", name: "SlugAlreadyExists", inputs: [] },
  {
    type: "error",
    name: "OrganizationNotFound",
    inputs: [{ name: "orgId", type: "uint64" }],
  },
  {
    type: "error",
    name: "OrganizationNotActive",
    inputs: [{ name: "orgId", type: "uint64" }],
  },
  {
    type: "error",
    name: "OrganizationAlreadyFinalized",
    inputs: [{ name: "orgId", type: "uint64" }],
  },
  {
    type: "error",
    name: "Unauthorized",
    inputs: [{ name: "actor", type: "address" }],
  },
  {
    type: "error",
    name: "BodyNotFound",
    inputs: [{ name: "bodyId", type: "uint64" }],
  },
  {
    type: "error",
    name: "BodyDoesNotBelongToOrg",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "bodyId", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "RoleNotFound",
    inputs: [{ name: "roleId", type: "uint64" }],
  },
  {
    type: "error",
    name: "RoleDoesNotBelongToOrg",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "roleId", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "MandateNotFound",
    inputs: [{ name: "mandateId", type: "uint64" }],
  },
  { type: "error", name: "InvalidMandateTimeRange", inputs: [] },
  { type: "error", name: "InvalidProposalType", inputs: [] },
  {
    type: "error",
    name: "PolicyRuleNotEnabled",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "proposalType", type: "uint8" },
    ],
  },
  {
    type: "error",
    name: "ProposalNotFound",
    inputs: [{ name: "proposalId", type: "uint64" }],
  },
  {
    type: "error",
    name: "ProposalDoesNotBelongToOrg",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "proposalId", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "InvalidProposalStatus",
    inputs: [{ name: "current", type: "uint8" }],
  },
  {
    type: "error",
    name: "BodyNotRequiredApprover",
    inputs: [{ name: "bodyId", type: "uint64" }],
  },
  {
    type: "error",
    name: "BodyNotVetoer",
    inputs: [{ name: "bodyId", type: "uint64" }],
  },
  {
    type: "error",
    name: "AlreadyApproved",
    inputs: [
      { name: "proposalId", type: "uint64" },
      { name: "bodyId", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "AlreadyVetoed",
    inputs: [
      { name: "proposalId", type: "uint64" },
      { name: "bodyId", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "MissingRequiredApprovals",
    inputs: [{ name: "proposalId", type: "uint64" }],
  },
  {
    type: "error",
    name: "TimelockNotExpired",
    inputs: [
      { name: "proposalId", type: "uint64" },
      { name: "executableAt", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "DataHashMismatch",
    inputs: [
      { name: "expected", type: "bytes32" },
      { name: "actual", type: "bytes32" },
    ],
  },
  {
    type: "error",
    name: "ExecutionTargetNotAllowed",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "target", type: "address" },
    ],
  },
  {
    type: "error",
    name: "ExecutionSelectorNotAllowed",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "target", type: "address" },
      { name: "selector", type: "bytes4" },
    ],
  },
  {
    type: "error",
    name: "ActionSelectorMismatch",
    inputs: [
      { name: "expectedSelector", type: "bytes4" },
      { name: "actualSelector", type: "bytes4" },
    ],
  },
  { type: "error", name: "InvalidExecutionCalldata", inputs: [] },
  {
    type: "error",
    name: "ExecutionValueLimitExceeded",
    inputs: [
      { name: "orgId", type: "uint64" },
      { name: "target", type: "address" },
      { name: "limit", type: "uint256" },
      { name: "value", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "InvalidOrgExecutor",
    inputs: [{ name: "executor", type: "address" }],
  },
  {
    type: "error",
    name: "OrgExecutorOrgMismatch",
    inputs: [
      { name: "expectedOrgId", type: "uint64" },
      { name: "actualOrgId", type: "uint64" },
    ],
  },
  {
    type: "error",
    name: "InvalidOrganizationStatus",
    inputs: [{ name: "status", type: "uint8" }],
  },
  {
    type: "error",
    name: "InvalidStatusTransition",
    inputs: [
      { name: "current", type: "uint8" },
      { name: "nextStatus", type: "uint8" },
    ],
  },
  { type: "error", name: "InvalidBodyKind", inputs: [] },
  { type: "error", name: "InvalidRoleType", inputs: [] },
  { type: "error", name: "InvalidExecutorBody", inputs: [] },
  { type: "error", name: "EmptyBatch", inputs: [] },
  {
    type: "error",
    name: "InvalidExecutionValue",
    inputs: [
      { name: "expected", type: "uint256" },
      { name: "actual", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ExecutionFailed",
    inputs: [{ name: "reason", type: "bytes" }],
  },
] as const satisfies Abi;
