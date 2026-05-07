import { Alert } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";

export interface IsoAlertProps
  extends Omit<ComponentProps<typeof Alert.Root>, "title"> {
  readonly description?: ReactNode;
  readonly title?: ReactNode;
}

export function IsoAlert({
  children,
  description,
  title,
  ...props
}: IsoAlertProps): JSX.Element {
  return (
    <Alert.Root {...props}>
      <Alert.Indicator />
      <Alert.Content>
        {title ? <Alert.Title>{title}</Alert.Title> : null}
        {description ? (
          <Alert.Description>{description}</Alert.Description>
        ) : null}
        {children}
      </Alert.Content>
    </Alert.Root>
  );
}
