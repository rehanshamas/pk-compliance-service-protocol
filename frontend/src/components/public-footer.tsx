import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="bg-[#15803d] dark:bg-[#01411c] mt-auto transition-colors">
      <div className="max-w-[1100px] mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2.5">
          <Link
            href="/"
            className="font-extrabold text-[1.1rem] tracking-tight text-white flex items-center gap-2"
          >
            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/80 border-r-transparent border-b-transparent -rotate-45 relative">
              <span className="absolute -top-1 -right-1.5 text-[6px] text-white/90 rotate-45">★</span>
            </span>
            CIP
          </Link>
          <p className="text-[0.72rem] text-white/70 leading-relaxed max-w-[280px]">
            Compliance infrastructure for VASPs in Pakistan. KYC, screening, analytics, and regulatory reporting under the Virtual Assets Act 2026.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="text-[0.68rem] font-semibold uppercase tracking-wider text-white/60 mb-2.5">
              Legal
            </h4>
            <div className="flex flex-wrap gap-2 md:gap-5">
              <a href="#" className="text-[0.78rem] text-white/90 hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-[0.78rem] text-white/90 hover:text-white transition-colors">
                Terms of Service
              </a>
              <a href="#" className="text-[0.78rem] text-white/90 hover:text-white transition-colors">
                AML Policy
              </a>
            </div>
          </div>
          <div>
            <h4 className="text-[0.68rem] font-semibold uppercase tracking-wider text-white/60 mb-2.5">
              Contact
            </h4>
            <div className="flex flex-wrap gap-2 md:gap-5">
              <Link href="/" className="text-[0.78rem] text-white/90 hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/docs/contact" className="text-[0.78rem] text-white/90 hover:text-white transition-colors">
                Contact us
              </Link>
              <a href="mailto:support@cip.pk" className="text-[0.78rem] text-white/90 hover:text-white transition-colors">
                support@cip.pk
              </a>
            </div>
          </div>
        </div>
      </div>
      <hr className="border-0 h-px bg-black/10 dark:bg-black/15 my-0" />
      <div className="py-3 text-center">
        <p className="text-[0.68rem] text-white/60">
          © {new Date().getFullYear()} CIP — Compliance Infrastructure Platform. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
