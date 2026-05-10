"use client";

import { useEffect, useState } from "react";

type ThemeMode = "auto" | "light" | "dark";

const STORAGE_KEY = "gtp-ro-theme";
const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  auto: "light",
  light: "dark",
  dark: "auto"
};

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}

function applyTheme(mode: ThemeMode) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedDark = mode === "dark" || (mode === "auto" && systemDark);
  document.documentElement.classList.toggle("dark", resolvedDark);
  document.documentElement.dataset.theme = mode;
}

function Icon({ mode }: { mode: ThemeMode }) {
  if (mode === "dark") {
    return (
      <svg aria-hidden="true" className="h-[14px] w-[14px]" fill="none" viewBox="0 0 24 24">
        <path d="M20 15.3A8 8 0 0 1 8.7 4a8.7 8.7 0 1 0 11.3 11.3Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" />
      </svg>
    );
  }

  if (mode === "light") {
    return (
      <svg aria-hidden="true" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24">
        <path d="M12 4V2m0 20v-2M4 12H2m20 0h-2m-3.6-6.4 1.4-1.4M6.2 17.8l1.4-1.4m0-8.8L6.2 6.2m11.6 11.6-1.4-1.4" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
        <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2.2" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24">
      <rect height="12" rx="2.2" stroke="currentColor" strokeWidth="2.1" width="18" x="3" y="4" />
      <path d="M9 20h6M12 16v4" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1" />
    </svg>
  );
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const nextMode = isThemeMode(stored) ? stored : "auto";
    setMode(nextMode);
    applyTheme(nextMode);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if ((window.localStorage.getItem(STORAGE_KEY) ?? "auto") === "auto") {
        applyTheme("auto");
      }
    };
    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, []);

  function cycleMode() {
    const nextMode = NEXT_MODE[mode];
    setMode(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    applyTheme(nextMode);
  }

  return (
    <button
      aria-label={`Theme: ${mode}`}
      className="theme-toggle focus-ring flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
      onClick={cycleMode}
      title={`Theme: ${mode}`}
      type="button"
    >
      <Icon mode={mode} />
    </button>
  );
}
