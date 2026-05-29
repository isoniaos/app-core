import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface IsoFormSectionProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly description?: ReactNode;
  readonly title: ReactNode;
}

export function IsoFormSection({
  actions,
  children,
  description,
  title,
}: IsoFormSectionProps): JSX.Element {
  return (
    <Box as="section">
      <Stack gap="4">
        <Stack gap="1">
          <Text
            as="h2"
            color="isonia.foreground"
            fontSize="lg"
            fontWeight="var(--iso-font-weight-bold)"
          >
            {title}
          </Text>
          {description ? (
            <Text color="isonia.muted" fontSize="sm">
              {description}
            </Text>
          ) : null}
        </Stack>
        <Stack gap="4">{children}</Stack>
        {actions ? <Box>{actions}</Box> : null}
      </Stack>
    </Box>
  );
}
