import { NativeSelect } from "@chakra-ui/react";
import type { SelectHTMLAttributes } from "react";

export interface IsoSelectOption {
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string;
}

export interface IsoSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  readonly options: readonly IsoSelectOption[];
  readonly placeholder?: string;
}

export function IsoSelect({
  options,
  placeholder,
  ...props
}: IsoSelectProps): JSX.Element {
  return (
    <NativeSelect.Root>
      <NativeSelect.Field {...props}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option
            disabled={option.disabled}
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}
