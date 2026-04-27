import { useCallback, useEffect, useState } from "react";

export interface IsoniaQueryState<TData> {
  readonly data: TData | undefined;
  readonly error: Error | undefined;
  readonly loading: boolean;
  readonly reload: () => void;
}

export function useIsoniaQuery<TData>(
  load: () => Promise<TData>,
  dependencies: readonly unknown[],
): IsoniaQueryState<TData> {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);

    load()
      .then((nextData) => {
        if (!active) {
          return;
        }
        setData(nextData);
      })
      .catch((nextError: unknown) => {
        if (!active) {
          return;
        }
        setError(toError(nextError));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [...dependencies, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  return { data, error, loading, reload };
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error("Unknown API error.");
}

