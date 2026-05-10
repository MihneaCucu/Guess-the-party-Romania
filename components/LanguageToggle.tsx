"use client";

import { useEffect, useState } from "react";
import { isLanguage, LANGUAGE_STORAGE_KEY, type Language } from "@/lib/i18n";

type LanguageToggleProps = {
  onChange?: (language: Language) => void;
};

function readLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isLanguage(stored) ? stored : "en";
}

export function useLanguage(): Language {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    setLanguage(readLanguage());

    function handleLanguageChange(event: Event) {
      const detail = (event as CustomEvent<Language>).detail;
      setLanguage(isLanguage(detail) ? detail : readLanguage());
    }

    window.addEventListener("gtp-language-change", handleLanguageChange);
    window.addEventListener("storage", handleLanguageChange);
    return () => {
      window.removeEventListener("gtp-language-change", handleLanguageChange);
      window.removeEventListener("storage", handleLanguageChange);
    };
  }, []);

  return language;
}

export function LanguageToggle({ onChange }: LanguageToggleProps) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const nextLanguage = readLanguage();
    setLanguage(nextLanguage);
    onChange?.(nextLanguage);
  }, [onChange]);

  function toggleLanguage() {
    const nextLanguage: Language = language === "en" ? "ro" : "en";
    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    window.dispatchEvent(new CustomEvent("gtp-language-change", { detail: nextLanguage }));
    onChange?.(nextLanguage);
  }

  return (
    <button
      aria-label={`Language: ${language.toUpperCase()}`}
      className="language-toggle focus-ring flex h-[24px] min-w-[32px] shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-[10px] font-black uppercase text-slate-600 shadow-sm transition hover:bg-slate-50"
      onClick={toggleLanguage}
      title={`Language: ${language.toUpperCase()}`}
      type="button"
    >
      {language.toUpperCase()}
    </button>
  );
}
