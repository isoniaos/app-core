import type { IsoniaQueryState } from "../api/useIsoniaQuery";

interface AsyncContentProps<TData> {
  readonly state: IsoniaQueryState<TData>;
  readonly isEmpty?: (data: TData) => boolean;
  readonly children: (data: TData) => JSX.Element;
}

export function AsyncContent<TData>({
  state,
  isEmpty,
  children,
}: AsyncContentProps<TData>): JSX.Element {
  if (state.loading) {
    return <LoadingState />;
  }

  if (state.error) {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }

  if (state.data === undefined) {
    return <EmptyState />;
  }

  if (isEmpty?.(state.data)) {
    return <EmptyState />;
  }

  return children(state.data);
}

function LoadingState(): JSX.Element {
  return (
    <div className="state-panel" role="status">
      <span className="loading-bar" />
      <p>Loading data...</p>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  readonly error: Error;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <div className="state-panel state-panel-error">
      <p>{error.message}</p>
      <button className="button" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div className="state-panel">
      <p>No data found.</p>
    </div>
  );
}

