import { Breadcrumb } from "@chakra-ui/react";
import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IsoIcon, type IsoIconName } from "../icons/IsoIcon";

export interface IsoBreadcrumbItem {
  readonly current?: boolean;
  readonly icon?: IsoIconName;
  readonly label: ReactNode;
  readonly to?: string;
}

export interface IsoBreadcrumbsProps {
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly items: readonly IsoBreadcrumbItem[];
}

export function IsoBreadcrumbs({
  ariaLabel = "Breadcrumb",
  className,
  items,
}: IsoBreadcrumbsProps): JSX.Element {
  return (
    <Breadcrumb.Root
      aria-label={ariaLabel}
      className={["iso-breadcrumbs", className].filter(Boolean).join(" ")}
      size="sm"
      variant="plain"
    >
      <Breadcrumb.List className="iso-breadcrumbs-list">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          const current = item.current ?? last;

          return (
            <Fragment key={index}>
              <Breadcrumb.Item className="iso-breadcrumbs-item">
                {current || !item.to ? (
                  <Breadcrumb.CurrentLink className="iso-breadcrumbs-current">
                    <BreadcrumbLabel item={item} />
                  </Breadcrumb.CurrentLink>
                ) : (
                  <Breadcrumb.Link asChild className="iso-breadcrumbs-link">
                    <Link to={item.to}>
                      <BreadcrumbLabel item={item} />
                    </Link>
                  </Breadcrumb.Link>
                )}
              </Breadcrumb.Item>
              {!last ? (
                <Breadcrumb.Separator className="iso-breadcrumbs-separator">
                  <IsoIcon name="chevron-right" size={13} strokeWidth={2} />
                </Breadcrumb.Separator>
              ) : null}
            </Fragment>
          );
        })}
      </Breadcrumb.List>
    </Breadcrumb.Root>
  );
}

function BreadcrumbLabel({
  item,
}: {
  readonly item: IsoBreadcrumbItem;
}): JSX.Element {
  return (
    <span className="iso-breadcrumbs-label">
      {item.icon ? <IsoIcon name={item.icon} size={14} /> : null}
      <span>{item.label}</span>
    </span>
  );
}
