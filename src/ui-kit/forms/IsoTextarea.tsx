import { Textarea } from "@chakra-ui/react";
import type { TextareaHTMLAttributes } from "react";

export type IsoTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function IsoTextarea(props: IsoTextareaProps): JSX.Element {
  return <Textarea {...props} />;
}
