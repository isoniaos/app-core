import { Input } from "@chakra-ui/react";
import type { InputHTMLAttributes } from "react";

export interface IsoInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  readonly size?: "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
}

export function IsoInput(props: IsoInputProps): JSX.Element {
  return <Input {...props} />;
}
