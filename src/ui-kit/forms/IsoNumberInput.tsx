import { HStack, NumberInput } from "@chakra-ui/react";

export interface IsoNumberInputProps {
  readonly disabled?: boolean;
  readonly id?: string;
  readonly max?: number;
  readonly min?: number;
  readonly name?: string;
  readonly onValueChange?: (value: string) => void;
  readonly placeholder?: string;
  readonly step?: number;
  readonly value?: string;
}

export function IsoNumberInput({
  disabled,
  id,
  max,
  min,
  name,
  onValueChange,
  placeholder,
  step,
  value,
}: IsoNumberInputProps): JSX.Element {
  return (
    <NumberInput.Root
      disabled={disabled}
      id={id}
      max={max}
      min={min}
      name={name}
      onValueChange={(details) => onValueChange?.(details.value)}
      step={step}
      value={value}
    >
      <HStack gap="2">
        <NumberInput.Input placeholder={placeholder} />
        <NumberInput.Control>
          <NumberInput.IncrementTrigger />
          <NumberInput.DecrementTrigger />
        </NumberInput.Control>
      </HStack>
    </NumberInput.Root>
  );
}
