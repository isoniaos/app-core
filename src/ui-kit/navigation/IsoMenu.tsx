import { Menu, Portal } from "@chakra-ui/react";
import type { ReactElement, ReactNode } from "react";

export interface IsoMenuItem {
  readonly disabled?: boolean;
  readonly label: ReactNode;
  readonly onSelect?: () => void;
  readonly value: string;
}

export interface IsoMenuProps {
  readonly ariaLabel?: string;
  readonly items: readonly IsoMenuItem[];
  readonly trigger: ReactElement;
}

export function IsoMenu({
  ariaLabel,
  items,
  trigger,
}: IsoMenuProps): JSX.Element {
  return (
    <Menu.Root>
      <Menu.Trigger aria-label={ariaLabel} asChild>
        {trigger}
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {items.map((item) => (
              <Menu.Item
                disabled={item.disabled}
                key={item.value}
                onSelect={item.onSelect}
                value={item.value}
              >
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
