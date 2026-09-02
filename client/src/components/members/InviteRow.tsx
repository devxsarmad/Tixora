import { MailPlus } from 'lucide-react';

type InviteRowProps = {
  email: string;
  onSelect: () => void;
};

export function InviteRow({ email, onSelect }: InviteRowProps) {
  return (
    <button
      type="button"
      className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-card border border-dashed border-accent bg-accent-soft p-3 text-left transition-colors hover:bg-surface"
      onClick={onSelect}
    >
      <span className="grid h-9 w-9 place-items-center rounded-[7px] bg-surface text-accent"><MailPlus aria-hidden="true" /></span>
      <span>
        <strong className="block text-sm font-bold text-text-primary">Send invite to {email}</strong>
        <small className="block text-xs font-semibold text-text-muted">Add as invited until they accept.</small>
      </span>
    </button>
  );
}
