import { defaultThemeBrand } from "@isonia/theme-default";
import type { PropsWithChildren } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useRuntimeConfig } from "../config/runtime-config";
import { DiagnosticsStatusIndicator } from "../features/diagnostics/DiagnosticsStatusIndicator";
import {
  ColorModeToggle,
  IsoIcon,
  IsoLogo,
  type IsoIconName,
} from "../ui-kit";
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
          <IsoLogo
            className="brand-logo"
            decorative
            markOnly
            size="sm"
            variant="auto"
          />
          <span className="brand-lockup">
            <span className="brand-name">{runtimeConfig.appName}</span>
            <span className="brand-subtitle">Governance workspace</span>
          </span>
        </NavLink>
        <div className="topbar-actions">
          <DiagnosticsStatusIndicator />
          <ColorModeToggle />
          <WalletStatus />
        </div>
      </header>

      <div className="shell-body">
        <aside className="sidebar" aria-label="Primary navigation">
          {orgId ? (
            <div className="sidebar-org-card">
              <span className="sidebar-org-eyebrow">Current organization</span>
              <strong>Org #{orgId}</strong>
              <span className="sidebar-org-state">
                <span className="sidebar-org-state-dot" aria-hidden="true" />
                Selected workspace
              </span>
            </div>
          ) : null}

          <nav className="nav-stack" aria-label="Workspace navigation">
            <div className="nav-section">
              <div className="nav-section-label">Workspace</div>
              <ShellNavLink
                end
                icon="building"
                label="Organizations"
                to="/orgs"
              />
              <ShellNavLink
                icon="add"
                label="New organization"
                to="/orgs/new"
              />
            </div>

            {orgId ? (
              <div className="nav-section">
                <div className="nav-section-label">Governance</div>
                <ShellNavLink
                  end
                  icon="home"
                  label="Overview"
                  to={`/orgs/${orgId}`}
                />
                <ShellNavLink
                  icon="proposals"
                  label="Proposals"
                  to={`/orgs/${orgId}/proposals`}
                />
                <ShellNavLink
                  icon="structure"
                  isActiveOverride={isGovernanceStructureAlias(
                    location.pathname,
                    orgId,
                  )}
                  label="Governance Structure"
                  to={`/orgs/${orgId}/governance`}
                />
                <ShellNavLink
                  icon="setup"
                  label="Setup / Activation"
                  to={`/orgs/${orgId}/setup`}
                />
              </div>
            ) : null}
          </nav>
        </aside>
        <main className="content-shell">{children}</main>
      </div>
    </div>
  );
}

function ShellNavLink({
  end = false,
  icon,
  isActiveOverride = false,
  label,
  to,
}: {
  readonly end?: boolean;
  readonly icon: IsoIconName;
  readonly isActiveOverride?: boolean;
  readonly label: string;
  readonly to: string;
}): JSX.Element {
  return (
    <NavLink
      className={({ isActive }) =>
        navClassName({ isActive: isActive || isActiveOverride })
      }
      end={end}
      to={to}
    >
      <IsoIcon className="nav-link-icon" name={icon} size={17} />
      <span>{label}</span>
    </NavLink>
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

function isGovernanceStructureAlias(
  pathname: string,
  orgId: string,
): boolean {
  return pathname === `/orgs/${orgId}/graph`;
}
