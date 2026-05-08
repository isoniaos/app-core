import { IsoIcon } from "../../ui-kit";

export interface RoutePreviewFact {
  readonly icon: "check" | "job" | "timelock" | "warning" | "x";
  readonly label: string;
  readonly value: string;
}

export interface RoutePreviewCardProps {
  readonly description: string;
  readonly facts: readonly RoutePreviewFact[];
  readonly title: string;
}

export function RoutePreviewCard({
  description,
  facts,
  title,
}: RoutePreviewCardProps): JSX.Element {
  return (
    <article className="route-preview-card">
      <div className="route-preview-card-header">
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      <dl className="route-preview-facts">
        {facts.map((fact) => (
          <div className="route-preview-fact" key={fact.label}>
            <dt>
              <IsoIcon name={fact.icon} size={16} />
              <span>{fact.label}</span>
            </dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
