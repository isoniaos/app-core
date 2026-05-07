import { Switch } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface IsoSwitchProps {
  readonly checked?: boolean;
  readonly children?: ReactNode;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly name?: string;
  readonly onCheckedChange?: (checked: boolean) => void;
}

export function IsoSwitch({
  checked,
  children,
  disabled,
  id,
  name,
  onCheckedChange,
}: IsoSwitchProps): JSX.Element {
  return (
    <Switch.Root
      checked={checked}
      disabled={disabled}
      id={id}
      name={name}
      onCheckedChange={(details) => onCheckedChange?.(details.checked)}
    >
      <Switch.HiddenInput />
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      {children ? <Switch.Label>{children}</Switch.Label> : null}
    </Switch.Root>
  );
}
