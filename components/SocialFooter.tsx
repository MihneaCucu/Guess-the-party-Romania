import clsx from "clsx";

export function SocialFooter({ className }: { className?: string }) {
  return (
    <footer className={clsx("mt-12 flex flex-wrap items-center justify-center gap-3 pb-8 text-slate-400", className)}>
      <a
        aria-label="Mihnea Cucu on X"
        className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-950"
        href="https://x.com/MihneaCucu"
        rel="noreferrer"
        target="_blank"
      >
        <svg aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.9 2h3.7l-8.1 9.3L24 22h-7.4l-5.8-6.9L4.2 22H.5l8.7-10L0 2h7.6l5.2 6.2L18.9 2Zm-1.3 18.1h2L6.5 3.8H4.3l13.3 16.3Z" />
        </svg>
      </a>
      <a
        aria-label="Mihnea Cucu on GitHub"
        className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-950"
        href="https://github.com/MihneaCucu"
        rel="noreferrer"
        target="_blank"
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 .5A11.5 11.5 0 0 0 8.4 22.9c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 .1.6 2.7 4 .9.1-.8.4-1.4.7-1.7-2.6-.3-5.4-1.3-5.4-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.8 5.4-5.4 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
        </svg>
      </a>
    </footer>
  );
}
