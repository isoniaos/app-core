import { IsoBreadcrumbs, type IsoBreadcrumbItem } from "../ui-kit";

interface PageHeaderProps {
  readonly breadcrumbs?: readonly IsoBreadcrumbItem[];
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
}

export function PageHeader({
  breadcrumbs,
  eyebrow,
  title,
  description,
}: PageHeaderProps): JSX.Element {
  return (
    <div className="section-header">
      {breadcrumbs ? <IsoBreadcrumbs items={breadcrumbs} /> : null}
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
