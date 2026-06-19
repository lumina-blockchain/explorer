"use client"

import { useState, useEffect } from "react"
import { 
  Trophy, Award, Zap, ShieldCheck, Play, Pause,
  ChevronUp, ChevronDown, Activity, Cpu, Loader2
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

interface LeaderboardEntry {
  rank: number
  address: string
  pubkey: string
  stake: number
  status: string
}

export default function LeaderboardPage() {
  const [validators, setValidators] = useState<LeaderboardEntry[]>([])
  const [networkStats, setNetworkStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<"rank" | "stake">("rank")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  
  // Block proposal simulation
  const [simBlocks, setSimBlocks] = useState<any[]>([])
  const [isSimPlaying, setIsSimPlaying] = useState(true)

  // Fetch data from RPC node
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
            const parsed: LeaderboardEntry[] = valData.validators
              .map((v: any) => ({
                address: v.address || "",
                pubkey: v.pubkey || "0x",
                stake: parseInt(v.stake || "0", 10),
                status: v.status || "Inactive",
              }))
              .sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.stake - a.stake)
              .map((v: LeaderboardEntry, i: number) => ({ ...v, rank: i + 1 }))
            setValidators(parsed)
          }
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setNetworkStats(statsData)
        }
      } catch (err) {
        console.error("Failed to fetch data from RPC node:", err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
    const timer = setInterval(loadData, 15000)
    return () => clearInterval(timer)
  }, [])

  // Block proposal simulation using real validator addresses
  useEffect(() => {
    if (!isSimPlaying || validators.length === 0) return

    const activeValidators = validators.filter(v => v.status === "Active")
    if (activeValidators.length === 0) return

    const baseHeight = networkStats?.total_height || 10000
    
    // Seed initial blocks
    const initial: any[] = []
    for (let i = 0; i < 8; i++) {
      const proposer = activeValidators[Math.floor(Math.random() * activeValidators.length)]
      initial.push({
        height: baseHeight - (8 - i),
        proposer: proposer.address,
        latency: `${Math.floor(Math.random() * 40) + 10}ms`,
        timestamp: Date.now() - (8 - i) * 6000
      })
    }
    setSimBlocks(initial)

    let currentH = baseHeight
    const interval = setInterval(() => {
      const proposer = activeValidators[Math.floor(Math.random() * activeValidators.length)]
      currentH++
      const newBlock = {
        height: currentH,
        proposer: proposer.address,
        latency: `${Math.floor(Math.random() * 40) + 10}ms`,
        timestamp: Date.now()
      }
      setSimBlocks(prev => [newBlock, ...prev.slice(0, 14)])
    }, 6000)

    return () => clearInterval(interval)
  }, [isSimPlaying, validators, networkStats])

  // Sorting handler
  const handleSort = (field: "rank" | "stake") => {
    const isAsc = sortField === field && sortOrder === "asc"
    const newOrder = isAsc ? "desc" : "asc"
    setSortField(field)
    setSortOrder(newOrder)
    
    setValidators(prev => {
      const sorted = [...prev].sort((a, b) => {
        const valA = a[field]
        const valB = b[field]
        return newOrder === "asc" ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1)
      })
      return sorted
    })
  }

  const formatStake = (raw: number) => {
    const lum = raw / 1e18
    if (lum >= 1_000_000) return `${(lum / 1_000_000).toFixed(2)}M`
    if (lum >= 1_000) return `${(lum / 1_000).toFixed(2)}K`
    return lum.toFixed(2)
  }

  const shortAddr = (addr: string) => {
    if (addr.length <= 20) return addr
    return `${addr.slice(0, 12)}...${addr.slice(-6)}`
  }

  const totalStake = validators
    .filter(v => v.status === "Active")
    .reduce((sum, v) => sum + v.stake, 0)

  // Podium entries (top 3 by original rank/stake)
  const sortedByStake = [...validators].sort((a, b) => b.stake - a.stake)
  const top1 = sortedByStake[0]
  const top2 = sortedByStake[1]
  const top3 = sortedByStake[2]

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">
      <Navbar />

      {/* Hero Header */}
      <div className="animate-hero-bg relative pt-12 pb-16 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(#eab308 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute -top-12 left-1/4 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2.5s' }} />

        <div className="max-w-[1400px] mx-auto px-4 relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-md">
            <Trophy className="w-4 h-4 text-yellow-400 animate-bounce" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Consensus Performance Rankings</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
            Performance <span className="bg-gradient-to-r from-yellow-400 to-teal-400 bg-clip-text text-transparent">Leaderboard</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto font-medium text-sm">
            Top performing consensus nodes ranked by bonded stake from the live RPC node data.
          </p>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-4 -mt-8 relative z-20 pb-20 space-y-8">

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-bold">Loading leaderboard from RPC node...</span>
          </div>
        ) : validators.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center py-20 text-slate-400">
            <span className="text-sm font-bold">No validators registered on this node yet.</span>
          </div>
        ) : (
          <>
            {/* Elite Top 3 Podium */}
            {sortedByStake.length >= 3 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {/* Rank 2 (Silver) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 md:order-1 order-2 transform hover:-translate-y-1 transition-transform">
                  <div className="flex justify-between items-start">
                    <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200">2nd</span>
                    <Award className="w-8 h-8 text-slate-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Silver</h4>
                    <h3 className="text-[12px] font-black text-slate-900 font-mono break-all">{top2.address}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs font-bold text-slate-700">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Staked</span>
                      <span>{formatStake(top2.stake)} LUM</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Status</span>
                      <span className="text-emerald-600">{top2.status}</span>
                    </div>
                  </div>
                </div>

                {/* Rank 1 (Gold) */}
                <div className="bg-[#111827] text-white rounded-2xl border border-yellow-400/20 shadow-xl p-8 space-y-4 md:order-2 order-1 md:h-80 flex flex-col justify-between transform hover:-translate-y-2 transition-transform relative overflow-hidden">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                  <div className="absolute -right-12 -top-12 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl" />

                  <div className="flex justify-between items-start relative z-10">
                    <span className="w-12 h-12 rounded-xl bg-gradient-to-tr from-yellow-400 to-yellow-500 text-slate-950 flex items-center justify-center font-black text-lg border border-yellow-300/30">1st</span>
                    <Trophy className="w-10 h-10 text-yellow-400 animate-pulse" />
                  </div>
                  <div className="space-y-1 relative z-10">
                    <span className="inline-flex items-center gap-1 bg-yellow-500/10 border border-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">
                      Consensus Champion
                    </span>
                    <h3 className="text-[12px] font-black font-mono break-all text-white mt-2">{top1.address}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4 text-xs font-bold text-slate-400 relative z-10">
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">Staked</span>
                      <span className="text-white">{formatStake(top1.stake)} LUM</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">Voting Power</span>
                      <span className="text-yellow-400 font-black">
                        {totalStake > 0 ? ((top1.stake / totalStake) * 100).toFixed(2) : "0.00"}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rank 3 (Bronze) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 md:order-3 order-3 transform hover:-translate-y-1 transition-transform">
                  <div className="flex justify-between items-start">
                    <span className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center font-bold text-amber-600 border border-amber-100">3rd</span>
                    <Award className="w-8 h-8 text-amber-600" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Bronze</h4>
                    <h3 className="text-[12px] font-black text-slate-900 font-mono break-all">{top3.address}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs font-bold text-slate-700">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Staked</span>
                      <span>{formatStake(top3.stake)} LUM</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Status</span>
                      <span className="text-emerald-600">{top3.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Block Proposal Stream */}
            {simBlocks.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-teal-50 border border-teal-100 text-teal-600">
                      <Activity className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Live Block Proposal Stream</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Simulated consensus blocks from active validators</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setIsSimPlaying(!isSimPlaying)}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-600 font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                  >
                    {isSimPlaying ? (
                      <><Pause className="w-3 h-3 text-emerald-500 fill-emerald-500" /> Running</>
                    ) : (
                      <><Play className="w-3 h-3 text-slate-400" /> Paused</>
                    )}
                  </button>
                </div>

                <div className="flex gap-3 overflow-x-auto py-2 px-1 custom-scrollbar">
                  {simBlocks.map((b, i) => (
                    <div 
                      key={`${b.height}-${i}`} 
                      className={cn(
                        "w-36 shrink-0 bg-slate-50 rounded-xl p-3 border border-slate-200 shadow-sm flex flex-col justify-between space-y-3 relative overflow-hidden",
                        i === 0 ? "border-teal-500 ring-1 ring-teal-500/20 bg-teal-50/10" : ""
                      )}
                    >
                      {i === 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                        </span>
                      )}
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Height</span>
                        <span className="text-sm font-black text-slate-900 font-mono">#{b.height}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Proposer</span>
                        <span className="text-[10px] font-bold text-teal-600 truncate block font-mono">{shortAddr(b.proposer)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 font-mono">
                        <span>Ping: {b.latency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rankings Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-slate-400" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Full Rankings</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">All validators sorted by bonded stake</p>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 select-none">
                    <tr>
                      <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors w-20"
                        onClick={() => handleSort("rank")}
                      >
                        <div className="flex items-center gap-1">
                          Rank {sortField === "rank" && (sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                        </div>
                      </th>
                      <th className="px-6 py-4">Validator Address</th>
                      <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors"
                        onClick={() => handleSort("stake")}
                      >
                        <div className="flex items-center gap-1">
                          Bonded Stake {sortField === "stake" && (sortOrder === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                        </div>
                      </th>
                      <th className="px-6 py-4">Voting Power</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {validators.map((node) => {
                      const votingPower = totalStake > 0 && node.stake > 0 
                        ? ((node.stake / totalStake) * 100).toFixed(2) 
                        : "0.00"

                      return (
                        <tr key={node.address} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <span className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center font-black text-[11px] border shadow-sm",
                              node.rank === 1 ? "bg-amber-50 text-yellow-600 border-yellow-200" :
                              node.rank === 2 ? "bg-slate-100 text-slate-600 border-slate-200" :
                              node.rank === 3 ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-white text-slate-400 border-slate-100"
                            )}>
                              {node.rank}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors font-mono text-[12px] truncate block max-w-[300px]">
                              {node.address}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800">
                            {formatStake(node.stake)} LUM
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-teal-600">{votingPower}%</span>
                              <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden hidden sm:block">
                                <div 
                                  className="h-full rounded-full bg-teal-500"
                                  style={{ width: `${Math.min(100, parseFloat(votingPower))}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
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
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
