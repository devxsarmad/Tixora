type UserSearchInputProps = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

export function UserSearchInput({ label, value, placeholder, onChange }: UserSearchInputProps) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-text-secondary">
      {label}
      <input
        className="min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
