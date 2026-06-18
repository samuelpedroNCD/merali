"use client";

import { Select } from "./input";

export type FilterOption = { value: string; label: string };

/** Compact inline list filter — a dropdown with an "all" placeholder. */
export function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: FilterOption[];
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[44px] w-auto min-w-[150px]"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </Select>
  );
}
