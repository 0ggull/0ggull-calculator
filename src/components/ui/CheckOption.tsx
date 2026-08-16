"use client";

interface CheckOptionProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function CheckOption({ id, label, description, checked, onChange, disabled }: CheckOptionProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-150 cursor-pointer
        ${checked
          ? "bg-brand-50 dark:bg-brand-950/30 border-brand-300 dark:border-brand-700"
          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
      />
      <div className="space-y-0.5">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
    </label>
  );
}
