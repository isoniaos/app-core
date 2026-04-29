import { defaultThemeBrand } from "@isonia/theme-default";
import type { PropsWithChildren } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useRuntimeConfig } from "../config/runtime-config";
import { DiagnosticsStatusIndicator } from "../features/diagnostics/DiagnosticsStatusIndicator";
import { WalletStatus } from "../wallet/WalletStatus";

export function AppShell({ children }: PropsWithChildren): JSX.Element {
  const runtimeConfig = useRuntimeConfig();
  const location = useLocation();
  const orgId = getOrgIdFromPath(location.pathname);

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink
          to="/"
          className="brand-link"
          aria-label={`${defaultThemeBrand.productName} home`}
        >
          <span className="brand-mark" aria-hidden="true">
            {defaultThemeBrand.mark}
          </span>
          <span>{runtimeConfig.appName}</span>
        </NavLink>
        <div className="topbar-actions">
          <DiagnosticsStatusIndicator />
          <WalletStatus />
        </div>
      </header>

      <div className="shell-body">
        <aside className="sidebar" aria-label="Primary navigation">
          <nav className="nav-stack">
            <NavLink to="/orgs" className={navClassName}>
              Organizations
            </NavLink>
            <NavLink to="/orgs/new" className={navClassName}>
              New Organization
            </NavLink>
            <NavLink to="/diagnostics" className={navClassName}>
              Diagnostics
            </NavLink>
            {orgId ? (
              <>
                <div className="nav-group-label">Org #{orgId}</div>
                <NavLink to={`/orgs/${orgId}`} end className={navClassName}>
                  Overview
                </NavLink>
                <NavLink to={`/orgs/${orgId}/setup`} className={navClassName}>
                  Setup
                </NavLink>
                <NavLink
                  to={`/orgs/${orgId}/governance`}
                  className={navClassName}
                >
                  Governance
                </NavLink>
                <NavLink
                  to={`/orgs/${orgId}/proposals`}
                  className={navClassName}
                >
                  Proposals
                </NavLink>
                <NavLink to={`/orgs/${orgId}/graph`} className={navClassName}>
                  Graph
                </NavLink>
              </>
            ) : null}
          </nav>
        </aside>
        <main className="content-shell">{children}</main>
      </div>
    </div>
  );
}

function navClassName({ isActive }: { readonly isActive: boolean }): string {
  return isActive ? "nav-link nav-link-active" : "nav-link";
}

function getOrgIdFromPath(pathname: string): string | undefined {
  const match = /^\/orgs\/([^/]+)/.exec(pathname);
  const orgId = match?.[1];
  return orgId && orgId !== "new" ? orgId : undefined;
}
