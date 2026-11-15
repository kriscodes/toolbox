import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react';

export type ConfirmationOptions = {
  kicker: string;
  title: string;
  description: string;
  recordName: string;
  recordMeta: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
};

/** Draw the small document and action marks used by the confirmation dialog. */
function ConfirmationIcon({ kind }: { kind: 'document' | 'edit' | 'delete' | 'close' }): ReactNode {
  const paths = {
    document: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6',
    edit: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4M14 2v6h6M14 2l6 6M16 14l2-2 3 3-2 2-5 5h-3v-3z',
    delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    close: 'M6 6l12 12M18 6L6 18',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[kind]} /></svg>;
}

/** Ask for an explicit choice while keeping keyboard focus and cancellation inside the native modal. */
export function ConfirmationDialog({ options, onResolve }: {
  options: ConfirmationOptions;
  onResolve: (confirmed: boolean) => void;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const safeAction = useRef<HTMLButtonElement>(null);
  const resolved = useRef(false);
  const id = useId();

  /** Open above any existing editor dialog and restore its focused control when this dialog leaves. */
  function openConfirmation(): () => void {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resolved.current = false;
    element?.showModal();
    safeAction.current?.focus({ preventScroll: true });
    /** Close the top-layer entry before restoring focus, including React effect cleanup. */
    function closeConfirmation(): void {
      resolved.current = true;
      if (element?.open) element.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
    return closeConfirmation;
  }
  useEffect(openConfirmation, []);

  /** Resolve at most once so repeated clicks cannot repeat a destructive action. */
  function finish(confirmed: boolean): void {
    if (resolved.current) return;
    resolved.current = true;
    dialog.current?.close();
    onResolve(confirmed);
  }
  /** Keep the current work when the user chooses the safe action or the close control. */
  function cancel(): void { finish(false); }
  /** Continue only after the user explicitly activates the named action. */
  function confirm(): void { finish(true); }
  /** Treat Escape as cancellation without allowing the browser to bypass the controlled result. */
  function cancelFromKeyboard(event: SyntheticEvent<HTMLDialogElement>): void { event.preventDefault(); cancel(); }

  const cancelButton = <button ref={safeAction} autoFocus type="button" className={`pb-confirm-action ${options.destructive ? 'pb-confirm-secondary' : 'pb-confirm-primary'}`} onClick={cancel}>{options.cancelLabel}</button>;
  const confirmButton = <button type="button" className={`pb-confirm-action ${options.destructive ? 'pb-confirm-delete' : 'pb-confirm-secondary'}`} onClick={confirm}>{options.confirmLabel}</button>;

  return <dialog ref={dialog} className="pb-confirm" role="alertdialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} data-destructive={options.destructive || undefined} onCancel={cancelFromKeyboard}>
    <div className="pb-confirm-top">
      <span className="pb-confirm-kicker"><ConfirmationIcon kind={options.destructive ? 'delete' : 'edit'} /><span>{options.kicker}</span></span>
      <button className="pb-confirm-close" type="button" aria-label="Close confirmation" onClick={cancel}><ConfirmationIcon kind="close" /></button>
    </div>
    <div className="pb-confirm-copy"><h2 id={`${id}-title`}>{options.title}</h2><p id={`${id}-description`}>{options.description}</p></div>
    <div className="pb-confirm-record"><span className="pb-confirm-record-icon"><ConfirmationIcon kind="document" /></span><div><span className="pb-confirm-record-name">{options.recordName}</span><span className="pb-confirm-record-meta">{options.recordMeta}</span></div></div>
    <div className="pb-confirm-actions">{options.destructive ? <>{cancelButton}{confirmButton}</> : <>{confirmButton}{cancelButton}</>}</div>
  </dialog>;
}
