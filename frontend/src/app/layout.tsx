import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "@/styles/globals.css";

/** Fonts loaded via Google link to match cip-public-pages.html exactly (incl. opsz axis) */

export const metadata: Metadata = {
  title: "CIP — Compliance Infrastructure Platform",
  description: "Multi-tenant RegTech platform for VASPs under Pakistan Virtual Assets Act 2026",
};

const themeScript = `
(function() {
  try {
    const t = localStorage.getItem('cip-theme');
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = t === 'dark' || (t !== 'light' && sys);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
  } catch (_) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
