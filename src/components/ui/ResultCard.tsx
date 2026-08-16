"use client";

import { ReactNode } from "react";

interface ResultCardProps {
  icon?: ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  accent?: "blue" | "green" | "red" | "purple" | "amber";
}

const accentColors = {
  blue: "text-brand-600 dark:text-brand-400",
  green: "text-emerald-600 dark:text-emerald-400",
  red: "text-rose-600 dark:text-rose-400",
  purple: "text-purple-600 dark:text-purple-400",
  amber: "text-amber-600 dark:text-amber-400",
};

export default function ResultCard({ icon, label, value, sublabel, accent = "blue" }: ResultCardProps) {
  return (
    <div className="card p-5 space-y-2 animate-slide-up">
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="label">{label}</span>
      </div>
      <p className={`text-2xl md:text-3xl font-bold tabular-nums ${accentColors[accent]}`}>
        {value}
      </p>
      {sublabel && <p className="text-xs text-gray-500 dark:text-gray-400">{sublabel}</p>}
    </div>
  );
}
