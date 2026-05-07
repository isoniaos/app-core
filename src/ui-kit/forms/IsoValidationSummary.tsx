import { Box, List } from "@chakra-ui/react";
import { IsoAlert } from "../primitives/IsoAlert";

export interface IsoValidationSummaryProps {
  readonly errors: readonly string[];
  readonly title?: string;
}

export function IsoValidationSummary({
  errors,
  title = "Review the following issues",
}: IsoValidationSummaryProps): JSX.Element | null {
  if (errors.length === 0) {
    return null;
  }

  return (
    <IsoAlert status="error" title={title}>
      <Box as="ul" marginBlockStart="2" paddingInlineStart="5">
        {errors.map((error) => (
          <List.Item key={error}>{error}</List.Item>
        ))}
      </Box>
    </IsoAlert>
  );
}
