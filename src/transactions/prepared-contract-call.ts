import type { Address } from "@isonia/types";

export interface PreparedContractCall {
  readonly actionId: string;
  readonly chainId: number;
  readonly data: `0x${string}`;
  readonly title: string;
  readonly to: Address;
  readonly value: `0x${string}`;
}
