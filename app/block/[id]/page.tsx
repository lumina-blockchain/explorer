"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Zap, Activity, Box, Search, ChevronRight, ArrowUpRight,
  ShieldCheck, Cpu, ExternalLink, Wallet, ArrowLeft, MoreVertical, Database, Copy, Info, Layers, Clock, ArrowRightLeft,
  CheckCircle2
} from "lucide-react"
import CopyButton from "@/components/CopyButton"
import Footer from "@/components/Footer"
import Navbar from "@/components/Navbar"
import { TOKEN_SYMBOL } from "@/lib/constants"
import { cn, formatHash, formatAddr, formatValue, cleanHash } from "@/lib/utils"
import { fetchRpc } from "@/lib/rpc"

interface BlockDetail {
  height: number
  hash: string
  parent_hash: string
  timestamp: number
  tx_count: number
  leader: string
  leader_name?: string | null
  reward: string
  fees: string
  total_reward: string
  parent_qc?: {
    height: number
    block_hash: string
    aggregated_signature: string
    signers: string[]
    signers_count: number
    total_validators: number
    quorum_percentage: string
  } | null
  transactions: Array<{
    hash: string
    from: string
    from_name?: string | null
    to: string
    to_name?: string | null
    value: string
    nonce: number
    method: string
    status: string
    data?: string
    token_info?: {
      contract_id: string
      method: string
      token_name?: string
      token_symbol?: string
      token_recipient?: string
      token_amount?: string
    } | null
  }>
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

export default function BlockPage() {
  const params = useParams()
  const router = useRouter()
  const [block, setBlock] = useState<BlockDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const query = searchQuery.trim()
    if (!query) return

    if (/^\d+$/.test(query)) {
      router.push(`/block/${query}`)
    } else if (query.toLowerCase().startsWith("lumina")) {
      router.push(`/address/${query}`)
    } else if (query.length >= 60) {
      const clean = query.startsWith("0x") ? query.substring(2) : query

      try {
        const txRes = await fetchRpc(`/tx/${clean}`)
        const txData = await txRes.json()

        if (txData && !txData.error) {
          router.push(`/tx/${clean}`)
        } else {
          const blockRes = await fetchRpc(`/block/${clean}`)
          const blockData = await blockRes.json()
          if (blockData && (blockData.height !== undefined || !blockData.error)) {
            router.push(`/block/${blockData.height || clean}`)
          } else {
            router.push(`/tx/${clean}`)
          }
        }
      } catch (err) {
        router.push(`/tx/${clean}`)
      }
    }
    setShowResults(false)
    setSearchQuery("")
  }

