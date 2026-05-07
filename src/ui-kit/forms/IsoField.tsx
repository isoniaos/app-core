import { Field, HStack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface IsoFieldProps {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly disabledReason?: ReactNode;
  readonly errorText?: ReactNode;
  readonly helpText?: ReactNode;
  readonly id?: string;
  readonly label?: ReactNode;
  readonly required?: boolean;
}

export function IsoField({
  children,
  disabled = false,
  disabledReason,
  errorText,
  helpText,
  id,
  label,
  required = false,
}: IsoFieldProps): JSX.Element {
  const helperContent = disabled && disabledReason ? disabledReason : helpText;

  return (
    <Field.Root
      disabled={disabled}
      id={id}
      invalid={Boolean(errorText)}
      required={required}
    >
      {label ? (
        <Field.Label>
          <HStack align="baseline" gap="1">
            <span>{label}</span>
            {required ? (
              <Text as="span" color="isonia.danger" fontSize="xs">
                required
              </Text>
            ) : null}
          </HStack>
        </Field.Label>
      ) : null}
      {children}
      {helperContent ? (
        <Field.HelperText>{helperContent}</Field.HelperText>
      ) : null}
      {errorText ? <Field.ErrorText>{errorText}</Field.ErrorText> : null}
    </Field.Root>
  );
}
