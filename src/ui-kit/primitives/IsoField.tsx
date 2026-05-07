import { Field } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";

export interface IsoFieldProps extends ComponentProps<typeof Field.Root> {
  readonly errorText?: ReactNode;
  readonly helperText?: ReactNode;
  readonly label?: ReactNode;
}

export function IsoField({
  children,
  errorText,
  helperText,
  label,
  ...props
}: IsoFieldProps): JSX.Element {
  return (
    <Field.Root {...props}>
      {label ? <Field.Label>{label}</Field.Label> : null}
      {children}
      {helperText ? <Field.HelperText>{helperText}</Field.HelperText> : null}
      {errorText ? <Field.ErrorText>{errorText}</Field.ErrorText> : null}
    </Field.Root>
  );
}
