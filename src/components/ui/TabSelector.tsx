"use client";

interface Tab {
  key: string;
  label: string;
  emoji?: string;
  subtitle?: string;
}

interface TabSelectorProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export default function TabSelector({ tabs, active, onChange }: TabSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border
            ${
              active === tab.key
                ? "bg-brand-50 dark:bg-brand-950 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 shadow-sm"
                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
            }`}
        >
          {tab.emoji && <span className="mr-1.5">{tab.emoji}</span>}
          <span>{tab.label}</span>
          {tab.subtitle && (
            <span className="block text-[10px] text-gray-400 mt-0.5">{tab.subtitle}</span>
          )}
        </button>
      ))}
    </div>
  );
}
