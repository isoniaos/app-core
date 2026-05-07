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
  readonly onValueChange?: (value: string) => void;
  readonly tabs: readonly IsoTabItem[];
  readonly value?: string;
}

export function IsoTabs({
  ariaLabel,
  onValueChange,
  tabs,
  value,
}: IsoTabsProps): JSX.Element {
  return (
    <Tabs.Root
      onValueChange={(details) => onValueChange?.(details.value)}
      value={value}
    >
      <Tabs.List aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <Tabs.Trigger
            disabled={tab.disabled}
            key={tab.value}
            value={tab.value}
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content key={tab.value} value={tab.value}>
          {tab.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
