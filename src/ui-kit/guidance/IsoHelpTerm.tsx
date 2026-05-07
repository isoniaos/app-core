import type { ReactNode } from "react";
import { IsoToggleTip } from "./IsoToggleTip";
import { glossary } from "./glossary";
import type { IsoGlossaryEntry, IsoGlossaryTerm } from "./glossary";

export interface IsoHelpTermProps {
  readonly children?: ReactNode;
  readonly term: IsoGlossaryTerm;
}

export function IsoHelpTerm({
  children,
  term,
}: IsoHelpTermProps): JSX.Element {
  const entry: IsoGlossaryEntry = glossary[term];

  return (
    <IsoToggleTip
      content={entry.details ?? entry.description}
      title={entry.title}
    >
      <button
        aria-label={`Explain ${entry.title}`}
        style={{
          background: "transparent",
          border: 0,
          borderBottom: "1px dotted currentColor",
          color: "inherit",
          cursor: "help",
          display: "inline",
          font: "inherit",
          padding: 0,
        }}
        type="button"
      >
        {children ?? entry.title}
      </button>
    </IsoToggleTip>
  );
}
