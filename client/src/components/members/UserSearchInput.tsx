type UserSearchInputProps = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

export function UserSearchInput({ label, value, placeholder, onChange }: UserSearchInputProps) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}
