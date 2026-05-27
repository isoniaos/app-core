import { useEffect, useMemo, useState } from "react";
import type { ProposalDto } from "@isonia/types";
import { useRuntimeConfig } from "../../config/runtime-config";
import type { MetadataRecord } from "../../metadata/types";
import {
  buildDemoExecution,
  inferDemoNumber,
} from "../../protocol/demo-proposal-action";

export function useDemoProposalExecution({
  metadata,
  proposal,
}: {
  readonly metadata?: MetadataRecord;
  readonly proposal: ProposalDto;
}): {
  readonly demoExecution: ReturnType<typeof buildDemoExecution>;
  readonly demoNumber: string;
  readonly setDemoNumber: (value: string) => void;
} {
  const runtimeConfig = useRuntimeConfig();
  const inferredDemoNumber = useMemo(
    () =>
      inferDemoNumber({
        proposal,
        textHints: [
          metadata?.title,
          metadata?.name,
          metadata?.description,
          proposal.title,
          proposal.descriptionUri,
        ],
      }),
    [metadata, proposal],
  );
  const [demoNumber, setDemoNumber] = useState(inferredDemoNumber ?? "");

  useEffect(() => {
    setDemoNumber((current) =>
      current.trim().length > 0 ? current : inferredDemoNumber ?? "",
    );
  }, [inferredDemoNumber]);

  const demoExecution = useMemo(
    () =>
      buildDemoExecution({
        localDemoTargetAddress: runtimeConfig.activeDeployment.localDemoTargetAddress,
        demoNumber,
        proposal,
      }),
    [demoNumber, proposal, runtimeConfig.activeDeployment.localDemoTargetAddress],
  );

  return { demoExecution, demoNumber, setDemoNumber };
}
