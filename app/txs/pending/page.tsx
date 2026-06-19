"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Layers, RefreshCcw, Clock, ArrowUpRight, ArrowDownLeft, ShieldQuestion, ShieldCheck, Cpu } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { fetchRpc } from "@/lib/rpc"
import { formatHash, formatValue, formatTime, formatAddr, cleanHash, cn } from "@/lib/utils"
import { TOKEN_SYMBOL } from "@/lib/constants"

interface TokenInfo {
  contract_id: string
  method: string
  token_name?: string
  token_symbol?: string
  token_recipient?: string
  token_amount?: string
}

interface TransactionInfo {
  hash: string
  from: string
  to: string
  value: string
  nonce: number
  status: string
  method: string
  timestamp: number
  data?: string
  token_info?: TokenInfo | null
}

// Parse CALL payload from hex data field
function parseCallPayload(hexData: string | undefined) {
  if (!hexData) return null;
  try {
    const bytes = new Uint8Array(hexData.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const text = new TextDecoder().decode(bytes);
    if (!text.startsWith('CALL:')) return null;
    const parts = text.substring(5).split(':');
    if (parts.length < 2) return null;
    const contractId = parts[0];
    const methodName = parts[1];
    const argsRaw = parts.slice(2).join(':');
    const argParts = argsRaw ? argsRaw.split(',') : [];
    return { contractId, methodName, args: argParts };
  } catch { return null; }
}

// Get display value and symbol dynamically (e.g. for custom tokens CALL mint/burn/transfer)
function getTransactionDisplayValueAndSymbol(tx: {
  value: string;
  data?: string;
  method?: string;
  token_info?: {
    token_amount?: string;
    token_symbol?: string;
  } | null;
}) {
  if (tx.token_info) {
    const symbol = tx.token_info.token_symbol || "TOKEN";
    if (tx.token_info.token_amount) {
      return { value: tx.token_info.token_amount, symbol };
    }
  }
  if (tx.method === "CALL" || (tx.data && tx.data.length > 0)) {
    try {
      const hexData = tx.data;
      if (hexData) {
        const bytes = new Uint8Array(hexData.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
        const text = new TextDecoder().decode(bytes);
        if (text.startsWith('CALL:')) {
          const parts = text.substring(5).split(':');
          if (parts.length >= 2) {
            const methodName = parts[1];
            const argsRaw = parts.slice(2).join(':');
            const args = argsRaw ? argsRaw.split(',') : [];
            const symbol = tx.token_info?.token_symbol || "TOKEN";
            if (methodName === 'mint' && args.length >= 2) {
              return { value: args[1], symbol };
            } else if (methodName === 'burn' && args.length >= 1) {
              return { value: args[0], symbol };
            } else if (methodName === 'transfer' && args.length >= 2) {
              return { value: args[1], symbol };
            }
          }
        }
      }
    } catch { }
  }
  return { value: tx.value, symbol: TOKEN_SYMBOL };
}

export default function PendingTxsPage() {
  const [txs, setTxs] = useState<TransactionInfo[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPending = async () => {
    setLoading(true)
    try {
      const res = await fetchRpc(`/mempool/recent`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setTxs(data)
      }
    } catch (err) {
      console.error("Failed to fetch pending txs:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPending()
    const interval = setInterval(fetchPending, 10000) // Auto refresh 10s
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">
      <Navbar />

      <div className="animate-hero-bg relative pt-8 pb-12">
        <div className="max-w-[1400px] mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
                <Layers className="w-8 h-8 text-teal-400 fill-teal-400/20" />
                Pending <span className="text-teal-400">Transactions</span>
              </h1>
              <p className="text-slate-400 text-sm mt-1 font-medium">Viewing real-time Mempool activity (Auto-refreshing)</p>
            </div>
            <button
              onClick={fetchPending}
              className="bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg px-4 py-3 backdrop-blur-md flex flex-col items-end transition-all group"
            >
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Transactions in Pool</span>
              <div className="flex items-center gap-2">
                <RefreshCcw className={`w-3 h-3 text-teal-400 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
                <span className="text-xl font-black text-white tabular-nums">{txs.length}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-4 -mt-6 relative z-20 pb-20">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">TX Hash</th>
                  <th className="px-6 py-4 text-center">Method</th>
                  <th className="px-6 py-4">From</th>
                  <th className="px-6 py-4"></th>
                  <th className="px-6 py-4">To</th>
                  <th className="px-6 py-4 text-right">Value</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Time Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading && txs.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : txs.length > 0 ? (
                  txs.map((tx) => (
                    <tr key={tx.hash} className="hover:bg-amber-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <Link href={`/tx/${tx.hash}`} className="font-bold text-amber-600 hover:text-amber-700 flex items-center gap-2">
                          {formatHash(tx.hash)}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 justify-center text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                          {tx.method === "CALL" ? (() => {
                            const callInfo = parseCallPayload(tx.data);
                            const displayMethod = tx.token_info?.method || callInfo?.methodName;
                            if (displayMethod) {
                              return (
                                <span className="flex flex-col items-center gap-0.5">
                                  <span className="text-violet-500 font-black tracking-wider flex items-center gap-1">
                                    <Cpu className="w-3 h-3 text-violet-500 animate-pulse" />
                                    {displayMethod.toUpperCase()}
                                  </span>
                                  <span className="px-1 py-0.2 bg-violet-100 text-violet-500 border border-violet-200/50 rounded-[4px] text-[7px] font-bold">
                                    WASM CALL
                                  </span>
                                </span>
                              );
                            }
                            return (
                              <span className="flex items-center gap-1.5">
                                <Cpu className="w-3 h-3 text-teal-600" />
                                CALL
                              </span>
                            );
                          })() : (() => {
                            const m = (tx.method || "TRANSFER").toUpperCase();
                            return (
                              <span className="flex items-center gap-1.5">
                                {m === "STAKE" ? (
                                  <ShieldCheck className="w-3 h-3 text-teal-600" />
                                ) : m === "TRANSFER" ? (
                                  <ArrowUpRight className="w-3 h-3 text-teal-600" />
                                ) : (
                                  <Cpu className="w-3 h-3 text-teal-600" />
                                )}
                                {m}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/address/${tx.from}`} className="font-mono text-slate-500 hover:text-teal-600 transition-colors">
                          {formatAddr(tx.from)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                          <ArrowUpRight className="w-3 h-3 text-slate-400" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/address/${tx.to}`} className="font-mono text-slate-500 hover:text-teal-600 transition-colors">
                          {formatAddr(tx.to)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(() => {
                          const display = getTransactionDisplayValueAndSymbol(tx);
                          return (
                            <>
                              <span className="font-black text-slate-900">{formatValue(display.value)}</span>
                              <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">{display.symbol}</span>
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 px-2 py-1 rounded-full text-[9px] font-black uppercase border border-amber-100">
                          <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                          Pending
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500">
                        <div className="flex items-center justify-end gap-1.5">
                          <Clock className="w-3 h-3" />
                          {formatTime(tx.timestamp * 1000)}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-24 text-slate-400 italic">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 mb-2">
                          <RefreshCcw className="w-8 h-8 text-slate-300" />
                        </div>
                        <span className="text-sm font-medium text-slate-400">No pending transactions in pool</span>
                        <p className="text-[11px] text-slate-300 not-italic max-w-[200px] text-center">New transactions will appear here as they enter the mempool.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-4 text-center font-medium italic">
          * Pending transactions are not yet included in a block. They are stored in the Mempool.
        </p>
      </main>

      <Footer />
    </div>
  )
}
