"use client"

import Link from "next/link"
import { Zap, Globe, ExternalLink } from "lucide-react"

const FOOTER_LINKS = [
  {
    title: "Explorer",
    links: [
      { label: "Latest Blocks", href: "/blocks" },
      { label: "Transactions", href: "/txs" },
      { label: "Top Accounts", href: "/accounts" },
      { label: "Pending Txns", href: "/txs/pending" },
    ]
  },
  {
    title: "Validators",
    links: [
      { label: "Validator Set", href: "/validators" },
      { label: "Staking Overview", href: "/staking" },
      { label: "Leaderboard", href: "/validators/leaderboard" },
      { label: "Node Status", href: "/nodes" },
    ]
  },
  {
    title: "Developers",
    links: [
      { label: "RPC Endpoints", href: "/api" },
      { label: "Documentation", href: "https://docs.lumina.network" },
      { label: "Whitepaper", href: "/whitepaper" },
      { label: "GitHub", href: "https://github.com/lumina" },
    ]
  },
]

export default function Footer() {
  const year = new Date().getFullYear()
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "Lumina-Mainnet"

  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      {/* Main footer grid */}
      <div className="max-w-[1400px] mx-auto px-4 pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">

          {/* Brand col — spans 2 */}
          <div className="md:col-span-2 space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-teal-500/10 rounded flex items-center justify-center border border-teal-500/20">
                <Zap className="w-5 h-5 text-teal-500 fill-teal-500" />
              </div>
              <span className="text-sm font-black tracking-tighter text-slate-900 uppercase italic">
                LUMINA<span className="text-teal-500">SCAN</span>
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-slate-400 font-medium max-w-xs">
              LuminaScan is the leading search and analytics platform for the Lumina blockchain — a high-performance Layer-1 network built for the future of decentralized finance.
            </p>

            {/* Live network badge */}
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">{chainId}</span>
            </div>

            {/* Social icons */}
            <div className="flex items-center gap-3 pt-1">
              {/* GitHub */}
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub"
                className="w-8 h-8 rounded border border-slate-200 bg-slate-50 flex items-center justify-center hover:bg-teal-50 hover:border-teal-200 transition-all text-slate-400 hover:text-teal-600">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              </a>
              {/* X (Twitter) */}
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="X / Twitter"
                className="w-8 h-8 rounded border border-slate-200 bg-slate-50 flex items-center justify-center hover:bg-teal-50 hover:border-teal-200 transition-all text-slate-400 hover:text-teal-600">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              {/* Website */}
              <a href="https://lumina.network" target="_blank" rel="noopener noreferrer" aria-label="Website"
                className="w-8 h-8 rounded border border-slate-200 bg-slate-50 flex items-center justify-center hover:bg-teal-50 hover:border-teal-200 transition-all text-slate-400 hover:text-teal-600">
                <Globe className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map((col) => (
            <div key={col.title} className="space-y-4">
              <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-[0.18em]">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[12px] font-medium text-slate-500 hover:text-teal-600 transition-colors flex items-center gap-1 group"
                    >
                      {link.label}
                      {link.href.startsWith("http") && (
                        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-100 bg-slate-50/50">
        <div className="max-w-[1400px] mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-[11px] text-slate-400 font-medium">
            © {year} LuminaScan Explorer. All rights reserved.
          </span>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <Link href="/privacy" className="hover:text-teal-600 transition-colors font-medium">Privacy Policy</Link>
            <span className="text-slate-200">·</span>
            <Link href="/terms" className="hover:text-teal-600 transition-colors font-medium">Terms of Use</Link>
            <span className="text-slate-200">·</span>
            <span className="font-mono text-slate-300">v1.0.4</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
