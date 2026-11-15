import type { ConfirmationOptions } from './confirmation';

type ConfirmationRequest = {
  ask: (options: ConfirmationOptions) => Promise<boolean>;
  resolve: (confirmed: boolean) => void;
  cancel: () => void;
  dispose: () => void;
};

/** Coordinate one confirmation at a time and reject consent when its underlying state changes. */
export function createConfirmationRequest<T>({ getSnapshot, onChange }: {
  getSnapshot: () => T;
  onChange: (options: ConfirmationOptions | null) => void;
}): ConfirmationRequest {
  let pending: ((confirmed: boolean) => void) | null = null;
  let disposed = false;

  /** Open one request and validate its snapshot again when the caller resumes after approval. */
  async function ask(options: ConfirmationOptions): Promise<boolean> {
    if (disposed || pending) return false;
    const snapshot = getSnapshot();
    const confirmed = await new Promise<boolean>(function openRequest(resolveRequest) {
      pending = resolveRequest;
      onChange(options);
    });
    return confirmed && !disposed && getSnapshot() === snapshot;
  }

  /** Clear the visible request before releasing its caller so a result cannot be consumed twice. */
  function resolve(confirmed: boolean): void {
    const finish = pending;
    if (!finish) return;
    pending = null;
    onChange(null);
    finish(confirmed);
  }

  /** Decline an outstanding action without changing the underlying library. */
  function cancel(): void { resolve(false); }

  /** Release a waiting caller on unmount without notifying an already removed view. */
  function dispose(): void {
    disposed = true;
    const finish = pending;
    pending = null;
    finish?.(false);
  }

  return { ask, resolve, cancel, dispose };
}
