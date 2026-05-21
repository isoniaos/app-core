import { ProposalStatus } from "@isonia/types";

export function isTerminalProposalStatus(status: ProposalStatus): boolean {
  return [
    ProposalStatus.Cancelled,
    ProposalStatus.Executed,
    ProposalStatus.Expired,
    ProposalStatus.Vetoed,
  ].includes(status);
}

export function isCompletedProposalStatus(status: ProposalStatus): boolean {
  return status === ProposalStatus.Executed;
}
