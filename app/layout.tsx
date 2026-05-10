import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guess The Party RO",
  description: "Guess the Romanian politician's party from their portrait."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  const mode = localStorage.getItem("gtp-ro-theme") || "auto";
  const dark = mode === "dark" || (mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = mode;
} catch {}
`
          }}
        />
        {children}
      </body>
    </html>
  );
}
