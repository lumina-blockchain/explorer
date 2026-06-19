"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
   Zap, Activity, Box, Search, ChevronRight, ArrowUpRight,
   Clock, Database, ShieldCheck, Cpu, ExternalLink,
   AlertCircle, CheckCircle2, ChevronDown, Wallet, Copy, Info, Code2, FileJson
} from "lucide-react"
import { TOKEN_SYMBOL } from "@/lib/constants"
import CopyButton from "@/components/CopyButton"
import Footer from "@/components/Footer"
import Navbar from "@/components/Navbar"
import { cn, formatHash, formatAddr, formatValue, cleanHash } from "@/lib/utils"
import { fetchRpc } from "@/lib/rpc"

interface TxDetail {
   hash: string
   from: string
   from_name?: string
   to: string
   to_name?: string
   value: string
   nonce: number
   data: string
   signature: string
   pubkey: string
   fee: string
   chain_id: string
   status: string
   method?: string
   block_height: number
   latest_height: number
   timestamp: number
   fee_payer?: string
   fee_payer_name?: string
   fee_payer_signature?: string
   fee_payer_pubkey?: string
   token_info?: {
      contract_id: string
      method: string
      token_name?: string
      token_symbol?: string
      token_recipient?: string
      token_amount?: string
   } | null
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

export default function TxPage() {
   const params = useParams()
   const router = useRouter()
   const [tx, setTx] = useState<TxDetail | null>(null)
   const [loading, setLoading] = useState(true)
   const [activeTab, setActiveTab] = useState<"overview" | "technical" | "raw">("overview")
   const [searchQuery, setSearchQuery] = useState("")
   const [searchResults, setSearchResults] = useState<any[]>([])
   const [isSearching, setIsSearching] = useState(false)
   const [showResults, setShowResults] = useState(false)
   const [tokenMeta, setTokenMeta] = useState<{ name: string, symbol: string } | null>(null)

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

   const fetchTxData = async () => {
      try {
         const res = await fetchRpc(`/tx/${params.id}`)
         const data = await res.json()
         if (data && data.hash) {
            setTx(data)
         }
      } catch (err) {
         console.error("Failed to fetch data:", err)
      } finally {
         setLoading(false)
      }
   }

   useEffect(() => {
      fetchTxData()
   }, [params.id])

   // Fetch token metadata if this is a CALL tx
   const callPayload = tx ? parseCallPayload(tx.data) : null;
   const isTokenTransfer = tx?.token_info 
      ? tx.token_info.method === 'transfer' && tx.token_info.token_amount !== undefined
      : callPayload?.methodName === 'transfer' && callPayload.args.length >= 2;
   const tokenRecipient = tx?.token_info?.token_recipient || (isTokenTransfer ? callPayload!.args[0] : null);
   const tokenAmountRaw = tx?.token_info?.token_amount || (isTokenTransfer ? callPayload!.args[1] : null);

   useEffect(() => {
      if (tx?.token_info && tx.token_info.token_name && tx.token_info.token_symbol && tx.token_info.token_name !== 'Unknown Token') {
         setTokenMeta({
            name: tx.token_info.token_name,
            symbol: tx.token_info.token_symbol
         });
         return;
      }
      const cid = tx?.token_info?.contract_id || callPayload?.contractId;
      if (!cid) return;
      (async () => {
         try {
            let name = tx?.token_info?.token_name && tx.token_info.token_name !== 'Unknown Token' ? tx.token_info.token_name : null;
            let symbol = tx?.token_info?.token_symbol && tx.token_info.token_symbol !== 'Unknown' ? tx.token_info.token_symbol : null;

            const res = await fetchRpc(`/contract/${cid}`);
            const data = await res.json();
            if (data && data.metadata) {
               if (!name) name = data.metadata.name;
               if (!symbol) symbol = data.metadata.symbol;
            }

            if (!name) {
               try {
                  const nameRes = await fetchRpc(`/contract/${cid}/call/name`);
                  const nameData = await nameRes.json();
                  if (nameData && nameData.result) name = nameData.result;
               } catch {}
            }
            if (!symbol) {
               try {
                  const symRes = await fetchRpc(`/contract/${cid}/call/symbol`);
                  const symData = await symRes.json();
                  if (symData && symData.result) symbol = symData.result;
               } catch {}
            }

            setTokenMeta({
               name: name || 'Standard LTS-20 Token',
               symbol: symbol || 'TKN'
            });
         } catch {
            setTokenMeta({
               name: 'Standard LTS-20 Token',
               symbol: 'TKN'
            });
         }
      })();
   }, [tx?.data, tx?.token_info, callPayload?.contractId])

   // Auto-refresh logic if pending
   useEffect(() => {
      if (!tx || tx.status !== "Pending") return;

      const interval = setInterval(() => {
         console.log("Refreshing pending tx detail...");
         fetchTxData();
      }, 10000); // 10 seconds

      return () => clearInterval(interval);
   }, [tx?.status, params.id])

   // Helper buat bersihin status dan ambil CID
   const parsedStatus = tx?.status.startsWith("SUCCESS:CID:")
      ? { label: "SUCCESS", cid: tx.status.split(":")[2] }
      : { label: tx?.status || "PENDING", cid: null };

   if (loading) {
      return (
         <div className="min-h-screen bg-[#f6f6f6] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
         </div>
      )
   }

   if (!tx) {
      return (
         <div className="min-h-screen bg-[#f6f6f6] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white border border-slate-200 p-8 rounded-md text-center shadow-sm">
               <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
               <h1 className="text-lg font-bold text-slate-900 mb-2">Transaction Not Found</h1>
               <button onClick={() => router.push('/')} className="mt-6 text-teal-600 font-bold text-sm hover:underline">Return Home</button>
            </div>
         </div>
      )
   }

   return (
      <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">

         <Navbar />
         <div className="relative z-10">
            {/* Hero Header */}
            <div className="animate-hero-bg relative pt-6 pb-8 border-b border-white/5">
               <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(#512da8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
               <div className="max-w-[1400px] mx-auto px-4 relative z-10 space-y-4">
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                     Lumina <span className="text-teal-400 uppercase text-xs tracking-widest">Transaction Detail</span>
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
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-md shadow-2xl border border-slate-200 overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-1 duration-200">
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

            {/* Summary Banner */}
            <div className="relative bg-white rounded-md border border-slate-200 shadow-sm p-4 flex items-center gap-4">
               <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-5 h-5 text-teal-600" />
               </div>
               <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction Summary</span>
                  <p className="text-[13px] font-medium text-slate-700">
                     {tx.to === "lumina1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq4fdvjl" ? (
                        <>Contract Deployment by <Link href={`/address/${tx.from}`} className="text-teal-600 hover:underline font-mono">{tx.from_name ? `${tx.from_name} (${formatAddr(tx.from)})` : formatAddr(tx.from)}</Link></>
                     ) : callPayload?.methodName === 'mint' && callPayload.args.length >= 2 ? (
                        <>Token Mint to <Link href={`/address/${callPayload.args[0]}`} className="text-teal-600 hover:underline font-mono">{formatAddr(callPayload.args[0])}</Link> of <span className="font-bold text-slate-900">{formatValue(callPayload.args[1])} {tokenMeta?.symbol || 'TOKEN'}</span> via contract <Link href={`/token/${callPayload.contractId}`} className="text-teal-600 hover:underline font-mono">{formatAddr(callPayload.contractId)}</Link></>
                     ) : callPayload?.methodName === 'burn' && callPayload.args.length >= 1 ? (
                        <>Token Burn of <span className="font-bold text-slate-900">{formatValue(callPayload.args[0])} {tokenMeta?.symbol || 'TOKEN'}</span> by <Link href={`/address/${tx.from}`} className="text-teal-600 hover:underline font-mono">{tx.from_name ? `${tx.from_name} (${formatAddr(tx.from)})` : formatAddr(tx.from)}</Link></>
                     ) : isTokenTransfer ? (
                        <>Token Transfer from <Link href={`/address/${tx.from}`} className="text-teal-600 hover:underline font-mono">{tx.from_name ? `${tx.from_name} (${formatAddr(tx.from)})` : formatAddr(tx.from)}</Link> to <Link href={`/address/${tokenRecipient!}`} className="text-teal-600 hover:underline font-mono">{formatAddr(tokenRecipient!)}</Link> for <span className="font-bold text-slate-900">{formatValue(tokenAmountRaw!)} {tokenMeta?.symbol || 'TOKEN'}</span></>
                     ) : callPayload ? (
                        <>Contract Call <span className="font-mono font-bold">{callPayload.methodName}()</span> on <Link href={`/token/${callPayload.contractId}`} className="text-teal-600 hover:underline font-mono">{formatAddr(callPayload.contractId)}</Link> by <Link href={`/address/${tx.from}`} className="text-teal-600 hover:underline font-mono">{tx.from_name ? `${tx.from_name} (${formatAddr(tx.from)})` : formatAddr(tx.from)}</Link></>
                     ) : (
                        <>Transfer from <Link href={`/address/${tx.from}`} className="text-teal-600 hover:underline font-mono">{tx.from_name ? `${tx.from_name} (${formatAddr(tx.from)})` : formatAddr(tx.from)}</Link> to <Link href={`/address/${tx.to}`} className="text-teal-600 hover:underline font-mono">{tx.to_name ? `${tx.to_name} (${formatAddr(tx.to)})` : formatAddr(tx.to)}</Link> for <span className="font-bold text-slate-900">{formatValue(tx.value)} {TOKEN_SYMBOL}</span></>
                     )}
                  </p>
               </div>
            </div>

            {/* Tabbed Detail Section */}
            <div className="relative bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden flex flex-col">
               <div className="px-6 pt-3 border-b border-slate-100 flex gap-8 bg-slate-50/30">
                  <button
                     onClick={() => setActiveTab("overview")}
                     className={cn(
                        "pb-2.5 text-[12px] font-bold transition-all relative uppercase tracking-widest",
                        activeTab === "overview" ? "text-teal-600 border-b-2 border-teal-600" : "text-slate-400 hover:text-slate-600"
                     )}
                  >
                     Overview
                  </button>
                  <button
                     onClick={() => setActiveTab("technical")}
                     className={cn(
                        "pb-2.5 text-[12px] font-bold transition-all relative uppercase tracking-widest",
                        activeTab === "technical" ? "text-teal-600 border-b-2 border-teal-600" : "text-slate-400 hover:text-slate-600"
                     )}
                  >
                     Technical Data
                  </button>
                  <button
                     onClick={() => setActiveTab("raw")}
                     className={cn(
                        "pb-2.5 text-[12px] font-bold transition-all relative uppercase tracking-widest",
                        activeTab === "raw" ? "text-teal-600 border-b-2 border-teal-600" : "text-slate-400 hover:text-slate-600"
                     )}
                  >
                     Raw JSON
                  </button>
               </div>

               <div className="p-0">
                  {activeTab === "overview" && (
                     <div className="divide-y divide-slate-100">
                        <DetailRow label="Signature" value={
                           <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-600 break-all select-all">{tx.hash}</span>
                              <CopyButton value={tx.hash} />
                           </div>
                        } />
                        <DetailRow label="Method" value={
                           tx.method === "CALL" ? (() => {
                              const callInfo = parseCallPayload(tx.data);
                              const displayMethod = tx.token_info?.method || callInfo?.methodName;
                              if (displayMethod) {
                                 return (
                                    <span className="flex items-center gap-2">
                                       <span className="text-[10px] font-black px-2 py-1 rounded-sm bg-violet-100 text-violet-700 border border-violet-200 uppercase tracking-widest flex items-center gap-1">
                                          <Cpu className="w-3 h-3 text-violet-500 animate-pulse" />
                                          {displayMethod.toUpperCase()}
                                       </span>
                                       <span className="px-1.5 py-0.5 bg-violet-50 text-violet-500 border border-violet-100 rounded text-[7px] font-bold uppercase tracking-wider">
                                          WASM CALL
                                       </span>
                                    </span>
                                 );
                              }
                              return (
                                 <span className="text-[10px] font-medium px-2 py-1 rounded-sm bg-slate-200 text-slate-900 border border-slate-300 uppercase tracking-widest">
                                    CALL
                                 </span>
                              );
                           })() : (
                              <span className="text-[10px] font-medium px-2 py-1 rounded-sm bg-slate-200 text-slate-900 border border-slate-300 uppercase tracking-widest">
                                 {tx.method || "TRANSFER"}
                              </span>
                           )
                        } />
                        <DetailRow label="Result" value={
                           <div className="flex items-center gap-3">
                              <div className={cn(
                                 "text-white text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-widest",
                                 (parsedStatus.label.toUpperCase() === "SUCCESS" || parsedStatus.label.toUpperCase() === "CONFIRMED") ? "bg-emerald-500" :
                                    parsedStatus.label.toUpperCase().includes("FAILED") ? "bg-red-500" :
                                       "bg-amber-500 animate-pulse"
                              )}>
                                 {parsedStatus.label.toUpperCase().includes("PENDING") && <Clock className="w-2.5 h-2.5" />}
                                 {parsedStatus.label.toUpperCase()}
                              </div>
                              {tx.block_height > 0 ? (
                                 <>
                                    {(tx.status.toUpperCase() === "SUCCESS" || tx.status.toUpperCase() === "CONFIRMED") ? (
                                       <span className="text-[11px] text-slate-400 font-bold uppercase italic tracking-tighter">
                                          {tx.latest_height - tx.block_height + 1} Confirmations
                                       </span>
                                    ) : tx.status.toUpperCase().includes("FAILED") ? (
                                       <span className="text-[11px] text-red-500 font-bold uppercase italic tracking-tighter flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3" /> Execution Error
                                       </span>
                                    ) : null}
                                 </>
                              ) : (
                                 <span className="text-[11px] text-amber-500 font-bold uppercase italic tracking-tighter">
                                    Awaiting inclusion in block...
                                 </span>
                              )}
                           </div>
                        } />

                        {parsedStatus.cid && (
                           <DetailRow label="Created Contract" value={
                              <div className="flex items-center gap-2">
                                 <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                                 <Link href={`/token/${parsedStatus.cid}`} className="text-emerald-600 font-mono hover:underline font-bold break-all">
                                    {parsedStatus.cid}
                                 </Link>
                                 <CopyButton value={parsedStatus.cid} />
                              </div>
                           } />
                        )}
                        <DetailRow label="Timestamp" value={new Date(tx.timestamp).toLocaleString()} />
                        <DetailRow label="Block" value={
                           tx.block_height > 0 ? (
                              <Link href={`/block/${tx.block_height}`} className="text-teal-600 font-bold hover:underline">#{tx.block_height}</Link>
                           ) : (
                              <span className="text-slate-400 italic">Unconfirmed</span>
                           )
                        } />

                        {/* From & To (Sesuai Permintaan) */}
                        <DetailRow label="From (Signer)" value={
                           <Link href={`/address/${tx.from}`} className="text-teal-600 font-mono hover:underline flex items-center gap-2">
                              {tx.from_name ? (
                                 <span className="flex items-center gap-1">
                                    <span className="font-bold text-slate-800">{tx.from_name}</span>
                                    <span className="text-[11px] text-slate-400">({tx.from})</span>
                                 </span>
                              ) : (
                                 tx.from
                              )}
                              <ExternalLink className="w-3 h-3 opacity-30" />
                           </Link>
                        } />
                        <DetailRow label="To (Receiver)" value={
                           <div className="flex items-center gap-2">
                              {tx.to === "lumina1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq4fdvjl" ? (
                                 <div className="flex items-center gap-2 px-2 py-1 bg-teal-50 border border-teal-100 rounded text-teal-600 font-bold text-[10px]">
                                    <Database className="w-3 h-3" /> LUMINA SYSTEM (DEPLOY)
                                 </div>
                              ) : isTokenTransfer ? (
                                 <div className="flex flex-col gap-1">
                                    <Link href={`/address/${tokenRecipient!}`} className="text-teal-600 font-mono hover:underline flex items-center gap-2">
                                       {tokenRecipient!} <ExternalLink className="w-3 h-3 opacity-30" />
                                    </Link>
                                    <div className="flex items-center gap-2">
                                       {tx.to !== tokenRecipient && callPayload && (
                                          <div className="flex items-center gap-2">
                                             <span className="text-[10px] text-slate-400 italic">via contract</span>
                                             <Link href={`/token/${callPayload.contractId}`} className="text-[10px] text-emerald-600 font-mono hover:underline">
                                                {formatAddr(callPayload.contractId)}
                                             </Link>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              ) : (
                                 <Link href={`/address/${tx.to}`} className="text-teal-600 font-mono hover:underline flex items-center gap-2">
                                    {tx.to_name ? (
                                       <span className="flex items-center gap-1">
                                          <span className="font-bold text-slate-800">{tx.to_name}</span>
                                          <span className="text-[11px] text-slate-400">({tx.to})</span>
                                       </span>
                                    ) : (
                                       tx.to
                                    )}
                                    <ExternalLink className="w-3 h-3 opacity-30" />
                                 </Link>
                              )}
                           </div>
                        } />

                        {callPayload?.methodName === 'mint' && callPayload.args.length >= 2 ? (
                            <>
                               <DetailRow label="Token Minted Value" value={
                                  <span className="font-bold text-emerald-600">{formatValue(callPayload.args[1])} {tokenMeta?.symbol || 'TOKEN'}</span>
                               } />
                               <DetailRow label="Contract" value={
                                  <Link href={`/token/${callPayload.contractId}`} className="text-teal-600 font-mono hover:underline flex items-center gap-2">
                                     {callPayload.contractId} <ExternalLink className="w-3 h-3 opacity-30" />
                                  </Link>
                               } />
                               <DetailRow label="Token Recipient" value={
                                  <Link href={`/address/${callPayload.args[0]}`} className="text-teal-600 font-mono hover:underline flex items-center gap-2">
                                     {callPayload.args[0]} <ExternalLink className="w-3 h-3 opacity-30" />
                                  </Link>
                               } />
                               <DetailRow label="Native Value" value={<span className="text-slate-400">{formatValue(tx.value)} {TOKEN_SYMBOL}</span>} />
                            </>
                         ) : callPayload?.methodName === 'burn' && callPayload.args.length >= 1 ? (
                            <>
                               <DetailRow label="Token Burned Value" value={
                                  <span className="font-bold text-rose-600">{formatValue(callPayload.args[0])} {tokenMeta?.symbol || 'TOKEN'}</span>
                               } />
                               <DetailRow label="Contract" value={
                                  <Link href={`/token/${callPayload.contractId}`} className="text-teal-600 font-mono hover:underline flex items-center gap-2">
                                     {callPayload.contractId} <ExternalLink className="w-3 h-3 opacity-30" />
                                  </Link>
                               } />
                               <DetailRow label="Native Value" value={<span className="text-slate-400">{formatValue(tx.value)} {TOKEN_SYMBOL}</span>} />
                            </>
                         ) : isTokenTransfer ? (
                           <>
                              <DetailRow label="Token Value" value={
                                 <span className="font-bold text-emerald-600">{formatValue(tokenAmountRaw!)} {tokenMeta?.symbol || 'TOKEN'}</span>
                              } />
                              <DetailRow label="Contract" value={
                                 <Link href={`/token/${callPayload!.contractId}`} className="text-teal-600 font-mono hover:underline flex items-center gap-2">
                                    {callPayload!.contractId} <ExternalLink className="w-3 h-3 opacity-30" />
                                 </Link>
                              } />
                              <DetailRow label="Token Recipient" value={
                                 <Link href={`/address/${tokenRecipient!}`} className="text-teal-600 font-mono hover:underline flex items-center gap-2">
                                    {tokenRecipient!} <ExternalLink className="w-3 h-3 opacity-30" />
                                 </Link>
                              } />
                              <DetailRow label="Native Value" value={<span className="text-slate-400">{formatValue(tx.value)} {TOKEN_SYMBOL}</span>} />
                           </>
                        ) : callPayload ? (
                           <>
                              <DetailRow label="Contract" value={
                                 <Link href={`/token/${callPayload.contractId}`} className="text-teal-600 font-mono hover:underline flex items-center gap-2">
                                    {callPayload.contractId} <ExternalLink className="w-3 h-3 opacity-30" />
                                 </Link>
                              } />
                              <DetailRow label="Method" value={
                                 <span className="font-mono font-bold text-slate-900">{callPayload.methodName}({callPayload.args.join(', ')})</span>
                              } />
                              <DetailRow label="Native Value" value={<span className="text-slate-400">{formatValue(tx.value)} {TOKEN_SYMBOL}</span>} />
                           </>
                        ) : (
                           <DetailRow label="Value" value={<span className="font-bold text-slate-900">{formatValue(tx.value)} {TOKEN_SYMBOL}</span>} />
                        )}
                        <DetailRow label="Fee" value={`${formatValue(tx.fee)} ${TOKEN_SYMBOL}`} />

                        {tx.fee_payer && (
                           <DetailRow label="Fee Payer" value={
                              <div className="flex items-center gap-2">
                                 <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                 <Link href={`/address/${tx.fee_payer}`} className="text-emerald-600 font-mono hover:underline flex items-center gap-2">
                                    {tx.fee_payer_name ? (
                                       <span className="flex items-center gap-1">
                                          <span className="font-bold text-slate-800">{tx.fee_payer_name}</span>
                                          <span className="text-[11px] text-slate-400">({tx.fee_payer})</span>
                                       </span>
                                    ) : (
                                       tx.fee_payer
                                    )}
                                    <ExternalLink className="w-3 h-3 opacity-30" />
                                 </Link>
                                 <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-tighter">Sponsored</span>
                              </div>
                           } />
                        )}
                     </div>
                  )}

                  {activeTab === "technical" && (
                     <div className="divide-y divide-slate-100">
                        <DetailRow label="Nonce" value={tx.nonce} />
                        <DetailRow label="Chain ID" value={tx.chain_id.toUpperCase()} />
                        <DetailRow label="Public Key" value={<span className="font-mono text-slate-400 break-all">{tx.pubkey}</span>} />
                        <DetailRow label="Signature (Raw)" value={<span className="font-mono text-slate-400 break-all">{tx.signature}</span>} />

                        {tx.fee_payer && (
                           <>
                              <DetailRow label="FP Public Key" value={<span className="font-mono text-emerald-400/50 break-all">{tx.fee_payer_pubkey}</span>} />
                              <DetailRow label="FP Signature" value={<span className="font-mono text-emerald-400/50 break-all">{tx.fee_payer_signature}</span>} />
                           </>
                        )}
                        <DetailRow label="Instruction Data" value={
                           <div className="bg-slate-50 p-3 rounded border border-slate-200 font-mono text-[11px] text-slate-400 break-all mt-1">
                              0x{tx.data || '00'}
                           </div>
                        } />
                        {(() => {
                           if (!tx.data) return null;
                           try {
                              const bytes = new Uint8Array(tx.data.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
                              const decodedText = new TextDecoder().decode(bytes);
                              if (/^[\x20-\x7E\r\n\t]+$/.test(decodedText)) {
                                 return (
                                    <DetailRow label="Decoded Payload (UTF-8)" value={
                                       <div className="bg-emerald-50/50 p-3 rounded border border-emerald-100 font-mono text-[11px] text-emerald-800 break-all mt-1 font-bold">
                                          {decodedText}
                                       </div>
                                    } />
                                 );
                              }
                           } catch { }
                           return null;
                        })()}
                     </div>
                  )}

                  {activeTab === "raw" && (
                     <div className="p-6 bg-slate-900">
                        <div className="flex justify-between items-center mb-4">
                           <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest flex items-center gap-2">
                              <FileJson className="w-3.5 h-3.5" /> Protocol Response Data
                           </span>
                        </div>
                        {(() => {
                           if (!tx) return null;
                           let displayTx = { ...tx };
                           if (tx.data) {
                              try {
                                 const bytes = new Uint8Array(tx.data.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
                                 const decodedText = new TextDecoder().decode(bytes);
                                 if (/^[\x20-\x7E\r\n\t]+$/.test(decodedText)) {
                                    displayTx.data = decodedText;
                                 }
                              } catch { }
                           }
                           return (
                              <pre className="font-mono text-[11px] text-teal-400/50 overflow-x-auto leading-relaxed custom-scrollbar max-h-[500px]">
                                 {JSON.stringify(displayTx, null, 2)}
                              </pre>
                           );
                        })()}
                     </div>
                  )}
               </div>
            </div>

            <Footer />
         </main>
      </div>
   )
}

function DetailRow({ label, value }: { label: string, value: any }) {
   return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center">
         <div className="md:col-span-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{label}</span>
         </div>
         <div className="md:col-span-9">
            <div className="text-[13px] font-medium text-slate-700 leading-relaxed">
               {value}
            </div>
         </div>
      </div>
   )
}
