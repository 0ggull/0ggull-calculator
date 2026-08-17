"use client";

import { useState } from "react";

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

export default function NumberInput({
  label,
  value,
  onChange,
  unit = "만원",
  min,
  max,
  step = 1,
  hint,
}: NumberInputProps) {
  const [focused, setFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(String(value));

  const handleFocus = () => {
    setFocused(true);
    setDisplayValue(value === 0 ? "" : String(value));
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseFloat(displayValue) || 0;
    setDisplayValue(String(parsed));
    onChange(parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    const parsed = parseFloat(raw) || 0;
    onChange(parsed);
  };

  // Sync external value changes (e.g. preset change)
  const shown = focused ? displayValue : String(value);

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={shown}
          min={min}
          max={max}
          step={step}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className="input-field pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
          {unit}
        </span>
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
