import { Badge } from "@chakra-ui/react";
import type { ComponentProps } from "react";

export type IsoBadgeProps = ComponentProps<typeof Badge>;

export function IsoBadge(props: IsoBadgeProps): JSX.Element {
  return <Badge {...props} />;
}
