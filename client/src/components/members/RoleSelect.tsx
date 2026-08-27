type RoleSelectProps<T extends string> = {
  value: T;
  options: T[];
  onChange: (value: T) => void;
};

export function RoleSelect<T extends string>({ value, options, onChange }: RoleSelectProps<T>) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as T)}>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}
