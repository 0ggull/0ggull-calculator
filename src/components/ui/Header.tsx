"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
}

export default function Header({ title, showBack = false }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800/50">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          {showBack && (
            <Link href="/" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
          <Link href="/" className="font-bold text-lg tracking-tight">
            0<span className="text-brand-500">GGULL</span>
          </Link>
          {title && (
            <>
              <span className="text-gray-300 dark:text-gray-700">/</span>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</span>
            </>
          )}
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
