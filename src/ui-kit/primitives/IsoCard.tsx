import { Card } from "@chakra-ui/react";
import type { ComponentProps } from "react";

export type IsoCardProps = ComponentProps<typeof Card.Root>;
export type IsoCardHeaderProps = ComponentProps<typeof Card.Header>;
export type IsoCardBodyProps = ComponentProps<typeof Card.Body>;
export type IsoCardFooterProps = ComponentProps<typeof Card.Footer>;
export type IsoCardTitleProps = ComponentProps<typeof Card.Title>;
export type IsoCardDescriptionProps = ComponentProps<typeof Card.Description>;

export function IsoCard(props: IsoCardProps): JSX.Element {
  return <Card.Root {...props} />;
}

export function IsoCardHeader(props: IsoCardHeaderProps): JSX.Element {
  return <Card.Header {...props} />;
}

export function IsoCardBody(props: IsoCardBodyProps): JSX.Element {
  return <Card.Body {...props} />;
}

export function IsoCardFooter(props: IsoCardFooterProps): JSX.Element {
  return <Card.Footer {...props} />;
}

export function IsoCardTitle(props: IsoCardTitleProps): JSX.Element {
  return <Card.Title {...props} />;
}

export function IsoCardDescription(
  props: IsoCardDescriptionProps,
): JSX.Element {
  return <Card.Description {...props} />;
}
