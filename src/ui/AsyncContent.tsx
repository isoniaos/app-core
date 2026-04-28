import type { IsoniaQueryState } from "../api/useIsoniaQuery";

interface AsyncContentProps<TData> {
  readonly state: IsoniaQueryState<TData>;
  readonly isEmpty?: (data: TData) => boolean;
  readonly loadingTitle?: string;
  readonly loadingMessage?: string;
  readonly emptyTitle?: string;
  readonly emptyMessage?: string;
  readonly errorTitle?: string;
  readonly children: (data: TData) => JSX.Element;
}

export function AsyncContent<TData>({
  state,
  isEmpty,
  loadingTitle = "Loading data",
  loadingMessage = "Reading the latest indexed governance state.",
  emptyTitle = "No data found",
  emptyMessage = "The control plane returned an empty result for this view.",
  errorTitle = "Unable to load data",
  children,
}: AsyncContentProps<TData>): JSX.Element {
  if (state.loading) {
    return <LoadingState title={loadingTitle} message={loadingMessage} />;
  }

  if (state.error) {
    return (
      <ErrorState
        error={state.error}
        onRetry={state.reload}
        title={errorTitle}
      />
    );
  }

  if (state.data === undefined) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  if (isEmpty?.(state.data)) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return children(state.data);
}

function LoadingState({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}): JSX.Element {
  return (
    <div className="state-panel" role="status">
      <span className="loading-bar" />
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
  title,
}: {
  readonly error: Error;
  readonly onRetry: () => void;
  readonly title: string;
}): JSX.Element {
  return (
    <div className="state-panel state-panel-error">
      <strong>{title}</strong>
      <p>{error.message}</p>
      <button className="button" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function EmptyState({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}): JSX.Element {
  return (
    <div className="state-panel">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
