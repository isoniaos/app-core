import { Tabs } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface IsoTabItem {
  readonly content: ReactNode;
  readonly disabled?: boolean;
  readonly label: ReactNode;
  readonly value: string;
}

export interface IsoTabsProps {
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly tabs: readonly IsoTabItem[];
  readonly value?: string;
}

export function IsoTabs({
  ariaLabel,
  className,
  defaultValue,
  onValueChange,
  tabs,
  value,
}: IsoTabsProps): JSX.Element {
  return (
    <Tabs.Root
      className={["iso-tabs", className].filter(Boolean).join(" ")}
      defaultValue={defaultValue}
      onValueChange={(details) => onValueChange?.(details.value)}
      value={value}
    >
      <Tabs.List aria-label={ariaLabel} className="iso-tabs-list">
        {tabs.map((tab) => (
          <Tabs.Trigger
            className="iso-tabs-trigger"
            disabled={tab.disabled}
            key={tab.value}
            value={tab.value}
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content
          className="iso-tabs-content"
          key={tab.value}
          value={tab.value}
        >
          {tab.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
