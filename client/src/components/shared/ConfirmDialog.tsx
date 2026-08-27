type ConfirmDialogProps = {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ title, body, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="danger-button" onClick={onConfirm}>Confirm</button>
        </div>
      </section>
    </div>
  );
}
