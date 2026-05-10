import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  DiagnosticsHomePage,
  DiagnosticsPage,
} from "../features/diagnostics/DiagnosticsPage";
import { GovernanceStructurePage } from "../features/governance-structure/GovernanceStructurePage";
import { OrganizationOverviewPage } from "../features/organizations/OrganizationOverviewPage";
import { OrganizationsPage } from "../features/organizations/OrganizationsPage";
import { CreateProposalPage } from "../features/proposals/CreateProposalPage";
import { ProposalDetailsPage } from "../features/proposals/ProposalDetailsPage";
import { ProposalsPage } from "../features/proposals/ProposalsPage";
import { NewOrganizationSetupPage } from "../features/setup/creation/NewOrganizationSetupPage";
import { OrganizationSetupPage } from "../features/setup/activation/OrganizationSetupPage";
import { TransactionModalProvider } from "../transactions";
import { AppShell } from "./AppShell";
import { NotFoundPage } from "./NotFoundPage";

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <TransactionModalProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<DiagnosticsHomePage />} />
            <Route path="/orgs" element={<OrganizationsPage />} />
            <Route path="/orgs/new" element={<NewOrganizationSetupPage />} />
            <Route path="/diagnostics" element={<DiagnosticsPage />} />
            <Route path="/orgs/:orgId" element={<OrganizationOverviewPage />} />
            <Route path="/orgs/:orgId/setup" element={<OrganizationSetupPage />} />
            <Route
              path="/orgs/:orgId/governance"
              element={<GovernanceStructurePage />}
            />
            <Route path="/orgs/:orgId/proposals" element={<ProposalsPage />} />
            <Route
              path="/orgs/:orgId/proposals/new"
              element={<CreateProposalPage />}
            />
            <Route
              path="/orgs/:orgId/proposals/:proposalId"
              element={<ProposalDetailsPage />}
            />
            <Route
              path="/orgs/:orgId/graph"
              element={<GovernanceStructurePage />}
            />
            <Route path="/organizations" element={<Navigate to="/orgs" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppShell>
      </TransactionModalProvider>
    </BrowserRouter>
  );
}
