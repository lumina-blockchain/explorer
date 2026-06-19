"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import {
   Box,
   Activity,
   Search,
   Layers,
   Zap,
   Globe,
   Cpu,
   Users,
   ArrowUpRight,
   Clock,
   ExternalLink,
   ShieldCheck,
   CheckCircle2,
   Wallet,
   ChevronRight,
   X
} from "lucide-react"
import Footer from "@/components/Footer"
import Navbar from "@/components/Navbar"
import { TOKEN_SYMBOL } from "@/lib/constants";
import { cn, formatHash, formatAddr, formatValue, cleanHash } from "@/lib/utils"
import { fetchRpc, getWssUrl } from "@/lib/rpc"

interface BlockInfo {
   height: number
   hash: string
   tx_count: number
   timestamp: number
   leader?: string
   leader_name?: string
   reward?: string
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

interface TxInfo {
   hash: string
   from: string
   from_name?: string
   to: string
   to_name?: string
   value: string
   timestamp: number
   status?: string
   method?: string
   data?: string
   token_info?: {
      contract_id: string
      method: string
      token_name?: string
      token_symbol?: string
      token_recipient?: string
      token_amount?: string
   } | null
}

interface NetworkStats {
   avg_fee: string
   total_height: number
   active_nodes: number
   circulating_supply: string
   total_supply: string
   confirmed_tps: number
   inbound_tps: number
   total_transactions: number
   chain_id: string
   consensus_time_ms?: number
   commit_time_ms?: number
   block_time_ms?: number
   aups?: number
   persistence_lag?: number
   total_accounts?: number
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

export default function Home() {
   const router = useRouter()
   const [blocks, setBlocks] = useState<BlockInfo[]>([])
   const [txs, setTxs] = useState<TxInfo[]>([])
   const [latestHeight, setLatestHeight] = useState(0)
   const [displayedConfirmedTps, setDisplayedConfirmedTps] = useState(0)
   const tpsBuffer = useRef<number[]>([])
   const latestTpsRef = useRef<number>(0)
   const [stats, setStats] = useState<NetworkStats>({
      avg_fee: "0",
      total_height: 0,
      active_nodes: 3,
      circulating_supply: "0",
      total_supply: "0",
      confirmed_tps: 0,
      inbound_tps: 0,
      total_transactions: 0,
      chain_id: "",
      consensus_time_ms: 0,
      commit_time_ms: 0,
      block_time_ms: 1000,
      aups: 0,
      persistence_lag: 0,
      total_accounts: 0
   })
   const [searchQuery, setSearchQuery] = useState("")
   const [searchResults, setSearchResults] = useState<any[]>([])
   const [isSearching, setIsSearching] = useState(false)
   const [showResults, setShowResults] = useState(false)
   const [now, setNow] = useState(Date.now())
   const [showWalletModal, setShowWalletModal] = useState(false)
   const ws = useRef<WebSocket | null>(null)
   const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "Lumina-Mainnet"

   useEffect(() => {
      const timer = setInterval(() => setNow(Date.now()), 1000)
      return () => clearInterval(timer)
   }, [])

   useEffect(() => {
      const interval = setInterval(() => {
         const currentBuffer = tpsBuffer.current
         if (currentBuffer.length > 0) {
            const sum = currentBuffer.reduce((a, b) => a + b, 0)
            const avg = sum / currentBuffer.length
            setDisplayedConfirmedTps(avg)
            tpsBuffer.current = []
         } else {
            setDisplayedConfirmedTps(latestTpsRef.current)
         }
      }, 5000)

      return () => clearInterval(interval)
   }, [])

   useEffect(() => {
      const fetchData = async () => {
         // 1. Fetch recent blocks
         try {
            const res = await fetchRpc("/recent_blocks")
            if (res.ok) {
               const bData = await res.json()
               if (Array.isArray(bData)) {
                  setBlocks(bData.map((b: any) => ({
                     ...b,
                     timestamp: typeof b.timestamp === 'number' ? b.timestamp * 1000 : Date.now()
                  })))
                  if (bData.length > 0) setLatestHeight(bData[0].height)
               }
            }
         } catch (err) {
            console.error("Failed to fetch blocks:", err)
         }

         // 2. Fetch recent transactions & mempool
         try {
            const [tRes, mRes] = await Promise.allSettled([
               fetchRpc("/recent_txs"),
               fetchRpc("/mempool/recent")
            ])

            let confirmed: any[] = []
            let pending: any[] = []

            if (tRes.status === "fulfilled" && tRes.value.ok) {
               try {
                  const tData = await tRes.value.json()
                  if (Array.isArray(tData)) {
                     confirmed = tData.map((t: any) => ({
                        ...t,
                        status: t.status || "SUCCESS",
                        timestamp: typeof t.timestamp === 'number' ? t.timestamp * 1000 : Date.now()
                     }))
                  }
               } catch (e) {
                  console.error("Failed to parse recent txs:", e)
               }
            }

            if (mRes.status === "fulfilled" && mRes.value.ok) {
               try {
                  const mData = await mRes.value.json()
                  if (Array.isArray(mData)) {
                     pending = mData.map((m: any) => ({
                        ...m,
                        status: "pending",
                        timestamp: Date.now()
                     }))
                  }
               } catch (e) {
                  console.error("Failed to parse mempool:", e)
               }
            }

            if (confirmed.length > 0 || pending.length > 0) {
               setTxs([...pending, ...confirmed].slice(0, 50))
            }
         } catch (err) {
            console.error("Failed to fetch transactions:", err)
         }

         // 3. Fetch network stats
         try {
            const res = await fetchRpc("/network/stats")
            if (res.ok) {
               const sData = await res.json()
               if (sData && sData.circulating_supply) {
                  setStats(prev => ({
                     ...sData,
                     active_nodes: sData.active_nodes > 0 ? sData.active_nodes : prev.active_nodes
                  }))
                  setDisplayedConfirmedTps(sData.confirmed_tps || 0)
                  latestTpsRef.current = sData.confirmed_tps || 0
               }
            }
         } catch (err) {
            console.error("Failed to fetch stats:", err)
         }
      }
      fetchData()
   }, [])

   useEffect(() => {
      const connect = () => {
         ws.current = new WebSocket(getWssUrl())
         ws.current.onmessage = (event) => {
            try {
               const data = JSON.parse(event.data)
               if (data.type === "new_block") {
                  setLatestHeight(data.height)

                  if (data.confirmed_tps !== undefined) {
                     tpsBuffer.current.push(data.confirmed_tps)
                     latestTpsRef.current = data.confirmed_tps
                  }

                  // Update stats secara realtime menggunakan data murni dari Node
                  setStats(prev => ({
                     ...prev,
                     total_height: data.height,
                     circulating_supply: data.circulating_supply || prev.circulating_supply,
                     total_supply: data.total_supply || prev.total_supply,
                     confirmed_tps: data.confirmed_tps !== undefined ? data.confirmed_tps : prev.confirmed_tps,
                     inbound_tps: data.inbound_tps !== undefined ? data.inbound_tps : prev.inbound_tps,
                     total_transactions: data.total_transactions !== undefined ? data.total_transactions : prev.total_transactions,
                     total_accounts: data.total_accounts !== undefined ? data.total_accounts : prev.total_accounts,
                     consensus_time_ms: data.consensus_time_ms !== undefined ? data.consensus_time_ms : prev.consensus_time_ms,
                     commit_time_ms: data.commit_time_ms !== undefined ? data.commit_time_ms : prev.commit_time_ms,
                     block_time_ms: data.block_time_ms !== undefined ? data.block_time_ms : prev.block_time_ms,
                     aups: data.aups !== undefined ? data.aups : prev.aups,
                     persistence_lag: data.persistence_lag !== undefined ? data.persistence_lag : prev.persistence_lag
                  }))

                  const newBlock = {
                     height: data.height,
                     hash: data.hash,
                     tx_count: data.tx_count,
                     timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
                     leader: data.leader,
                     leader_name: data.leader_name,
                     reward: data.reward,
                     parent_qc: data.parent_qc
                  }
                  setBlocks(prev => [newBlock, ...prev.filter(b => b.height !== data.height).slice(0, 9)])

                  if (data.transactions) {
                     const newTxs = data.transactions.map((tx: any) => ({
                        ...tx,
                        status: tx.status || "SUCCESS",
                        timestamp: Date.now()
                     }))
                     setTxs(prev => {
                        // Filter out pending txs that are now confirmed
                        const filteredPrev = prev.filter(p => !newTxs.some((n: any) => n.hash === p.hash));
                        return [...newTxs.reverse(), ...filteredPrev.slice(0, 49)]
                     })
                  }
               }
            } catch (e) { }
         }
         ws.current.onclose = () => setTimeout(connect, 3000)
      }
      connect()
      return () => ws.current?.close()
   }, [])

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

   const getRelativeTime = (timestamp: number) => {
      const diff = Math.floor((now - timestamp) / 1000)
      if (isNaN(diff) || diff < 1) return "0s ago"
      if (diff < 60) return `${diff}s ago`
      return `${Math.floor(diff / 60)}m ago`
   }

   const handleSearch = async (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      const query = searchQuery.trim()
      if (!query) return

      // Logic Penentuan Redirect:
      // 1. Jika angka murni -> Block Height
      if (/^\d+$/.test(query)) {
         router.push(`/block/${query}`)
      }
      // 2. Jika lumina... -> Address
      else if (query.toLowerCase().startsWith("lumina")) {
         router.push(`/address/${query}`)
      }
      // 3. Jika hash panjang (64 chars hex) -> Transaction ATAU Block
      else if (query.length >= 60) {
         const clean = query.startsWith("0x") ? query.substring(2) : query

         // Cek dulu ke API: Ini Transaksi atau Blok?
         try {
            const txRes = await fetchRpc(`/tx/${clean}`)
            const txData = await txRes.json()

            if (txData && !txData.error) {
               // Ketemu sebagai Transaksi!
               router.push(`/tx/${clean}`)
            } else {
               // Kalau bukan transaksi, coba cek apakah ini Blok
               const blockRes = await fetchRpc(`/block/${clean}`)
               const blockData = await blockRes.json()
               if (blockData && (blockData.height !== undefined || !blockData.error)) {
                  // Ketemu sebagai Blok! Redirect pake Height biar rapi
                  router.push(`/block/${blockData.height || clean}`)
               } else {
                  // Default ke TX (biar halaman detail yang nampilin 404)
                  router.push(`/tx/${clean}`)
               }
            }
         } catch (err) {
            router.push(`/tx/${clean}`)
         }
      }
   }

   return (
      <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">
         {/* Navbar Compact */}
         {/* Header & Hero Area */}
         <div className="relative z-10">
            <Navbar />

            {/* Hero Header Section */}
            <div className="animate-hero-bg relative pt-14 pb-16 border-b border-white/5 overflow-hidden">
               {/* Dot grid pattern */}
               <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#512da8 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

               {/* Floating orbs */}
               <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
               <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
               <div className="absolute top-1/2 left-3/4 w-56 h-56 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />

               {/* Scanline shimmer */}
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent pointer-events-none" />

               <div className="max-w-[1400px] mx-auto px-4 relative z-10 space-y-6">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                     <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-ping" />
                     <span className="text-[10px] font-bold text-teal-400 uppercase tracking-[0.2em]">{chainId}</span>
                     {latestHeight > 0 && (
                        <span className="text-[10px] text-white/40 font-mono">#{latestHeight.toLocaleString()}</span>
                     )}
                  </div>

                  <div className="space-y-2">
                     <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                        Lumina
                        <span className="ml-3 bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Explorer</span>
                     </h1>
                     <p className="text-sm text-white/40 font-medium tracking-wide max-w-md">
                        Real-time blockchain data — blocks, transactions, and addresses at your fingertips.
                     </p>
                  </div>

                  <form onSubmit={handleSearch} className="max-w-2xl relative group z-30">
                     <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                        <input
                           type="text"
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           onFocus={() => searchQuery.length > 2 && setShowResults(true)}
                           placeholder="Search transactions, blocks, or addresses..."
                           className="w-full bg-white/95 backdrop-blur rounded-xl py-3.5 pl-11 pr-14 text-sm text-slate-900 shadow-2xl shadow-black/20 focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition-all placeholder:text-slate-400"
                        />
                        <button
                           type="submit"
                           className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-teal-600 to-emerald-500 p-2 rounded-lg cursor-pointer hover:from-teal-500 hover:to-emerald-400 transition-all shadow-lg shadow-teal-900/20"
                        >
                           <Search className="w-4 h-4 text-white" />
                        </button>
                     </div>

                     {/* QUICK SEARCH RESULTS DROPDOWN */}
                     {showResults && (searchResults.length > 0 || isSearching) && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl shadow-black/10 border border-slate-200 overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-1 duration-200">
                           <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Search Results</span>
                              {isSearching && <div className="w-3 h-3 border border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />}
                           </div>
                           <div className="max-h-[300px] overflow-auto py-1">
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
                                       "w-8 h-8 rounded flex items-center justify-center border",
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
                              {!isSearching && searchResults.length === 0 && (
                                 <div className="px-6 py-8 text-center text-slate-400 italic text-sm">
                                    No matching results found
                                 </div>
                              )}
                           </div>
                           <div className="px-4 py-2 border-t border-slate-50 bg-slate-50/30 text-[9px] text-slate-400 font-bold uppercase text-center">
                              Press Enter to Search
                           </div>
                        </div>
                     )}
                  </form>

                  {/* Quick hint chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                     {["Block Height", "Tx Hash", "Address"].map((hint) => (
                        <span key={hint} className="text-[10px] text-white/30 border border-white/10 rounded-full px-2.5 py-1 font-medium">
                           {hint}
                        </span>
                     ))}
                  </div>
               </div>
            </div>
         </div>

         <main className={cn(
            "max-w-[1400px] mx-auto px-4 -mt-6 relative space-y-3 transition-all",
            (showResults && (searchResults.length > 0 || isSearching)) ? "z-0" : "z-20"
         )}>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
               {[
                  { label: "Circulating Supply", value: `${formatValue(stats.circulating_supply)} ${TOKEN_SYMBOL}`, sub: `Total: ${formatValue(stats.total_supply)} ${TOKEN_SYMBOL}`, icon: Globe },
                  { label: "Total Transactions", value: stats.total_transactions.toLocaleString(), sub: "All-Time", icon: Activity },
                  { label: "Confirmed TPS", value: Math.round(displayedConfirmedTps).toLocaleString(), sub: "Block Speed", icon: Zap },
                  { label: "Current Height", value: latestHeight.toLocaleString(), sub: chainId, icon: Layers },
                  { label: "Avg Fee", value: `${formatValue(stats.avg_fee)} ${TOKEN_SYMBOL}`, sub: "Dynamic Gas", icon: Cpu },
                  { label: "Validators", value: stats.active_nodes.toString(), sub: "Active Nodes", icon: ShieldCheck },
               ].map((stat, i) => (
                  <div key={i} className="bg-white p-3 rounded-md border border-slate-200 shadow-sm">
                     <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{stat.label}</span>
                        <stat.icon className="w-3 h-3 text-slate-300" />
                     </div>
                     <div className="text-sm font-bold text-slate-900">{stat.value}</div>
                     <div className="text-[9px] text-slate-400 font-medium uppercase">{stat.sub}</div>
                  </div>
               ))}
            </div>

            {/* Real-time Diagnostics Dashboard */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm relative overflow-hidden">
               <div className="relative z-10 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                     <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Performance & Engine Diagnostics</h3>
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded shadow-sm">
                           This stats testing is conducted across continents: California, Paris, Tokyo, Singapore AVG letency 500ms
                        </span>
                     </div>
                  </div>

                  {/* Hitung Active BFT Time & Slot Occupancy secara akurat dengan mengeliminasi delay proposer (900ms) */}
                  {(() => {
                     const activeBftTime = Math.max(1, (stats.consensus_time_ms ?? 901) - 900);
                     const slotOccupancy = Math.max(0.1, Math.min(100, (activeBftTime / (stats.block_time_ms ?? 1000)) * 100));

                     return (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                           {[
                              {
                                 label: "Block Time",
                                 value: `${(stats.block_time_ms ?? 1000).toLocaleString()} ms`,
                                 sub: "Block Interval",
                                 pulse: "bg-emerald-400",
                                 icon: Clock
                              },
                              {
                                 label: "Active BFT Time",
                                 value: `${activeBftTime.toLocaleString()} ms`,
                                 sub: "Consensus Round",
                                 pulse: "bg-purple-400",
                                 icon: ShieldCheck
                              },
                              {
                                 label: "Slot Occupancy",
                                 value: `${slotOccupancy.toFixed(1)} %`,
                                 sub: "Consensus Load",
                                 pulse: slotOccupancy > 50 ? "bg-amber-400" : "bg-teal-400",
                                 icon: Activity
                              },
                              {
                                 label: "Engine Commit",
                                 value: `${(stats.commit_time_ms ?? 0).toFixed(2)} ms`,
                                 sub: "MPT Trie / Cache",
                                 pulse: "bg-blue-400",
                                 icon: Zap
                              },
                              {
                                 label: "Block Transactions",
                                 value: `${(blocks[0]?.tx_count ?? 0).toLocaleString()} TX`,
                                 sub: "Latest Block Txs",
                                 pulse: "bg-pink-400",
                                 icon: Activity
                              },
                              {
                                 label: "State AUPS",
                                 value: `${(stats.aups ?? 0).toFixed(1)} /s`,
                                 sub: "Accounts Updated",
                                 pulse: "bg-teal-400",
                                 icon: Users
                              },
                              {
                                 label: "Persistence Lag",
                                 value: `${stats.persistence_lag ?? 0} blocks`,
                                 sub: (stats.persistence_lag ?? 0) === 0 ? "Synced (Sled DB)" : "Queue Flushing",
                                 pulse: (stats.persistence_lag ?? 0) === 0 ? "bg-emerald-400" : "bg-amber-400",
                                 icon: Cpu
                              },
                           ].map((diag, i) => (
                              <div key={i} className="bg-slate-50 border border-slate-100 p-3 rounded-lg shadow-sm hover:border-slate-200 transition-all hover:-translate-y-0.5 group">
                                 <div className="flex justify-between items-start mb-1.5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{diag.label}</span>
                                    <div className="flex items-center gap-1.5">
                                       <div className={`w-1.5 h-1.5 rounded-full ${diag.pulse} animate-ping`} />
                                       <diag.icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                    </div>
                                 </div>
                                 <div className="text-base font-black tracking-tight text-slate-900 mb-0.5">{diag.value}</div>
                                 <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{diag.sub}</div>
                              </div>
                           ))}
                        </div>
                     );
                  })()}
               </div>
            </div>

            {/* Wallet Download Banner */}
            <div className="bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-xl p-6 text-white shadow-2xl shadow-teal-500/20 relative overflow-hidden group">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
               <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />

               <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-5">
                     <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                        <Wallet className="w-8 h-8 text-white animate-bounce" style={{ animationDuration: '3s' }} />
                     </div>
                     <div>
                        <h3 className="text-xl font-black italic uppercase tracking-tight">Lumina Wallet Extension</h3>
                        <p className="text-teal-50 text-sm font-medium opacity-80">Manage your assets, sign transactions, and interact with dApps directly from Chrome.</p>
                     </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                     <button
                        onClick={() => setShowWalletModal(true)}
                        className="flex-1 md:flex-none bg-white text-teal-600 px-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-teal-50 transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2 group/btn"
                     >
                        <Globe className="w-3.5 h-3.5" /> Chrome Ext
                     </button>
                     <div className="relative flex-1 md:flex-none group/apk">
                        <button
                           disabled
                           className="w-full bg-black/20 backdrop-blur-md text-white/50 border border-white/10 px-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                           <Search className="w-3.5 h-3.5" /> Android APK
                        </button>
                        <div className="absolute -top-2 -right-2 bg-amber-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-lg animate-bounce">
                           SOON
                        </div>
                     </div>
                     <div className="hidden lg:flex flex-col text-right ml-2">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Ecosystem</span>
                        <span className="text-[9px] font-bold text-emerald-200">v1.0 Ready</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Tables Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

               {/* Blocks Table */}
               <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                     <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Box className="w-3.5 h-3.5 text-teal-600" /> Latest Blocks
                     </h2>
                  </div>
                  <div className="overflow-auto h-[450px] custom-scrollbar">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-tight border-b border-slate-100 sticky top-0 z-10">
                           <tr>
                              <th className="px-4 py-2.5">Height</th>
                              <th className="px-4 py-2.5">Validator</th>
                              <th className="px-4 py-2.5">Reward</th>
                              <th className="px-4 py-2.5 text-right">Age</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {blocks.map((block, idx) => {
                              const valAddr = block.leader || block.hash;
                              return (
                                 <tr key={`${block.height}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-4 py-3">
                                       <div className="flex flex-col">
                                          <Link href={`/block/${block.height}`} className="text-teal-600 font-bold text-[12px] hover:underline">
                                             #{block.height}
                                          </Link>
                                          {block.parent_qc && (
                                             <div className="group relative">
                                                <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-[8px] text-emerald-600 font-black uppercase px-1.5 py-0.5 rounded shadow-sm mt-1 cursor-help w-max hover:from-emerald-500/20 hover:to-teal-500/20 transition-all">
                                                   <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" /> BFT QC Verified
                                                </span>
                                                {/* Premium QC Tooltip Popup on Hover */}
                                                <div className="absolute left-0 top-full mt-2 w-72 bg-slate-900 text-white rounded-xl shadow-2xl p-4 hidden group-hover:block z-50 animate-in fade-in duration-200 border border-slate-800">
                                                   <div className="space-y-3">
                                                      <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                                                         <span className="text-[10px] font-black uppercase tracking-wider text-teal-400">Quorum Certificate</span>
                                                         <span className="text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{block.parent_qc.signers.length}/{block.parent_qc.total_validators} Validators</span>
                                                      </div>
                                                      <div className="space-y-1 text-[11px] font-mono text-slate-400">
                                                         <div className="flex justify-between">
                                                            <span>Target Height:</span>
                                                            <span className="text-white font-bold">#{block.parent_qc.height}</span>
                                                         </div>
                                                         <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-800/50 pt-1.5">
                                                            <span>BLS Aggregated Signature:</span>
                                                            <span className="text-emerald-300 break-all text-[9px] bg-black/30 p-1 rounded border border-white/5">{block.parent_qc.aggregated_signature.substring(0, 48)}...</span>
                                                         </div>
                                                      </div>
                                                      <div className="space-y-1">
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
                                    <td className="px-4 py-3">
                                       <Link href={`/address/${valAddr}`} className="text-teal-600 font-medium text-[11px] hover:underline flex items-center gap-1.5">
                                          {block.leader_name ? (
                                             <span className="flex items-center gap-1">
                                                <span className="font-bold text-slate-800">{block.leader_name}</span>
                                                <span className="text-[10px] text-slate-400">({formatAddr(valAddr)})</span>
                                             </span>
                                          ) : (
                                             formatAddr(valAddr)
                                          )}
                                       </Link>
                                    </td>
                                    <td className="px-4 py-3">
                                       <span className="text-[12px] font-semibold text-slate-700">
                                          {formatValue(block.reward || "0")} <span className="text-[9px] text-slate-400 font-normal">{TOKEN_SYMBOL}</span>
                                       </span>
                                    </td>
                                    <td className="px-4 py-3 text-right w-20">
                                       <span className="text-[11px] font-normal text-slate-400 tracking-tighter whitespace-nowrap">
                                          {getRelativeTime(block.timestamp)}
                                       </span>
                                    </td>
                                 </tr>
                              )
                           })}
                        </tbody>
                     </table>
                  </div>
               </div>

               {/* Transactions Table */}
               <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                     <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-teal-600" /> Latest Transactions
                     </h2>
                  </div>
                  <div className="overflow-auto h-[450px] custom-scrollbar">
                     <table className="w-full text-left text-[12px]">
                        <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10">
                           <tr>
                              <th className="px-4 py-3 text-left">Signature</th>
                              <th className="px-4 py-3 text-center">Method</th>
                              <th className="px-4 py-3 text-center">Status</th>
                              <th className="px-4 py-3 text-right">Value</th>
                              <th className="px-4 py-3 text-right">Age</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {txs.map((tx, idx) => (
                              <tr key={`${tx.hash}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                 <td className="px-4 py-2">
                                    <Link href={`/tx/${cleanHash(tx.hash)}`} className="text-teal-600 font-bold hover:underline text-[12px]">
                                       {formatHash(tx.hash)}
                                    </Link>
                                 </td>
                                 <td className="px-4 py-2">
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
                                 <td className="px-4 py-2 text-center">
                                    <div className={cn(
                                       "text-[7px] font-black px-2 py-1 rounded border inline-block uppercase tracking-tighter whitespace-nowrap shadow-sm",
                                       (tx.status?.toUpperCase().includes("SUCCESS") || tx.status === "confirmed") ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                          tx.status?.toUpperCase().includes("FAILED") ? "bg-red-50 text-red-600 border-red-100" :
                                             "bg-amber-50 text-amber-600 border-amber-100 animate-pulse"
                                    )}>
                                       {tx.status?.toUpperCase().includes("SUCCESS") ? "SUCCESS" :
                                          tx.status?.toUpperCase().includes("FAILED") ? "FAILED" :
                                             (tx.status || "SUCCESS")}
                                    </div>
                                 </td>
                                 <td className="px-4 py-2 text-right">
                                    {(() => {
                                       const display = getTransactionDisplayValueAndSymbol(tx);
                                       return (
                                          <>
                                             <span className="text-[12px] font-semibold text-slate-700">{formatValue(display.value)}</span>{" "}
                                             <span className="text-[9px] text-slate-400 font-normal tracking-tight">{display.symbol}</span>
                                          </>
                                       );
                                    })()}
                                 </td>
                                 <td className="px-4 py-2 text-right w-20">
                                    <span className="text-[11px] text-slate-400 font-normal tracking-tighter whitespace-nowrap">
                                       {getRelativeTime(tx.timestamp)}
                                    </span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>

            </div>

            <Footer />
         </main>

         {/* Wallet Installation Modal */}
         {showWalletModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowWalletModal(false)} />
               <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-slate-100">
                  <div className="relative h-48 bg-gradient-to-br from-teal-600 to-emerald-500 flex items-center justify-center overflow-hidden">
                     <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                     <img src="/tutorial-wallet.png" className="h-full w-full object-cover opacity-60" alt="Tutorial" />
                     <div className="absolute inset-0 bg-gradient-to-t from-teal-900/40 to-transparent" />
                     <div className="relative z-10 text-center">
                        <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">Install Lumina Wallet</h2>
                        <p className="text-teal-50/80 text-xs font-bold uppercase tracking-[0.3em]">Developer Mode Sideloading</p>
                     </div>
                     <button
                        onClick={() => setShowWalletModal(false)}
                        className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-md z-20 border border-white/10"
                     >
                        <X className="w-5 h-5" />
                     </button>
                  </div>
                  <div className="p-10 space-y-8">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                           { step: "01", title: "Download & Unzip", desc: "Get the extension package and extract it." },
                           { step: "02", title: "Developer Mode", desc: "Turn on developer mode in chrome://extensions." },
                           { step: "03", title: "Load Unpacked", desc: "Select the unzipped folder to install." }
                        ].map((s, i) => (
                           <div key={i} className="space-y-2">
                              <div className="text-teal-600 font-black italic text-xl">STEP {s.step}</div>
                              <h4 className="text-sm font-black uppercase text-slate-900 tracking-tight">{s.title}</h4>
                              <p className="text-slate-400 text-[11px] font-medium leading-relaxed">{s.desc}</p>
                           </div>
                        ))}
                     </div>
                     <div className="pt-6 border-t border-slate-50 flex flex-col items-center gap-6">
                        <p className="text-[10px] text-teal-600 font-bold uppercase tracking-[0.2em] text-center max-w-md leading-loose">
                           Note: Manual installation is for <span className="text-slate-900 underline">Testnet Development</span> only.
                           <br />Official Chrome Web Store release is coming soon.
                        </p>
                        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4">
                           <div className="flex items-center gap-3 text-slate-400">
                              <ShieldCheck className="w-5 h-5 text-teal-500" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Verified Package v1.0</span>
                           </div>
                           <a
                              href="/lumina-wallet.zip"
                              onClick={() => setShowWalletModal(false)}
                              className="w-full md:w-auto bg-teal-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-teal-700 transition-all shadow-xl shadow-teal-500/20 text-center"
                           >
                              Download Package Now
                           </a>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   )
}
