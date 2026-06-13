"use client";

import { useEffect } from "react";
import { useTheme } from "@/components/theme-provider";

/** Floating particles — home page only, theme-aware colors */
export function Particles() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const container = document.getElementById("particles");
    if (!container) return;

    const darkColors = [
      "rgba(0,166,81,.4)",
      "rgba(0,166,81,.25)",
      "rgba(59,130,246,.2)",
      "rgba(255,255,255,.12)",
    ];
    const lightColors = [
      "rgba(0,166,81,.5)",
      "rgba(21,128,61,.45)",
      "rgba(0,166,81,.4)",
      "rgba(15,80,40,.35)",
    ];
    const colors = resolvedTheme === "light" ? lightColors : darkColors;

    function spawn() {
      const el = document.getElementById("particles");
      if (!el) return;
      const p = document.createElement("div");
      p.className = "particle";
      const size = 4 + Math.random() * 6;
      const x = Math.random() * 100;
      const dur = 8 + Math.random() * 10;
      const color = colors[Math.floor(Math.random() * colors.length)];
      p.style.cssText = `left:${x}%;width:${size}px;height:${size}px;background:${color};animation-duration:${dur}s;animation-delay:${Math.random() * 5}s`;
      el.appendChild(p);
      setTimeout(() => p.remove(), (dur + 5) * 1000);
    }

    for (let i = 0; i < 12; i++) spawn();
    const id = setInterval(spawn, 3000);
    return () => clearInterval(id);
  }, [resolvedTheme]);

  return <div id="particles" className="particles" aria-hidden />;
}
