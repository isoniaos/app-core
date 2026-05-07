import { Button } from "@chakra-ui/react";
import type { ComponentProps } from "react";

export type IsoButtonProps = ComponentProps<typeof Button>;

export function IsoButton(props: IsoButtonProps): JSX.Element {
  return <Button {...props} />;
}
