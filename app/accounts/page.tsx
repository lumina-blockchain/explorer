"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Trophy, ArrowUpRight, User } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { fetchRpc } from "@/lib/rpc"
import { formatAddr, formatValue } from "@/lib/utils"

interface AccountInfo {
  address: string
  balance: string
  staked: string
  nonce: number
  name?: string | null
  is_validator?: boolean
  validator_status?: string | null
}

type RankingMode = "balance" | "observed_recent"

export default function TopAccountsPage() {
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [totalAccounts, setTotalAccounts] = useState(0)
  const [rankingMode, setRankingMode] = useState<RankingMode>("balance")
  const limit = 20

  useEffect(() => {
    const fetchTotalAccounts = async () => {
      try {
        const res = await fetchRpc("/total_accounts")
        const data = await res.json()
        if (data && data.total_accounts !== undefined) {
          setTotalAccounts(data.total_accounts)
        }
      } catch (err) {
        console.error("Failed to fetch total accounts:", err)
      }
    }
    fetchTotalAccounts()
  }, [])

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true)
      try {
        const res = await fetchRpc(`/accounts/top?page=${page}&limit=${limit}`)
        const data = await res.json()
        if (data && data.accounts) {
          setAccounts(data.accounts)
          setTotal(data.total || 0)
          setRankingMode(data.ranking_mode === "observed_recent" ? "observed_recent" : "balance")
        }
      } catch (err) {
        console.error("Failed to fetch top accounts:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchAccounts()
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
                <Trophy className="w-8 h-8 text-teal-400 fill-teal-400/20" />
                Top <span className="text-teal-400">Accounts</span>
              </h1>
              <p className="text-slate-400 text-sm mt-1 font-medium">
                {rankingMode === "balance"
                  ? "Lumina Whales Leaderboard by Balance"
                  : "Recently observed accounts from indexed blocks and transactions"}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 backdrop-blur-md">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Active Accounts</span>
              <span className="text-xl font-black text-white tabular-nums">
                {(totalAccounts > 0 ? totalAccounts : total).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-4 -mt-6 relative z-20 pb-20">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {rankingMode !== "balance" && (
            <div className="px-6 py-3 border-b border-amber-100 bg-amber-50 text-[11px] text-amber-700 font-medium">
              Explorer backend sedang memakai mode `observed_recent`, jadi urutan akun diambil dari alamat yang paling baru terindeks.
              Balance/staked yang tampil berasal dari snapshot lokal bila tersedia, bukan refresh massal ke node.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 w-16">Rank</th>
                  <th className="px-6 py-4">Address</th>
                  <th className="px-6 py-4 text-right">Balance</th>
                  <th className="px-6 py-4 text-right">Staked</th>
                  <th className="px-6 py-4 text-center">Nonce</th>
                  <th className="px-6 py-4 text-right">Action</th>
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
                ) : accounts.length > 0 ? (
                  accounts.map((acc, index) => (
                    <tr key={acc.address} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 font-black text-slate-400">
                        {(page * limit) + index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/address/${acc.address}`} className="font-mono text-slate-900 font-bold hover:text-teal-600 transition-colors flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                            {acc.is_validator ? (
                              <span className="text-[10px]">💎</span>
                            ) : (
                              <User className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                          {acc.name ? (
                            <span className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800">{acc.name}</span>
                              <span className="text-[10px] text-slate-400">({formatAddr(acc.address)})</span>
                              {acc.is_validator && (
                                <span className="inline-flex items-center bg-gradient-to-r from-amber-500 to-yellow-400 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                                  VAL
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <span>{formatAddr(acc.address)}</span>
                              {acc.is_validator && (
                                <span className="inline-flex items-center bg-gradient-to-r from-amber-500 to-yellow-400 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                                  VAL
                                </span>
                              )}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-slate-900">{formatValue(acc.balance)}</span>
                        <span className="text-[10px] text-slate-400 font-bold ml-1">LUM</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-teal-600">{formatValue(acc.staked)}</span>
                        <span className="text-[10px] text-teal-400 font-bold ml-1">LUM</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold text-slate-600">
                          {acc.nonce}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/address/${acc.address}`} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
                          View <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">No accounts found</td>
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
