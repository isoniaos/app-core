import type { MetadataRecord } from "./types";

type DemoMetadataInput = Omit<MetadataRecord, "uri" | "resolvedUri">;

const DEMO_METADATA: Record<string, DemoMetadataInput> = {
  "ipfs://simple-dao-plus": {
    name: "Simple DAO Plus",
    description:
      "A compact demo organization with council, treasury, security, and executor paths.",
  },
  "ipfs://bicameral-preview": {
    name: "Bicameral Preview",
    description:
      "A preview organization with capital, merit, and emergency governance bodies.",
  },
  "ipfs://simple-general-council": {
    name: "General Council",
    description:
      "Primary council for standard proposals and treasury coordination.",
  },
  "ipfs://simple-treasury-committee": {
    name: "Treasury Committee",
    description: "Specialized committee for treasury approvals.",
  },
  "ipfs://simple-security-council": {
    name: "Security Council",
    description: "Veto-capable body for treasury risk checks.",
  },
  "ipfs://capital-house": {
    name: "Capital House",
    description: "Capital-side approval body for treasury decisions.",
  },
  "ipfs://merit-house": {
    name: "Merit House",
    description: "Merit-side approval and execution body for upgrades.",
  },
  "ipfs://emergency-council": {
    name: "Emergency Council",
    description: "Emergency body with upgrade veto and emergency authority.",
  },
  "ipfs://role-1": { name: "Standard Proposer" },
  "ipfs://role-2": { name: "Treasury Proposer" },
  "ipfs://role-3": { name: "Standard Approver" },
  "ipfs://role-4": { name: "Treasury Council Approver" },
  "ipfs://role-5": { name: "Treasury Committee Approver" },
  "ipfs://role-6": { name: "Security Vetoer" },
  "ipfs://role-7": { name: "Standard Executor" },
  "ipfs://role-8": { name: "Treasury Executor" },
  "ipfs://role-9": { name: "Treasury Proposer" },
  "ipfs://role-10": { name: "Upgrade Proposer" },
  "ipfs://role-11": { name: "Capital Treasury Approver" },
  "ipfs://role-12": { name: "Merit Upgrade Approver" },
  "ipfs://role-13": { name: "Emergency Upgrade Vetoer" },
  "ipfs://role-14": { name: "Emergency Approver" },
  "ipfs://role-15": { name: "Capital Treasury Executor" },
  "ipfs://role-16": { name: "Merit Upgrade Executor" },
  "ipfs://role-17": { name: "Emergency Executor" },
  "ipfs://proposal-1": {
    title: "Set Demo Number 101",
    description: "Standard proposal in the Simple DAO Plus demo.",
  },
  "ipfs://proposal-2": {
    title: "Treasury Demo Action 202",
    description: "Treasury proposal requiring council and treasury approval.",
  },
  "ipfs://proposal-3": {
    title: "Treasury Demo Action 303",
    description: "Treasury proposal in the bicameral preview organization.",
  },
  "ipfs://proposal-4": {
    title: "Upgrade Demo Action 404",
    description: "Upgrade proposal with emergency veto checks.",
  },
};

export function getDemoMetadataRecord(
  uri: string,
  resolvedUri: string,
): MetadataRecord | undefined {
  const key = normalizeDemoKey(uri);
  const metadata = DEMO_METADATA[key];
  return metadata ? { uri, resolvedUri, ...metadata } : undefined;
}

function normalizeDemoKey(uri: string): string {
  const trimmed = uri.trim();
  return trimmed.toLowerCase().startsWith("ipfs://")
    ? `ipfs://${trimmed.slice("ipfs://".length)}`
    : trimmed;
}
