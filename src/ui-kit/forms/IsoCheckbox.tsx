import { Checkbox } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface IsoCheckboxProps {
  readonly checked?: boolean;
  readonly children?: ReactNode;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly name?: string;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly value?: string;
}

export function IsoCheckbox({
  checked,
  children,
  disabled,
  id,
  name,
  onCheckedChange,
  value,
}: IsoCheckboxProps): JSX.Element {
  return (
    <Checkbox.Root
      checked={checked}
      disabled={disabled}
      id={id}
      name={name}
      onCheckedChange={(details) =>
        onCheckedChange?.(details.checked === true)
      }
      value={value}
    >
      <Checkbox.HiddenInput />
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      {children ? <Checkbox.Label>{children}</Checkbox.Label> : null}
    </Checkbox.Root>
  );
}