  // Quick Search Effect (Live Preview)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const query = searchQuery.trim()
      if (query.length > 2) {
        setIsSearching(true)
        try {
          const res = await fetchRpc(`/search?q=${query}`)
          const data = await res.json()
          setSearchResults(data.results || [])
          setShowResults(true)
        } catch (err) {
          console.error("Live search failed:", err)
        } finally {
          setIsSearching(false)
        }
      } else {
        setSearchResults([])
        setShowResults(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const fetchBlock = async () => {
      try {
        const res = await fetchRpc(`/block/${params.id}`)
        const data = await res.json()
        if (data.height !== undefined) setBlock(data)
      } catch (err) {
        console.error("Failed to fetch block:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchBlock()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6f6] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!block) {
    return (
      <div className="min-h-screen bg-[#f6f6f6] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 p-8 rounded-md text-center shadow-sm">
          <Box className="w-10 h-10 text-rose-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-slate-900 mb-2">Block Not Found</h1>
          <button onClick={() => router.push('/')} className="mt-6 text-teal-600 font-bold text-sm hover:underline">Return Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">
      <Navbar />
      <div className="relative z-10">
        {/* Hero Header Section with Animation */}
        <div className="animate-hero-bg relative pt-6 pb-8 border-b border-white/5">
          <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(#512da8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="max-w-[1400px] mx-auto px-4 relative z-10 space-y-4">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Lumina <span className="text-teal-400 uppercase text-xs tracking-widest">Block Detail</span>
            </h1>
            <form onSubmit={handleSearch} className="max-w-2xl relative group z-30">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length > 2 && setShowResults(true)}
                placeholder="Search by Address / Signature / Block"
                className="w-full bg-white/10 border border-white/10 rounded-md py-2 px-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

              {/* QUICK SEARCH RESULTS DROPDOWN */}
              {showResults && (searchResults.length > 0 || isSearching) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-md shadow-2xl border border-slate-200 overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-1 duration-200 text-slate-900">
                  <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Search Results</span>
                    {isSearching && <div className="w-3 h-3 border border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />}
                  </div>
                  <div className="max-h-[300px] overflow-auto py-1 text-slate-900">
                    {searchResults.map((res, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          router.push(res.url)
                          setShowResults(false)
                          setSearchQuery("")
                        }}
                        className="w-full px-4 py-3 hover:bg-slate-50 flex items-center gap-4 transition-colors text-left group/item"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded flex items-center justify-center border text-slate-900",
                          res.type === "Block" ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                            res.type === "Transaction" ? "bg-teal-50 border-teal-100 text-teal-600" :
                              "bg-blue-50 border-blue-100 text-blue-600"
                        )}>
                          {res.type === "Block" ? <Box className="w-4 h-4" /> :
                            res.type === "Transaction" ? <Activity className="w-4 h-4" /> :
                              <Wallet className="w-4 h-4" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{res.type}</span>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                          </div>
                          <span className="text-[13px] font-mono text-slate-900 truncate font-bold">{res.id}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      <main className={cn(
        "max-w-[1400px] mx-auto px-4 -mt-4 relative space-y-3 transition-all",
        showResults ? "z-0" : "z-40"
      )}>

        {/* Title Section (Flat & Compact) */}
        <div className="bg-white p-4 rounded-md border border-slate-200 shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-1.5 rounded hover:bg-slate-50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
              Block <span className="text-teal-600 font-mono">#{block.height}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
            <span className="bg-teal-50 text-teal-600 px-2 py-0.5 rounded border border-teal-100 uppercase tracking-widest">Confirmed</span>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100 text-[13px]">
            <DetailRow label="Block Hash" value={
              <div className="flex items-center gap-2">
                <span className="font-mono text-teal-600 select-all break-all">{block.hash}</span>
                <CopyButton value={block.hash} />
              </div>
            } />

            {/* PREVIOUS HASH (PARENT) */}
            <DetailRow label="Previous Hash" value={
              block.height > 0 ? (
                <Link href={`/block/${block.height - 1}`} className="font-mono text-slate-400 hover:text-teal-600 transition-colors break-all">
                  {block.parent_hash}
                </Link>
              ) : (
                <span className="text-slate-300 italic">Genesis Block (No Parent)</span>
              )
            } />

            <DetailRow label="Timestamp" value={new Date(block.timestamp).toLocaleString()} />
            <DetailRow label="Validated By" value={
              <Link href={`/address/${block.leader}`} className="text-teal-600 font-mono hover:underline flex items-center gap-2">
                {block.leader_name ? (
                  <span className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800">{block.leader_name}</span>
                    <span className="text-slate-400 font-normal text-xs">({formatAddr(block.leader)})</span>
                  </span>
                ) : (
                  <span>{formatAddr(block.leader)}</span>
                )}
                <ExternalLink className="w-3 h-3 text-slate-300" />
              </Link>
            } />
            <DetailRow label="Block Reward" value={
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">{formatValue(block.total_reward)} {TOKEN_SYMBOL}</span>
                <span className="text-[10px] text-slate-400 font-medium tracking-tighter uppercase">(Base: {formatValue(block.reward)} + Fee: {formatValue(block.fees)})</span>
              </div>
            } />
            <DetailRow label="Transactions" value={`${block.tx_count} confirmed transactions`} />
          </div>
        </div>

        {/* BFT Quorum Certificate Details Card */}
        {block.parent_qc && (
          <div className="bg-white rounded-md border border-emerald-500/20 shadow-lg shadow-emerald-500/5 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="px-5 py-3 bg-emerald-500/5 border-b border-emerald-500/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500 animate-pulse" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                  HotStuff BFT Quorum Certificate (QC)
                </h3>
              </div>
              <span className="text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse animate-duration-1000">
                Verified Quorum: {block.parent_qc.signers.length}/{block.parent_qc.total_validators} Validators
              </span>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 p-4 rounded-md border border-slate-100 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Certified Target Height</span>
                  <span className="text-xl font-black text-slate-800 font-mono mt-1">#{block.parent_qc.height}</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-md border border-slate-100 flex flex-col justify-center col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Block Hash</span>
                  <span className="text-xs font-mono text-teal-600 truncate mt-1 select-all break-all">{block.parent_qc.block_hash}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-md border border-slate-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">BLS12-381 Aggregated Signature (G2)</span>
                  <CopyButton value={block.parent_qc.aggregated_signature} />
                </div>
                <div className="bg-black/90 text-emerald-400/90 font-mono text-[10px] p-3 rounded border border-emerald-500/10 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all select-all shadow-inner max-h-36">
                  {block.parent_qc.aggregated_signature}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-md border border-slate-100 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Signers ({block.parent_qc.signers.length}/{block.parent_qc.total_validators} Active Validators)</span>
                <div className="flex flex-wrap gap-2">
                  {block.parent_qc.signers.map((signer, sIdx) => (
                    <Link
                      key={sIdx}
                      href={`/address/${signer}`}
                      className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 border border-emerald-500/10 px-3 py-1.5 rounded-full text-[11px] font-mono transition-all duration-200"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      {signer}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Table Section */}
        <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Transactions in Block</h3>
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">{block.tx_count} Total</span>
          </div>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-tight border-b border-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-2.5">Signature</th>
                  <th className="px-5 py-2.5 text-center">Method</th>
                  <th className="px-5 py-2.5">Accounts</th>
                  <th className="px-5 py-2.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {block.transactions.length > 0 ? block.transactions.map((tx: any, idx: number) => (
                  <tr key={`${tx.hash}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-2">
                      <Link href={`/tx/${cleanHash(tx.hash)}`} className="text-teal-600 font-medium hover:underline">
                        {formatHash(tx.hash)}
                      </Link>
                    </td>
                    <td className="px-5 py-2">
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
                    <td className="px-5 py-2">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                        <Link href={`/address/${tx.from}`} className="hover:text-teal-600 transition-colors">
                          {tx.from_name ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-bold text-slate-800">{tx.from_name}</span>
                              <span className="text-[10px] text-slate-400">({formatAddr(tx.from)})</span>
                            </span>
                          ) : (
                            <span>{formatAddr(tx.from)}</span>
                          )}
                        </Link>
                        <ChevronRight className="w-3 h-3 opacity-30" />
                        <Link href={`/address/${tx.to}`} className="hover:text-teal-600 transition-colors">
                          {tx.to_name ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-bold text-slate-800">{tx.to_name}</span>
                              <span className="text-[10px] text-slate-400">({formatAddr(tx.to)})</span>
                            </span>
                          ) : (
                            <span>{formatAddr(tx.to)}</span>
                          )}
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-2 text-right font-bold text-slate-800">
                      {(() => {
                        const display = getTransactionDisplayValueAndSymbol(tx);
                        return (
                          <>
                            {formatValue(display.value)} <span className="text-[10px] text-slate-400 font-normal">{display.symbol}</span>
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400 italic">No transactions in this block</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RAW JSON Section */}
        <div className="bg-slate-900 rounded-md p-6 border border-white/5">
          <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest block mb-4">Metadata Block</span>
          <pre className="font-mono text-[11px] text-teal-400/50 overflow-x-auto leading-relaxed custom-scrollbar max-h-60">
            {JSON.stringify(block, null, 2)}
          </pre>
        </div>

        <Footer />
      </main>
    </div>
  )
}

function DetailRow({ label, value }: { label: string, value: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center">
      <div className="md:col-span-4">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{label}</span>
      </div>
      <div className="md:col-span-8">
        <div className="text-[13px] font-medium text-slate-700 leading-relaxed">
          {value}
        </div>
      </div>
    </div>
  )
}
