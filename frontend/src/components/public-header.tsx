"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun } from "lucide-react";

/** Nav items matching cip-public-pages.html exactly */
const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Pricing", href: "/pricing" },
  { label: "Documentation", href: "/docs" },
  { label: "Blog", href: "/blog" },
  { label: "Apply", href: "/apply" },
] as const;

export function PublicHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
    if (typeof localStorage !== "undefined") localStorage.setItem("cip-theme", next);
  };

  return (
    <header
      className={`fixed top-[2px] left-0 right-0 z-[55] backdrop-blur-[20px] backdrop-saturate-[1.4] border-b border-border/50 transition-all bg-background/90 dark:bg-[rgba(8,11,16,0.88)] ${
        scrolled
          ? "shadow-[0_4px_30px_rgba(0,80,40,0.06)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.15)]"
          : ""
      }`}
    >
      <div className="max-w-[1100px] mx-auto flex h-[54px] items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-[1.1rem] font-extrabold tracking-tight text-foreground"
        >
          {/* Logo: green outline + star — matches HTML .nav-logo .cm */}
          <span className="cip-logo-icon inline-flex w-[14px] h-[14px] rounded-full border-2 border-[#00a651] border-r-transparent border-b-transparent -rotate-45 relative">
            <span className="absolute -top-1 -right-1.5 text-[6px] text-[#00a651] rotate-45">
              ★
            </span>
          </span>
          CIP
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ label, href }) => {
            const active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`hidden sm:inline-flex px-2.5 py-1.5 text-[0.76rem] font-medium rounded-md transition-all ${
                  active
                    ? "text-foreground dark:text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <span className="hidden sm:block w-px h-4 bg-border mx-0.5" />
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-md border border-border/60 bg-transparent text-muted-foreground hover:text-foreground hover:border-border flex items-center justify-center transition-all"
            title="Toggle theme"
          >
            {resolvedTheme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
          <Link
            href="/login"
            className="ml-0.5 px-[14px] py-[6px] rounded-md bg-primary text-white text-[0.76rem] font-semibold transition-all hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(0,166,81,0.15)] inline-flex items-center gap-1.5"
          >
            Sign in <span aria-hidden>→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
