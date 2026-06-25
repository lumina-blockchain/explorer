"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import {
  Zap, ChevronDown, Box, Activity, Wallet, Layers,
  ShieldCheck, Users, BookOpen, Code2, FileText,
  BarChart2, Cpu, Globe, Menu, X
} from "lucide-react"

const NAV_ITEMS = [
  {
    label: "Blockchain",
    items: [
      { icon: Box, label: "Blocks", href: "/blocks", desc: "Browse all confirmed blocks" },
      { icon: Activity, label: "Transactions", href: "/txs", desc: "View latest transactions" },
      { icon: BarChart2, label: "Latency Stats", href: "/stats", desc: "Real-time P2P latency & consensus charts" },
      { icon: Wallet, label: "Top Accounts", href: "/accounts", desc: "Richest addresses on-chain" },
      { icon: Layers, label: "Pending Txs", href: "/txs/pending", desc: "Mempool & pending queue" },
    ]
  },
  {
    label: "Validators",
    items: [
      { icon: ShieldCheck, label: "Validator Set", href: "/validators", desc: "Active consensus nodes" },
      { icon: Users, label: "Staking", href: "/staking", desc: "Staking overview & rewards" },
      { icon: BarChart2, label: "Leaderboard", href: "/validators/leaderboard", desc: "Top validators by reward" },
      { icon: Globe, label: "Network Topology", href: "/validators/topology", desc: "Visual P2P network map" },
    ]
  },
  {
    label: "Resources",
    items: [
      { icon: BookOpen, label: "Documentation", href: "/docs", desc: "Developer guides" },
      { icon: FileText, label: "Articles", href: "/article/index.html", desc: "System & engineering articles" },
      { icon: Code2, label: "RPC API", href: "/api", desc: "Public JSON-RPC endpoints" },
      { icon: FileText, label: "Whitepaper", href: "/whitepaper", desc: "BigChain protocol paper" },
      { icon: Cpu, label: "Node Status", href: "/nodes", desc: "Network node health" },
      { icon: Wallet, label: "Download Wallet", href: "/bigchain-wallet.zip", desc: "Chrome Extension (Desktop)" },
    ]
  },
]

export default function Navbar() {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "BigChain-Mainnet"
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = (label: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpenMenu(label)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpenMenu(null), 150)
  }

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  return (
    <nav className="bg-[#111827] sticky top-0 z-50 border-b border-white/5">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 bg-teal-500/10 rounded flex items-center justify-center border border-teal-500/20 group-hover:bg-teal-500/20 transition-all">
              <Zap className="w-5 h-5 text-teal-400 fill-teal-400" />
            </div>
            <span className="text-sm font-black tracking-tighter text-white uppercase italic">
              BIGCHAIN<span className="text-teal-400">SCAN</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            {/* Home */}
            <Link
              href="/"
              className="px-3 py-2 text-[11px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors rounded hover:bg-white/5"
            >
              Dashboard
            </Link>

            {/* Dropdown menus */}
            {NAV_ITEMS.map((nav) => (
              <div
                key={nav.label}
                className="relative"
                onMouseEnter={() => handleMouseEnter(nav.label)}
                onMouseLeave={handleMouseLeave}
              >
                <button className={`flex items-center gap-1 px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors rounded hover:bg-white/5 ${openMenu === nav.label ? "text-white bg-white/5" : "text-slate-400 hover:text-white"}`}>
                  {nav.label}
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${openMenu === nav.label ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown panel */}
                {openMenu === nav.label && (
                  <div
                    className="absolute top-full left-0 mt-1 w-64 bg-[#1a2235] border border-white/10 rounded-lg shadow-2xl shadow-black/40 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                    onMouseEnter={() => handleMouseEnter(nav.label)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="p-1">
                      {nav.items.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={() => setOpenMenu(null)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 transition-colors group"
                        >
                          <div className="w-7 h-7 rounded bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0 group-hover:bg-teal-500/20 transition-all">
                            <item.icon className="w-3.5 h-3.5 text-teal-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[12px] font-bold text-white">{item.label}</div>
                            <div className="text-[10px] text-slate-500 truncate">{item.desc}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Network status + Mobile toggle */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Network</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">{chainId}</span>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#111827] border-t border-white/5 px-4 py-4 space-y-4">
          <Link href="/" onClick={() => setMobileOpen(false)} className="block text-[12px] font-bold text-slate-300 hover:text-white uppercase tracking-widest py-2">
            Dashboard
          </Link>
          {NAV_ITEMS.map((nav) => (
            <div key={nav.label}>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{nav.label}</div>
              <div className="space-y-1 pl-2">
                {nav.items.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 py-2 text-[12px] font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    <item.icon className="w-4 h-4 text-teal-400" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </nav>
  )
}
