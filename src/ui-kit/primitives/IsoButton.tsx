import { Button } from "@chakra-ui/react";
import type { ComponentProps } from "react";

export type IsoButtonProps = ComponentProps<typeof Button>;

export function IsoButton({
  className,
  ...props
}: IsoButtonProps): JSX.Element {
  return (
    <Button
      className={["iso-button", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
