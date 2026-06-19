"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Box, ChevronLeft, ChevronRight, Clock, Activity, Cpu, ShieldCheck, CheckCircle2 } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { fetchRpc } from "@/lib/rpc"
import { formatHash, formatAddr, formatValue, formatTime } from "@/lib/utils"

interface BlockInfo {
  height: number
  hash: string
  tx_count: number
  timestamp: number
  leader: string
  leader_name?: string | null
  reward: string
  fees: string
  parent_qc?: {
    height: number
    block_hash: string
    aggregated_signature: string
    signers: string[]
    signers_count: number
    total_validators: number
    quorum_percentage: string
  } | null
}

export default function BlocksPage() {
  const [blocks, setBlocks] = useState<BlockInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const limit = 20

  useEffect(() => {
    const fetchBlocks = async () => {
      setLoading(true)
      try {
        const res = await fetchRpc(`/blocks?page=${page}&limit=${limit}`)
        const data = await res.json()
        if (data && data.blocks) {
          setBlocks(data.blocks)
          setTotal(data.total || 0)
        }
      } catch (err) {
        console.error("Failed to fetch blocks:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchBlocks()
  }, [page])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">
      <Navbar />

      <div className="animate-hero-bg relative pt-8 pb-12">
        <div className="max-w-[1400px] mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
                <Box className="w-8 h-8 text-teal-400 fill-teal-400/20" />
                Blockchain <span className="text-teal-400">Blocks</span>
              </h1>
              <p className="text-slate-400 text-sm mt-1 font-medium">Viewing all confirmed blocks on Lumina Network</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 backdrop-blur-md">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Total Blocks</span>
              <span className="text-xl font-black text-white tabular-nums">#{total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-4 -mt-6 relative z-20 pb-20">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Height</th>
                  <th className="px-6 py-4">Hash</th>
                  <th className="px-6 py-4 text-center">Txs</th>
                  <th className="px-6 py-4">Leader</th>
                  <th className="px-6 py-4 text-right">Reward + Fees</th>
                  <th className="px-6 py-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : blocks.length > 0 ? (
                  blocks.map((block) => (
                    <tr key={block.height} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <Link href={`/block/${block.height}`} className="font-bold text-teal-600 hover:text-teal-700 flex items-center gap-2 w-max">
                            <span className="bg-teal-50 px-2 py-1 rounded border border-teal-100">#{block.height}</span>
                          </Link>
                          {block.parent_qc && (
                            <div className="group relative">
                              <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-[8px] text-emerald-600 font-black uppercase px-1.5 py-0.5 rounded shadow-sm mt-1 cursor-help w-max hover:from-emerald-500/20 hover:to-teal-500/20 transition-all">
                                <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" /> BFT QC Verified
                              </span>
                              {/* Premium QC Tooltip Popup on Hover */}
                              <div className="absolute left-0 top-full mt-2 w-72 bg-slate-900 text-white rounded-xl shadow-2xl p-4 hidden group-hover:block z-50 animate-in fade-in duration-200 border border-slate-800">
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center border-b border-slate-800 pb-1.5 text-left">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-teal-400">Quorum Certificate</span>
                                    <span className="text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{block.parent_qc.signers.length}/{block.parent_qc.total_validators} Validators</span>
                                  </div>
                                  <div className="space-y-1 text-[11px] font-mono text-slate-400 text-left">
                                    <div className="flex justify-between">
                                      <span>Target Height:</span>
                                      <span className="text-white font-bold">#{block.parent_qc.height}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-800/50 pt-1.5">
                                      <span>BLS Aggregated Signature:</span>
                                      <span className="text-emerald-300 break-all text-[9px] bg-black/30 p-1 rounded border border-white/5">{block.parent_qc.aggregated_signature.substring(0, 48)}...</span>
                                    </div>
                                  </div>
                                  <div className="space-y-1 text-left">
                                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">BFT Signers Set</div>
                                    <div className="space-y-1">
                                      {block.parent_qc.signers.map((s, sIdx) => (
                                        <div key={sIdx} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                                          <span className="font-mono text-[9px]">{s.substring(0, 12)}...{s.substring(s.length - 8)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/block/${block.height}`} className="font-mono text-slate-400 group-hover:text-slate-900 transition-colors">
                          {formatHash(block.hash)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          <Activity className="w-3 h-3" /> {block.tx_count}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/address/${block.leader}`} className="flex items-center gap-2 group/leader">
                          <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center group-hover/leader:bg-teal-50 transition-colors">
                            <Cpu className="w-3 h-3 text-slate-400 group-hover/leader:text-teal-600 transition-colors" />
                          </div>
                          {block.leader_name ? (
                            <span className="flex items-center gap-1">
                              <span className="font-bold text-slate-800 hover:text-teal-600 transition-colors">{block.leader_name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({formatAddr(block.leader)})</span>
                            </span>
                          ) : (
                            <span className="font-mono text-slate-600 text-[11px] hover:text-teal-600 transition-colors">{formatAddr(block.leader)}</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">
                        {formatValue(block.reward)} <span className="text-[10px] text-slate-400 font-normal uppercase">LUM</span>
                        <div className="text-[9px] text-emerald-500 font-medium">+{formatValue(block.fees)} fees</div>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500">
                        <div className="flex items-center justify-end gap-1.5">
                          <Clock className="w-3 h-3" />
                          {formatTime(block.timestamp * 1000)}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">No blocks found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Page <span className="text-slate-900">{page + 1}</span> of <span className="text-slate-900">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
