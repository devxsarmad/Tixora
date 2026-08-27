type InviteRowProps = {
  email: string;
  onSelect: () => void;
};

export function InviteRow({ email, onSelect }: InviteRowProps) {
  return (
    <button type="button" className="search-result invite-result" onClick={onSelect}>
      <span className="avatar invite-avatar">@</span>
      <span>
        <strong>Send invite to {email}</strong>
        <small>Add as invited until they accept.</small>
      </span>
    </button>
  );
}
