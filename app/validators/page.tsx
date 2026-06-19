"use client"

import { useState, useEffect } from "react"
import { 
  ShieldCheck, Globe, Zap, Cpu, Search, X, Copy, 
  CheckCircle2, ChevronRight, Activity, ArrowUpRight, Loader2 
} from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { fetchRpc } from "@/lib/rpc"
import { cn } from "@/lib/utils"

interface ValidatorData {
  address: string
  pubkey: string
  stake: number
  status: string
}

export default function ValidatorSetPage() {
  const [validators, setValidators] = useState<ValidatorData[]>([])
  const [networkStats, setNetworkStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Jailed" | "Inactive">("All")
  const [selectedValidator, setSelectedValidator] = useState<ValidatorData | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Fetch validators and network stats from RPC node
  useEffect(() => {
    const loadData = async () => {
      try {
        const [valRes, statsRes] = await Promise.all([
          fetchRpc("/network/validators"),
          fetchRpc("/network/stats"),
        ])

        if (valRes.ok) {
          const valData = await valRes.json()
          if (valData && Array.isArray(valData.validators)) {
            const parsed: ValidatorData[] = valData.validators.map((v: any) => ({
              address: v.address || "",
              pubkey: v.pubkey || "0x",
              stake: parseInt(v.stake || "0", 10),
              status: v.status || "Inactive",
            }))
            // Sort by stake descending
            parsed.sort((a, b) => b.stake - a.stake)
            setValidators(parsed)
          }
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setNetworkStats(statsData)
        }
      } catch (err) {
        console.error("Failed to fetch validator data from RPC node:", err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
    const timer = setInterval(loadData, 10000)
    return () => clearInterval(timer)
  }, [])

  // Calculate total active stake
  const totalActiveStake = validators
    .filter((v) => v.status === "Active")
    .reduce((sum, v) => sum + v.stake, 0)

  // Filter validators
  const filteredValidators = validators.filter((v) => {
    const matchesSearch =
      v.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.pubkey.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "All" || v.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatStake = (raw: number) => {
    // Stake is in smallest unit (like wei). Convert to LUM (18 decimals)
    const lum = raw / 1e18
    if (lum >= 1_000_000) return `${(lum / 1_000_000).toFixed(2)}M`
    if (lum >= 1_000) return `${(lum / 1_000).toFixed(2)}K`
    return lum.toFixed(2)
  }

  const formatStakeFull = (raw: number) => {
    const lum = raw / 1e18
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(lum)
  }

  const shortAddr = (addr: string) => {
    if (addr.length <= 20) return addr
    return `${addr.slice(0, 14)}...${addr.slice(-8)}`
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">
      <Navbar />

      {/* Hero Section */}
      <div className="animate-hero-bg relative pt-12 pb-16 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/3 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }} />

        <div className="max-w-[1400px] mx-auto px-4 relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">BFT Consensus Governance</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
            Validator <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Set</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto font-medium text-sm">
            Active consensus nodes validating states, proposing blocks, and securing the decentralized Lumina protocol network.
          </p>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-4 -mt-8 relative z-20 pb-20 space-y-6">
        
        {/* Global Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Validators", val: `${validators.filter(v => v.status === "Active").length}`, sub: `of ${validators.length} total registered`, icon: Cpu, color: "text-blue-500" },
            { label: "Total Staked", val: `${formatStake(totalActiveStake)} LUM`, sub: "Active bonded stake", icon: Activity, color: "text-emerald-500" },
            { label: "Block Height", val: networkStats?.total_height ?? "—", sub: "Latest confirmed block", icon: Zap, color: "text-amber-500" },
            { label: "Consensus Health", val: validators.filter(v => v.status === "Active").length >= 1 ? "Online" : "—", sub: `Chain: ${networkStats?.chain_id ?? "—"}`, icon: ShieldCheck, color: "text-purple-500" },
          ].map((m, i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <div className={cn("p-2 rounded-lg bg-slate-50 border border-slate-100", m.color)}>
                  <m.icon className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m.label}</span>
              </div>
              <div className="text-2xl font-black text-slate-900 tabular-nums">{m.val}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex gap-1.5 p-1 bg-slate-100 border border-slate-200/60 rounded-lg w-full md:w-auto overflow-x-auto">
            {(["All", "Active", "Jailed", "Inactive"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                  statusFilter === tab
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {tab} ({tab === "All" ? validators.length : validators.filter(v => v.status === tab).length})
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by address, pubkey..."
              className="w-full bg-slate-50 border border-slate-200 px-10 py-2 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white transition-all text-slate-700"
            />
          </div>
        </div>

        {/* Validator Registry Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-bold">Loading validators from RPC node...</span>
            </div>
          ) : validators.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <span className="text-sm font-bold">No validators registered on this node yet.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 w-12 text-center">#</th>
                    <th className="px-6 py-4">Validator Address</th>
                    <th className="px-6 py-4">BLS Public Key</th>
                    <th className="px-6 py-4">Staked Amount</th>
                    <th className="px-6 py-4">Voting Power</th>
                    <th className="px-6 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredValidators.map((node, i) => {
                    const votingPowerPct = totalActiveStake > 0 && node.stake > 0 
                      ? (node.stake / totalActiveStake) * 100 
                      : 0

                    return (
                      <tr 
                        key={node.address} 
                        onClick={() => setSelectedValidator(node)}
                        className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4 text-center font-bold text-slate-400 group-hover:text-slate-800">
                          {i + 1}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center border font-black text-xs text-white shrink-0",
                              node.status === "Active" ? "bg-gradient-to-tr from-teal-500 to-emerald-400 border-teal-400/20" :
                              node.status === "Jailed" ? "bg-gradient-to-tr from-red-500 to-orange-400 border-red-400/20" :
                              "bg-gradient-to-tr from-slate-400 to-slate-300 border-slate-200"
                            )}>
                              {node.address.slice(-2).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors block truncate font-mono text-[12px]">
                                {shortAddr(node.address)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[11px] text-slate-500 font-mono block truncate max-w-[180px]">
                            {node.pubkey === "0x" ? "—" : `${node.pubkey.slice(0, 16)}...`}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-900">{formatStake(node.stake)} LUM</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col w-32">
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-[10px] font-bold text-slate-500 font-mono">{votingPowerPct.toFixed(2)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/50">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  node.status === "Active" ? "bg-teal-500" : "bg-slate-300"
                                )} 
                                style={{ width: `${Math.min(100, Math.max(0, votingPowerPct))}%` }} 
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 text-[9px] font-black px-2.5 py-1 rounded-full uppercase border",
                            node.status === "Active" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            node.status === "Jailed" ? "bg-red-50 text-red-600 border-red-100" :
                            "bg-slate-100 text-slate-500 border-slate-200"
                          )}>
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              node.status === "Active" ? "bg-emerald-500 animate-pulse" :
                              node.status === "Jailed" ? "bg-red-500" : "bg-slate-400"
                            )} />
                            {node.status}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredValidators.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                        No validators found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Informational Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-8 border border-slate-200 space-y-4 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck className="w-32 h-32" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Slashing & Jailing</h4>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Security Guarantees</h3>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              If an active validator signs double blocks, signs conflicting votes, or stays offline for more than 50 blocks within a single epoch, they are automatically slashed (1% stake penalty) and jailed.
            </p>
            <button className="flex items-center gap-2 text-xs font-black text-teal-600 uppercase tracking-widest hover:gap-3 transition-all">
              Learn about consensus <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="bg-white rounded-xl p-8 border border-slate-200 space-y-4 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Globe className="w-32 h-32" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Delegation</h4>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Stake & Earn Rewards</h3>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              Delegate your LUM tokens to any active validator to earn staking rewards. The network distributes block rewards proportionally to all delegators based on their share of the total bonded stake.
            </p>
            <a href="/staking" className="flex items-center gap-2 text-xs font-black text-teal-600 uppercase tracking-widest hover:gap-3 transition-all">
              Go to staking <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </main>

      {/* Validator Detail Modal */}
      {selectedValidator && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            onClick={() => setSelectedValidator(null)}
            className="absolute inset-0 cursor-default" 
          />
          
          <div className="w-full max-w-lg bg-white h-full relative z-10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="bg-[#111827] text-white p-6 relative overflow-hidden shrink-0">
              <div className="absolute -right-12 -top-12 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl" />
              
              <div className="flex justify-between items-start relative z-10">
                <span className={cn(
                  "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                  selectedValidator.status === "Active" 
                    ? "bg-teal-950/40 border-teal-500/30 text-teal-400"
                    : selectedValidator.status === "Jailed"
                    ? "bg-red-950/40 border-red-500/30 text-red-400"
                    : "bg-slate-800 border-slate-600/30 text-slate-400"
                )}>
                  {selectedValidator.status} Validator
                </span>
                <button
                  onClick={() => setSelectedValidator(null)}
                  className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-xl font-black tracking-tight uppercase italic mt-4 font-mono break-all">
                {selectedValidator.address}
              </h3>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto grow space-y-6 custom-scrollbar">
              
              {/* Wallet Address */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Wallet Address</span>
                <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-[11px] font-bold text-slate-700">
                  <span className="break-all select-all pr-1">{selectedValidator.address}</span>
                  <button
                    onClick={() => handleCopy(selectedValidator.address)}
                    className="text-slate-400 hover:text-teal-600 transition-colors shrink-0"
                  >
                    {copiedId === selectedValidator.address ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* BLS Public Key */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">BLS Consensus Public Key</span>
                <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-[11px] font-bold text-slate-700">
                  <span className="break-all select-all pr-1">{selectedValidator.pubkey}</span>
                  <button
                    onClick={() => handleCopy(selectedValidator.pubkey)}
                    className="text-slate-400 hover:text-teal-600 transition-colors shrink-0"
                  >
                    {copiedId === selectedValidator.pubkey ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Staking Metrics */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Staking Info</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-200/50 p-3.5 rounded-xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Total Bonded Stake</span>
                    <span className="text-base font-black text-slate-800 tabular-nums">{formatStakeFull(selectedValidator.stake)} LUM</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/50 p-3.5 rounded-xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Voting Power</span>
                    <span className="text-base font-black text-slate-800 tabular-nums">
                      {totalActiveStake > 0 && selectedValidator.stake > 0 
                        ? ((selectedValidator.stake / totalActiveStake) * 100).toFixed(2) 
                        : "0.00"}%
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/50 p-3.5 rounded-xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Status</span>
                    <span className={cn(
                      "text-base font-black",
                      selectedValidator.status === "Active" ? "text-emerald-600" :
                      selectedValidator.status === "Jailed" ? "text-red-600" : "text-slate-500"
                    )}>
                      {selectedValidator.status}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/50 p-3.5 rounded-xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Chain</span>
                    <span className="text-base font-black text-slate-800">{networkStats?.chain_id ?? "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  selectedValidator.status === "Active" ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                )} />
                <span className="font-bold uppercase text-[9px] tracking-wider text-slate-400">Status: {selectedValidator.status}</span>
              </div>
              
              {selectedValidator.status === "Active" && (
                <a 
                  href="/staking"
                  className="inline-flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Delegate Staking <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
