import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { GraphPage } from "../features/graph/GraphPage";
import { GovernancePage } from "../features/governance/GovernancePage";
import { HomePage } from "../features/home/HomePage";
import { OrganizationOverviewPage } from "../features/organizations/OrganizationOverviewPage";
import { OrganizationsPage } from "../features/organizations/OrganizationsPage";
import { ProposalDetailsPage } from "../features/proposals/ProposalDetailsPage";
import { ProposalsPage } from "../features/proposals/ProposalsPage";
import { AppShell } from "./AppShell";
import { NotFoundPage } from "./NotFoundPage";

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/orgs" element={<OrganizationsPage />} />
          <Route path="/orgs/:orgId" element={<OrganizationOverviewPage />} />
          <Route path="/orgs/:orgId/governance" element={<GovernancePage />} />
          <Route path="/orgs/:orgId/proposals" element={<ProposalsPage />} />
          <Route
            path="/orgs/:orgId/proposals/:proposalId"
            element={<ProposalDetailsPage />}
          />
          <Route path="/orgs/:orgId/graph" element={<GraphPage />} />
          <Route path="/organizations" element={<Navigate to="/orgs" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

