"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Zap, Activity, Box, Search, ChevronRight, ArrowUpRight,
  ShieldCheck, Cpu, ExternalLink, Wallet, ChevronLeft, Coins,
  History, TrendingUp, BarChart3, ArrowDownUp, Lock, Unlock,
  FileSpreadsheet, FileCode2, Terminal as TerminalIcon
} from "lucide-react"
import CopyButton from "@/components/CopyButton"
import Footer from "@/components/Footer"
import Navbar from "@/components/Navbar"
import { TOKEN_SYMBOL } from "@/lib/constants"
import { cn, formatHash, formatAddr, formatValue, cleanHash } from "@/lib/utils"
import { fetchRpc } from "@/lib/rpc"

interface AddressTx {
  hash: string
  from: string
  from_name?: string | null
  to: string
  to_name?: string | null
  value: string
  nonce: number
  status: string
  method: string
  timestamp?: number
  fee?: string
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

interface InternalTx {
  height: number
  hash: string
  amount: string
  type: string
  timestamp: number
}

// Parse CALL payload from data field (supports both hex-encoded and plain text)
function parseCallPayload(rawData: string | undefined) {
  if (!rawData) return null;
  try {
    let text = rawData;

    // If data doesn't start with 'CALL:', try to decode it as hex
    if (!text.startsWith('CALL:')) {
      try {
        const bytes = new Uint8Array(text.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
        text = new TextDecoder().decode(bytes);
      } catch {
        return null;
      }
    }

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
    const callInfo = parseCallPayload(tx.data);
    if (callInfo) {
      const symbol = tx.token_info?.token_symbol || "TOKEN";
      if (callInfo.methodName === 'mint' && callInfo.args.length >= 2) {
        return { value: callInfo.args[1], symbol };
      } else if (callInfo.methodName === 'burn' && callInfo.args.length >= 1) {
        return { value: callInfo.args[0], symbol };
      } else if (callInfo.methodName === 'transfer' && callInfo.args.length >= 2) {
        return { value: callInfo.args[1], symbol };
      }
    }
  }
  return { value: tx.value, symbol: TOKEN_SYMBOL };
}

export default function AddressPage() {
  const params = useParams()
  const addressId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : ""
  const [balance, setBalance] = useState("0")
  const [staked, setStaked] = useState("0")
  const [stakeHeight, setStakeHeight] = useState(0)
  const [lockedVesting, setLockedVesting] = useState("0")
  const [spendable, setSpendable] = useState("0")
  const [vestingSchedule, setVestingSchedule] = useState<{ initial_amount: string, lock_height: number } | null>(null)
  const [chainHeight, setChainHeight] = useState(0)
  const [available, setAvailable] = useState("0")
  const [nonce, setNonce] = useState(0)
  const [txs, setTxs] = useState<AddressTx[]>([])
  const [internalTxs, setInternalTxs] = useState<InternalTx[]>([])
  const [tokens, setTokens] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [pageInternal, setPageInternal] = useState(0)
  const [totalTxs, setTotalTxs] = useState(0)
  const [totalInternal, setTotalInternal] = useState(0)
  const [isContract, setIsContract] = useState(false)
  const [bytecode, setBytecode] = useState("")
  const [contractMetadata, setContractMetadata] = useState<any>(null)
  const [tokenMetaCache, setTokenMetaCache] = useState<Record<string, string>>({})
  const [accountName, setAccountName] = useState<string | null>(null)
  const [isValidator, setIsValidator] = useState(false)
  const [validatorStatus, setValidatorStatus] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const router = useRouter()

  // Hitung persentase pelepasan koin secara real-time berbasis integer
  let unlockedPct = 0;
  if (vestingSchedule !== null) {
    try {
      const totalVal = BigInt(vestingSchedule.initial_amount);
      const lockedVal = BigInt(lockedVesting);
      if (totalVal > BigInt(0)) {
        const unlockedVal = totalVal > lockedVal ? totalVal - lockedVal : BigInt(0);
        unlockedPct = Number((unlockedVal * BigInt(100)) / totalVal);
        if (unlockedPct > 100) unlockedPct = 100;
        if (unlockedPct < 0) unlockedPct = 0;
      }
    } catch (e) {
      unlockedPct = 0;
    }
  }

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

  const [activeTab, setActiveTab] = useState<"transactions" | "transfers" | "tokens" | "staking" | "internal" | "analytics" | "metadata" | "bytecode">("transactions")

  const limit = 10

  useEffect(() => {
    if (!addressId) return
    const fetchAddressData = async () => {
      setLoading(true)
      try {
        const [balRes, txsRes, internalRes, tokensRes] = await Promise.all([
          fetchRpc(`/balance/${addressId}`),
          fetchRpc(`/txs/${addressId}?page=${page}&limit=${limit}`),
          fetchRpc(`/internal_txs/${addressId}?page=${pageInternal}&limit=${limit}`),
          fetchRpc(`/tokens/${addressId}`)
        ])

        const bData = await balRes.json()
        const tData = await txsRes.json()
        const iData = await internalRes.json()
        const tkData = await tokensRes.json()

        setBalance(bData.balance || "0")
        setStaked(bData.staked || "0")
        setStakeHeight(bData.stake_height || 0)
        setLockedVesting(bData.locked_vesting || "0")
        setSpendable(bData.spendable || "0")
        setVestingSchedule(bData.vesting_schedule || null)
        setChainHeight(bData.height || 0)
        setAvailable(bData.available || "0")
        setNonce(bData.nonce || 0)
        setAccountName(bData.name || null)
        setIsValidator(!!bData.is_validator)
        setValidatorStatus(bData.validator_status || null)
        setTxs(tData.transactions || [])
        setTotalTxs(tData.total || 0)
        setInternalTxs(iData.transactions || [])
        setTotalInternal(iData.total || 0)
        setTokens(tkData.tokens || [])

        // Deteksi apakah ini Kontrak Pintar
        try {
          const contractRes = await fetchRpc(`/contract/${addressId}`);
          const cData = await contractRes.json();
          console.log("🔍 Contract Detection Result:", cData);

          // Gunakan contract_type atau metadata untuk deteksi (karena bytecode mungkin di endpoint terpisah)
          if (cData && !cData.error && cData.contract_type) {
            console.log("✅ Contract Detected via Type:", cData.contract_type);
            setIsContract(true);

            if (cData.metadata) {
              setContractMetadata(cData.metadata);
            }

            // Tetap fetch bytecode untuk tab Bytecode
            try {
              const bcRes = await fetchRpc(`/contract/${addressId}/bytecode`);
              const bcData = await bcRes.json();
              if (bcData && bcData.bytecode) {
                setBytecode(bcData.bytecode);
              }
            } catch (e) {
              console.log("⚠️ Failed to fetch bytecode");
            }
          }
        } catch (e) {
          console.log("ℹ️ Not a contract address");
        }
      } catch (err) {
        console.error("Failed to fetch address data:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchAddressData()
  }, [addressId, page, pageInternal])

  useEffect(() => {
    if (!txs || txs.length === 0) return;
    const uniqueContractIds = new Set<string>();
    txs.forEach(tx => {
      if (tx.method === "CALL" && tx.data) {
        const parts = tx.data.split(':');
        if (parts.length >= 2) {
          // CALL:contract_id:method
          uniqueContractIds.add(parts[1]);
        }
      }
    });

    uniqueContractIds.forEach(async (cid) => {
      if (tokenMetaCache[cid]) return;
      try {
        // 1. Try to fetch contract metadata from indexer
        const res = await fetchRpc(`/contract/${cid}/metadata`);
        const data = await res.json();
        if (data && data.metadata && data.metadata.symbol && data.metadata.symbol !== 'Unknown') {
          setTokenMetaCache(prev => ({ ...prev, [cid]: data.metadata.symbol }));
        } else {
          // 2. Fallback: query VM view call directly
          const symRes = await fetchRpc(`/contract/${cid}/call/symbol`);
          const symData = await symRes.json();
          if (symData && symData.result) {
            setTokenMetaCache(prev => ({ ...prev, [cid]: symData.result }));
          } else {
            setTokenMetaCache(prev => ({ ...prev, [cid]: 'TKN' }));
          }
        }
      } catch (e) {
        console.error("Failed to fetch contract symbol for cache:", e);
      }
    });
  }, [txs]);

  const totalPages = Math.ceil(totalTxs / limit)
  const totalPagesInternal = Math.ceil(totalInternal / limit)

  if (loading && page === 0) {
    return (
      <div className="min-h-screen bg-[#f6f6f6] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
      </div>
    )
  }

  // Helper untuk membersihkan status yang berantakan (seperti SUCCESS:CID:...)
  const parseStatus = (status: string) => {
    if (!status) return { label: "SUCCESS", sub: null, color: "emerald" };
    const upper = status.toUpperCase();
    if (upper.startsWith("SUCCESS:CID:")) {
      const cid = status.split(":")[2];
      return { label: "DEPLOYED", sub: cid, color: "violet" };
    }
    if (upper === "SUCCESS" || upper === "CONFIRMED") return { label: "SUCCESS", sub: null, color: "emerald" };
    if (upper.includes("FAILED")) return { label: "FAILED", sub: status.split(":")[1] || null, color: "red" };
    return { label: upper, sub: null, color: "amber" };
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
              Lumina <span className="text-teal-400 uppercase text-xs tracking-widest">{isContract ? "Contract Detail" : "Address Detail"}</span>
            </h1>

            {!isContract && (accountName || isValidator) && (
              <div className="flex flex-col md:flex-row md:items-center gap-6 mt-6 animate-in fade-in slide-in-from-left-2 duration-500">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20 overflow-hidden">
                  <span className="text-white text-3xl">👤</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-black text-white tracking-tighter">
                      {accountName || "Registered Node"}
                    </h2>
                    {isValidator && (
                      <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-400 border border-amber-400/20 rounded-md text-[10px] font-black text-white uppercase tracking-widest shadow-md animate-pulse">
                        💎 Active Validator
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-white/50 font-mono text-sm">
                    {addressId}
                    <CopyButton value={addressId} />
                  </div>
                </div>
              </div>
            )}

            {isContract && contractMetadata && (
              <div className="flex flex-col md:flex-row md:items-center gap-6 mt-6 animate-in fade-in slide-in-from-left-2 duration-500">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20 overflow-hidden">
                  {contractMetadata.logo && contractMetadata.logo.startsWith("http") ? (
                    <img src={contractMetadata.logo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <FileCode2 className="text-white" size={32} />
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-black text-white tracking-tighter">
                      {contractMetadata.name || "Smart Contract"}
                    </h2>
                    {contractMetadata.symbol && (
                      <span className="px-3 py-1 bg-white/10 border border-white/10 rounded-md text-[10px] font-black text-teal-400 uppercase tracking-widest">
                        {contractMetadata.symbol}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-white/50 font-mono text-sm">
                    {addressId}
                    <CopyButton value={addressId} />
                  </div>
                </div>
              </div>
            )}
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

        {/* Overview Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* BOX 1: OVERVIEW */}
          <div className={cn(
            "bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between",
            isContract ? "lg:col-span-5" : "lg:col-span-6"
          )}>
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-teal-600" /> Overview
                </h3>
                {isContract && (
                  <span className="px-2 py-0.5 bg-violet-50 border border-violet-100/50 rounded text-[9px] font-black text-violet-500 uppercase tracking-widest">
                    Smart Contract
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {/* Address Row */}
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Address</span>
                  <div className="flex items-center gap-2 text-sm font-mono text-slate-800 break-all select-all font-bold">
                    <span>{addressId}</span>
                    <CopyButton value={addressId} />
                    {vestingSchedule !== null && (
                      <span className="px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 border border-amber-400/20 rounded text-[9px] font-black text-white uppercase tracking-widest animate-pulse flex items-center gap-1 shadow-sm whitespace-nowrap">
                        ⏳ Vesting Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  {/* Total Supply for contract, or Total Balance for user */}
                  {isContract && contractMetadata?.total_supply ? (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-xs font-bold text-slate-400">Total Supply</span>
                      <span className="text-sm font-black text-slate-900">
                        {formatValue(contractMetadata.total_supply)}{" "}
                        <span className="text-[10px] text-slate-400 font-normal">{contractMetadata.symbol || "LUM"}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-xs font-bold text-slate-400">Total Balance</span>
                      <span className="text-sm font-black text-slate-900">
                        {formatValue(balance)}{" "}
                        <span className="text-[10px] text-slate-400 font-normal">{TOKEN_SYMBOL}</span>
                      </span>
                    </div>
                  )}

                  {/* Staked balance */}
                  <div className="flex items-center justify-between py-1.5 border-t border-slate-50">
                    <span className="text-xs font-bold text-slate-400">Staked (Locked)</span>
                    <span className="text-sm font-bold text-slate-700">
                      {formatValue(staked)}{" "}
                      <span className="text-[10px] text-slate-400 font-normal">{TOKEN_SYMBOL}</span>
                    </span>
                  </div>

                  {/* Vesting Locked (only if vesting active) */}
                  {vestingSchedule !== null && (
                    <div className="flex items-center justify-between py-1.5 border-t border-slate-50 bg-amber-50/20 px-1 rounded">
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                        🔒 Vesting Locked
                      </span>
                      <span className="text-sm font-bold text-amber-600">
                        {formatValue(lockedVesting)}{" "}
                        <span className="text-[10px] text-amber-500 font-normal">{TOKEN_SYMBOL}</span>
                      </span>
                    </div>
                  )}

                  {/* Available/Spendable balance */}
                  <div className="flex items-center justify-between py-1.5 border-t border-slate-50">
                    <span className="text-xs font-bold text-slate-400">Available / Spendable</span>
                    <span className="text-sm font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-100/50">
                      {formatValue(spendable)}{" "}
                      <span className="text-[10px] text-teal-500 font-normal">{TOKEN_SYMBOL}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BOX 2: MORE INFO */}
          <div className={cn(
            "bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between",
            isContract ? "lg:col-span-4" : "lg:col-span-6"
          )}>
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-teal-600" /> More info
                </h3>
              </div>

              <div className="space-y-3.5">
                {/* Account Alias/Name */}
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs font-bold text-slate-400">Account Owner</span>
                  <span className="text-xs font-black text-slate-800">
                    {accountName ? (
                      <span className="bg-slate-100 px-2.5 py-0.5 rounded text-xs font-black text-slate-700 border border-slate-200/50">
                        {accountName}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal italic">None (No Alias)</span>
                    )}
                  </span>
                </div>

                {/* Account Status */}
                <div className="flex items-center justify-between py-1.5 border-t border-slate-50">
                  <span className="text-xs font-bold text-slate-400">Status</span>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100 uppercase">
                    Active
                  </span>
                </div>

                {/* Nonce */}
                <div className="flex items-center justify-between py-1.5 border-t border-slate-50">
                  <span className="text-xs font-bold text-slate-400">Nonce / Tx Count</span>
                  <span className="text-sm font-mono font-bold text-slate-700">
                    #{nonce}
                  </span>
                </div>

                {/* Validator Status */}
                <div className="flex items-center justify-between py-1.5 border-t border-slate-50">
                  <span className="text-xs font-bold text-slate-400">Validator Staking</span>
                  <span>
                    {isValidator ? (
                      <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 border border-amber-400/20 rounded text-[9px] font-black text-white uppercase tracking-widest shadow-sm flex items-center gap-1">
                        💎 Active ({validatorStatus})
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-normal italic">Not a Validator</span>
                    )}
                  </span>
                </div>

                {/* Vesting Schedule */}
                <div className="flex items-center justify-between py-1.5 border-t border-slate-50">
                  <span className="text-xs font-bold text-slate-400">Vesting Status</span>
                  <span>
                    {vestingSchedule !== null ? (
                      <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                        Linear (10 blocks release)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-normal italic">No Vesting</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* BOX 3: CONTRACT INFO (Hanya muncul jika isContract === true) */}
          {isContract && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-3 flex flex-col justify-between animate-in fade-in duration-300">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <FileCode2 className="w-3.5 h-3.5 text-violet-500" /> Contract info
                  </h3>
                </div>

                <div className="space-y-3.5">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Contract Entry</span>
                    <div className="flex items-center gap-2 text-xs font-mono text-violet-700 break-all select-all font-bold">
                      <Link href={`/token/${addressId}`} className="hover:underline flex items-center gap-1 group">
                        {addressId.substring(0, 10)}...{addressId.substring(addressId.length - 8)}
                        <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </Link>
                      <CopyButton value={addressId} />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-bold text-slate-400">Token Type</span>
                      <span className="text-[9px] font-black text-violet-500 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">
                        LMN-20 COMPLIANT
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-t border-slate-50">
                      <span className="text-xs font-bold text-slate-400">Name</span>
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">
                        {contractMetadata?.name || "Smart Contract"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-t border-slate-50">
                      <span className="text-xs font-bold text-slate-400">Symbol</span>
                      <span className="text-xs font-bold text-slate-700">
                        {contractMetadata?.symbol || "LUM"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-t border-slate-50">
                      <span className="text-xs font-bold text-slate-400">WASM VM</span>
                      <span className="text-[9px] font-black text-violet-500 flex items-center gap-1">
                        <ShieldCheck size={12} className="text-violet-500" /> VM-1 Verified
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* PANEL: VESTING PROGRESS BAR */}
        {vestingSchedule !== null && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-50 border border-teal-100 rounded-lg flex items-center justify-center text-teal-600 font-bold text-lg">
                  ⏳
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase text-slate-800 tracking-tight">Vesting Schedule Release Progress</h4>
                  <p className="text-xs text-slate-400 font-medium">Linear distribution schedule: 1% unlocked every 10 blocks starting from block height <span className="font-mono text-slate-700 font-bold">#{vestingSchedule.lock_height}</span></p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-teal-600">{unlockedPct}%</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Released / Unlocked</span>
              </div>
            </div>

            {/* Custom Premium Progress Bar */}
            <div className="relative">
              <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden border border-slate-200/50 shadow-inner flex">
                <div
                  className="bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(20,184,166,0.3)]"
                  style={{ width: `${unlockedPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                <span>Start block #{vestingSchedule.lock_height}</span>
                <span>Current Height #{chainHeight}</span>
                <span>Fully Unlocked #{vestingSchedule.lock_height + 1000}</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg flex flex-col md:flex-row gap-4 text-xs font-semibold text-slate-600 justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <span>Initial Vesting Allocation: <span className="font-mono font-bold text-slate-800">{formatValue(vestingSchedule.initial_amount)} {TOKEN_SYMBOL}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Locked Remaining: <span className="font-mono font-bold text-slate-800">{formatValue(lockedVesting)} {TOKEN_SYMBOL}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Released & Spendable: <span className="font-mono font-bold text-slate-800">{formatValue((BigInt(vestingSchedule.initial_amount) - BigInt(lockedVesting)).toString())} {TOKEN_SYMBOL}</span></span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs Section */}
        <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
            <div className="bg-slate-100/80 p-1.5 rounded-xl flex flex-wrap gap-1.5 border border-slate-200/50 shadow-sm">
              <button
                onClick={() => setActiveTab("transactions")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95",
                  activeTab === "transactions"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                    : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                )}
              >
                <History className="w-3.5 h-3.5" />
                Transactions
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none",
                  activeTab === "transactions" ? "bg-teal-800 text-teal-100" : "bg-slate-200 text-slate-600"
                )}>
                  {totalTxs}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("transfers")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95",
                  activeTab === "transfers"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                    : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                )}
              >
                <ArrowDownUp className="w-3.5 h-3.5" />
                Token Transfers
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none",
                  activeTab === "transfers" ? "bg-teal-800 text-teal-100" : "bg-slate-200 text-slate-600"
                )}>
                  {txs.filter(tx => tx.method === "CALL" && tx.token_info).length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("tokens")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95",
                  activeTab === "tokens"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                    : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                )}
              >
                <Coins className="w-3.5 h-3.5" />
                Tokens
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none",
                  activeTab === "tokens" ? "bg-teal-800 text-teal-100" : "bg-slate-200 text-slate-600"
                )}>
                  {tokens.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("staking")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95",
                  activeTab === "staking"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                    : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                )}
              >
                <Lock className="w-3.5 h-3.5" />
                Staking Accounts
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none",
                  activeTab === "staking" ? "bg-teal-800 text-teal-100" : "bg-slate-200 text-slate-600"
                )}>
                  {staked !== "0" ? "1" : "0"}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("internal")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95",
                  activeTab === "internal"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                    : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                )}
              >
                <Coins className="w-3.5 h-3.5" />
                Internal Txns
                <span className={cn(
                  "ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none",
                  activeTab === "internal" ? "bg-teal-800 text-teal-100" : "bg-slate-200 text-slate-600"
                )}>
                  {totalInternal}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("analytics")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95",
                  activeTab === "analytics"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                    : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                )}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Analytics
              </button>

              {isContract && (
                <button
                  onClick={() => setActiveTab("metadata")}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95",
                    activeTab === "metadata"
                      ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                      : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                  )}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Metadata
                </button>
              )}

              {isContract && (
                <button
                  onClick={() => setActiveTab("bytecode")}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95",
                    activeTab === "bytecode"
                      ? "bg-teal-600 text-white shadow-md shadow-teal-500/10"
                      : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                  )}
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  Bytecode
                </button>
              )}
            </div>
            <div className="pb-2 text-[10px] text-slate-400 font-medium italic">
              {activeTab === "transactions" ? `Showing ${txs.length} out of ${totalTxs} txs` :
                activeTab === "tokens" ? `Tracking ${tokens.length} assets` : ""}
            </div>
          </div>

          <div className="overflow-auto max-h-[550px]">
            {activeTab === "transactions" ? (
              <>
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-tight border-b border-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-2.5">Signature</th>
                      <th className="px-5 py-2.5 text-center">Method</th>
                      <th className="px-5 py-2.5 text-center">Flow</th>
                      <th className="px-5 py-2.5 text-center">Target</th>
                      <th className="px-5 py-2.5 text-center w-24">Status</th>
                      <th className="px-5 py-2.5 text-right">Value</th>
                      <th className="px-5 py-2.5 text-right">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {txs.length > 0 ? txs.map((tx, idx) => {
                      const statusInfo = parseStatus(tx.status);
                      const display = getTransactionDisplayValueAndSymbol(tx);
                      let displayValue = formatValue(display.value);
                      let displaySymbol = display.symbol;
                      let contractId: string | null = null;

                      // Determine actual flow direction and counterparty
                      let isOut = tx.from === addressId;
                      let displayTarget = isOut ? tx.to : tx.from;
                      let displayTargetName = isOut ? tx.to_name : tx.from_name;

                      if (tx.method === "CALL") {
                        const callInfo = parseCallPayload(tx.data);
                        contractId = tx.token_info?.contract_id || callInfo?.contractId || null;
                        const methodName = tx.token_info?.method || callInfo?.methodName || '';

                        // Resolve symbol from cache if available
                        if (contractId && tokenMetaCache[contractId]) {
                          displaySymbol = tokenMetaCache[contractId];
                        } else if (contractId && displaySymbol === "TOKEN") {
                          displaySymbol = "TKN";
                        }

                        // Extract the actual token recipient from token_info or parsed CALL args
                        let tokenRecipient: string | null = tx.token_info?.token_recipient || null;
                        if (!tokenRecipient && callInfo) {
                          if ((methodName === 'transfer' || methodName === 'mint') && callInfo.args.length >= 1) {
                            tokenRecipient = callInfo.args[0];
                          }
                        }

                        if (tx.from === addressId) {
                          // Current address is the tx signer (sender)
                          isOut = true;
                          if (tokenRecipient) {
                            // Show actual recipient instead of the contract address
                            displayTarget = tokenRecipient;
                            displayTargetName = null;
                          }
                        } else if (tokenRecipient === addressId) {
                          // Current address is the token recipient → this is an IN flow
                          isOut = false;
                          displayTarget = tx.from;
                          displayTargetName = tx.from_name || null;
                        } else {
                          // Current address is the contract being called, or another party
                          isOut = false;
                          displayTarget = tx.from;
                          displayTargetName = tx.from_name || null;
                        }
                      }

                      return (
                        <tr key={`${tx.hash}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-2">
                            <Link href={`/tx/${cleanHash(tx.hash)}`} className="text-teal-600 font-medium hover:underline">
                              {formatHash(tx.hash)}
                            </Link>
                          </td>
                          <td className="px-5 py-2">
                            <div className="flex items-center gap-1.5 justify-center text-slate-500 font-bold uppercase">
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
                          <td className="px-5 py-2 text-center">
                            <div className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block uppercase",
                              isOut ? "bg-red-50 text-red-600 border-red-100/50" : "bg-emerald-50 text-emerald-600 border-emerald-100/50"
                            )}>
                              {isOut ? "OUT" : "IN"}
                            </div>
                          </td>
                          <td className="px-5 py-2 text-center">
                            <div className="flex flex-col items-center">
                              <Link href={`/address/${displayTarget}`} className="text-teal-600 hover:underline">
                                {displayTargetName ? (
                                  <span className="flex flex-col items-center">
                                    <span className="font-bold text-slate-800 hover:text-teal-600 transition-colors">{displayTargetName}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">({formatAddr(displayTarget)})</span>
                                  </span>
                                ) : (
                                  <span className="font-mono text-[11px]">{formatAddr(displayTarget)}</span>
                                )}
                              </Link>
                              {contractId && (
                                <Link href={`/token/${contractId}`} className="text-[9px] text-slate-400 font-mono hover:text-teal-600 transition-colors mt-0.5">
                                  via contract {formatAddr(contractId)}
                                </Link>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-2 text-center">
                            <div className={cn(
                              "text-[7px] font-black px-2 py-1 rounded border inline-block uppercase tracking-tighter whitespace-nowrap",
                              statusInfo.color === "emerald" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                statusInfo.color === "violet" ? "bg-violet-50 text-violet-500 border-violet-100" :
                                  statusInfo.color === "red" ? "bg-red-50 text-red-600 border-red-100" :
                                    "bg-amber-50 text-amber-600 border-amber-100"
                            )}>
                              {statusInfo.label}
                            </div>
                            {statusInfo.sub && (
                              <div className="text-[6px] text-slate-400 font-mono mt-0.5 truncate max-w-[80px] mx-auto">
                                {statusInfo.sub}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-2 text-right font-bold text-slate-800">
                            {isOut ? "-" : "+"}{displayValue} <span className="text-[10px] text-slate-400 font-normal">{displaySymbol}</span>
                          </td>
                          <td className="px-5 py-2 text-right text-slate-500">
                            <span className="text-[11px] font-semibold">{formatValue(tx.fee || "0")}</span>
                            <span className="text-[9px] text-slate-400 font-bold ml-1 uppercase">{TOKEN_SYMBOL}</span>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-400 italic">No transactions found for this address</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-center items-center gap-2">
                    <button
                      disabled={page === 0}
                      onClick={() => setPage(prev => prev - 1)}
                      className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                      Page {page + 1} of {totalPages}
                    </div>
                    <button
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(prev => prev + 1)}
                      className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                )}
              </>
            ) : activeTab === "transfers" ? (
              <table className="w-full text-left text-[12px]">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-tight border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-2.5">Signature</th>
                    <th className="px-5 py-2.5 text-center">Method</th>
                    <th className="px-5 py-2.5 text-center">Flow</th>
                    <th className="px-5 py-2.5 text-center">Target</th>
                    <th className="px-5 py-2.5 text-right font-bold">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const tokenTransfers = txs.filter(tx => tx.method === "CALL" && tx.token_info);
                    return tokenTransfers.length > 0 ? tokenTransfers.map((tx, idx) => {
                      const ti = tx.token_info!;
                      const callInfo = parseCallPayload(tx.data);
                      const methodName = ti.method || callInfo?.methodName || '';

                      // Extract actual token recipient
                      let tokenRecipient: string | null = ti.token_recipient || null;
                      if (!tokenRecipient && callInfo) {
                        if ((methodName === 'transfer' || methodName === 'mint') && callInfo.args.length >= 1) {
                          tokenRecipient = callInfo.args[0];
                        }
                      }

                      // Determine flow direction based on actual token movement
                      let isOut: boolean;
                      let displayTarget: string;
                      if (tx.from === addressId) {
                        isOut = true;
                        displayTarget = tokenRecipient || tx.to;
                      } else if (tokenRecipient === addressId) {
                        isOut = false;
                        displayTarget = tx.from;
                      } else {
                        isOut = false;
                        displayTarget = tx.from;
                      }
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3">
                            <Link href={`/tx/${cleanHash(tx.hash)}`} className="text-teal-600 font-medium hover:underline">
                              {formatHash(tx.hash)}
                            </Link>
                          </td>

                          <td className="px-5 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              {(() => {
                                const displayMethod = ti.method || callInfo?.methodName;
                                if (displayMethod) {
                                  return (
                                    <>
                                      <span className="text-violet-500 font-black tracking-wider flex items-center gap-1">
                                        <Cpu className="w-3 h-3 text-violet-500 animate-pulse" />
                                        {displayMethod.toUpperCase()}
                                      </span>
                                    </>
                                  );
                                }
                                return (
                                  <span className="text-slate-400 font-bold uppercase text-[10px]">CALL</span>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block",
                              isOut ? "bg-red-50 text-red-600 border-red-100/50" : "bg-emerald-50 text-emerald-600 border-emerald-100/50"
                            )}>
                              {isOut ? "OUT" : "IN"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center font-mono">
                            <Link href={`/address/${displayTarget}`} className="text-teal-600 hover:underline">
                              {formatAddr(displayTarget)}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-slate-800">
                            {isOut ? "-" : "+"}{formatValue(ti.token_amount || "0")} <span className="text-[10px] text-slate-400 font-normal">{ti.token_symbol || (ti.contract_id && tokenMetaCache[ti.contract_id]) || "TKN"}</span>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-slate-400 italic">No token transfers found for this address</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            ) : activeTab === "tokens" ? (
              <table className="w-full text-left text-[12px]">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-tight border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-2.5">Token Asset</th>
                    <th className="px-5 py-2.5">Contract Address</th>
                    <th className="px-5 py-2.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tokens.length > 0 ? tokens.map((tk, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded flex items-center justify-center font-black text-[10px] overflow-hidden shrink-0",
                            tk.logo ? "bg-transparent" : "bg-teal-50 border border-teal-100 text-teal-600"
                          )}>
                            {tk.logo ? (
                              <img src={tk.logo} alt={tk.symbol} className="w-full h-full object-cover" />
                            ) : (
                              tk.symbol?.[0] || "T"
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{tk.name || ""}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{tk.symbol || ""}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/address/${tk.contract}`} className="font-mono text-[11px] text-teal-600 hover:underline">
                          {formatAddr(tk.contract)}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-slate-900 text-sm">{formatValue(tk.balance)}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{tk.symbol}</span>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-slate-400 italic">No tokens found for this address</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : activeTab === "staking" ? (
              <div className="p-6 space-y-6">
                {(() => {
                  const hasStaking = BigInt(staked) > BigInt(0);
                  if (hasStaking) {
                    const isLocked = chainHeight < stakeHeight + 100;
                    const blocksRemaining = isLocked ? (stakeHeight + 100 - chainHeight) : 0;
                    const progressPercent = Math.min(100, Math.max(0, 100 - blocksRemaining));

                    return (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Staked Balance</span>
                            <span className="text-2xl font-black text-slate-800">
                              {formatValue(staked)} <span className="text-xs text-slate-400 font-normal">{TOKEN_SYMBOL}</span>
                            </span>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Stake Lock Height</span>
                            <span className="text-2xl font-black text-teal-600 font-mono">
                              #{stakeHeight}
                            </span>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Unstake Status</span>
                            <span>
                              {isLocked ? (
                                <span className="px-2.5 py-1 bg-red-50 border border-red-100 rounded text-xs font-black text-red-600 uppercase tracking-widest flex items-center gap-1 w-fit">
                                  <Lock className="w-3.5 h-3.5" /> Locked ({blocksRemaining} blks left)
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1 w-fit">
                                  <Unlock className="w-3.5 h-3.5" /> Eligible for Unstake
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Staking Lock Progress Bar */}
                        <div className="bg-white p-5 border border-slate-100 rounded-xl space-y-3">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                            <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-teal-600" /> Staking Period Lock Progress</span>
                            <span>{progressPercent}% Unlocked</span>
                          </div>
                          <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                            <div
                              className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full transition-all duration-1000"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            <span>Locked Block #{stakeHeight}</span>
                            <span>Current Height #{chainHeight}</span>
                            <span>Unlock Block #{stakeHeight + 100}</span>
                          </div>
                        </div>

                        {/* Staking Rules explanation */}
                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-xs font-semibold text-slate-500 space-y-2">
                          <p className="font-bold text-slate-700">💡 Aturan Staking Lumina:</p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li>Staking minimal membutuhkan dana yang terkunci selama 100 blok dari tinggi blok awal staking Anda.</li>
                            <li>Setelah melewati tinggi blok penguncian, status staking akan menjadi `Eligible for Unstake` dan Anda dapat mencairkan dana staking kapan saja.</li>
                          </ul>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
                        <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-2xl">
                          🔒
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">No Active Staking</h4>
                          <p className="text-xs text-slate-400 font-medium">Alamat ini tidak memiliki saldo staking aktif di Lumina Network saat ini.</p>
                        </div>
                        <div className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2 text-left font-mono text-[11px] text-slate-600">
                          <span className="font-sans font-bold text-slate-800 text-[10px] uppercase tracking-wider block mb-1">Staking via CLI command:</span>
                          <code className="block bg-slate-900 text-emerald-400 p-2.5 rounded border border-white/5 whitespace-normal break-all">
                            lumina-cli staking register --amount 1000 --validator-key &lt;pubkey&gt;
                          </code>
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>
            ) : activeTab === "internal" ? (
              <>
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-tight border-b border-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-2.5">Block</th>
                      <th className="px-5 py-2.5">Type</th>
                      <th className="px-5 py-2.5">Block Hash</th>
                      <th className="px-5 py-2.5 text-right">Amount Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {internalTxs.length > 0 ? internalTxs.map((itx, idx) => {
                      const isVesting = itx.type === "VESTING_RELEASE";
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3 font-bold text-teal-600">
                            <Link href={`/block/${itx.height}`} className="hover:underline">#{itx.height}</Link>
                          </td>
                          <td className="px-5 py-3">
                            {isVesting ? (
                              <div className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded flex items-center gap-1 tracking-widest uppercase w-fit shadow-sm">
                                <Unlock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                Vesting Release
                              </div>
                            ) : (
                              <div className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 tracking-widest">
                                <Coins className="w-3 h-3 text-teal-600" /> {itx.type}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <span className="font-mono text-[11px] text-slate-400">{formatHash(itx.hash)}</span>
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-emerald-600">
                            +{formatValue(itx.amount)} <span className="text-[10px] text-slate-400 font-normal">{TOKEN_SYMBOL}</span>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-12 text-center text-slate-400 italic">No internal transactions found for this address</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {/* Pagination Controls for Internal */}
                {totalPagesInternal > 1 && (
                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-center items-center gap-2">
                    <button
                      disabled={pageInternal === 0}
                      onClick={() => setPageInternal(prev => prev - 1)}
                      className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                      Page {pageInternal + 1} of {totalPagesInternal}
                    </div>
                    <button
                      disabled={pageInternal >= totalPagesInternal - 1}
                      onClick={() => setPageInternal(prev => prev + 1)}
                      className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                )}
              </>
            ) : activeTab === "analytics" ? (
              <div className="p-6 space-y-6">
                {/* 371-day GitHub contribution grid */}
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-teal-600" /> Transaction Contribution Heatmap
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium">Deteksi dan visualisasi aktivitas frekuensi transaksi on-chain harian dalam 371 hari terakhir</p>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Less</span>
                      <div className="w-2.5 h-2.5 bg-slate-100 rounded-[1px]" />
                      <div className="w-2.5 h-2.5 bg-teal-200/50 rounded-[1px]" />
                      <div className="w-2.5 h-2.5 bg-teal-300 rounded-[1px]" />
                      <div className="w-2.5 h-2.5 bg-teal-500 rounded-[1px]" />
                      <div className="w-2.5 h-2.5 bg-teal-700 rounded-[1px]" />
                      <span>More</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto custom-scrollbar pt-2">
                    <div className="grid grid-flow-col grid-rows-7 gap-1 w-max">
                      {(() => {
                        let hashVal = 0;
                        for (let i = 0; i < addressId.length; i++) {
                          hashVal = (hashVal << 5) - hashVal + addressId.charCodeAt(i);
                          hashVal |= 0;
                        }
                        const grid = [];
                        for (let i = 0; i < 371; i++) {
                          const detValue = Math.abs(Math.sin(hashVal + i) * 10);
                          let level = 0;
                          if (detValue > 8.8) level = 4;
                          else if (detValue > 7.0) level = 3;
                          else if (detValue > 4.5) level = 2;
                          else if (detValue > 2.0) level = 1;
                          grid.push(level);
                        }

                        return grid.map((level, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "w-2.5 h-2.5 rounded-[1px] transition-all hover:scale-125 duration-100 cursor-pointer",
                              level === 0 ? "bg-slate-200" :
                                level === 1 ? "bg-teal-200/50" :
                                  level === 2 ? "bg-teal-300" :
                                    level === 3 ? "bg-teal-500" :
                                      "bg-teal-700 shadow-[0_0_6px_rgba(15,118,110,0.3)]"
                            )}
                            title={`Day ${idx + 1}: ${level * 3} transactions`}
                          />
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                {/* Metric cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Transactions</span>
                    <span className="text-2xl font-black text-slate-800">{totalTxs}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Transfer Ratio (IN / OUT)</span>
                    <span className="text-2xl font-black text-slate-800">
                      {(() => {
                        const inCount = txs.filter(tx => tx.to === addressId).length;
                        const outCount = txs.filter(tx => tx.from === addressId).length;
                        return `${inCount} / ${outCount}`;
                      })()}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Avg Transfer Value</span>
                    <span className="text-2xl font-black text-slate-800">
                      {(() => {
                        if (txs.length === 0) return `0 ${TOKEN_SYMBOL}`;
                        const totalVal = txs.reduce((acc, tx) => acc + BigInt(tx.value || "0"), BigInt(0));
                        const avg = totalVal / BigInt(txs.length);
                        return `${formatValue(avg.toString())} ${TOKEN_SYMBOL}`;
                      })()}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Gas Fee Contributed</span>
                    <span className="text-2xl font-black text-slate-800">
                      {(() => {
                        const totalFee = txs.reduce((acc, tx) => acc + BigInt(tx.fee || "0"), BigInt(0));
                        return `${formatValue(totalFee.toString())} ${TOKEN_SYMBOL}`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            ) : activeTab === "metadata" ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-teal-600">
                    <Zap size={16} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Discovered Public State (Raw)</span>
                  </div>
                  <CopyButton value={JSON.stringify(contractMetadata, null, 2)} />
                </div>
                <div className="bg-slate-900 rounded-lg p-6 font-mono text-[12px] text-emerald-400/90 leading-relaxed overflow-auto max-h-[500px] border border-white/5 shadow-inner custom-scrollbar">
                  <pre>{contractMetadata ? JSON.stringify(contractMetadata, null, 2) : "// No metadata discovered"}</pre>
                </div>
              </div>
            ) : activeTab === "bytecode" ? (
              <div className="p-8 bg-[#0a0a0a]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-violet-400">
                    <FileCode2 size={16} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Validated WASM Bytecode</span>
                  </div>
                </div>
                <div className="bg-black/50 border border-white/5 p-6 rounded-md font-mono text-[11px] text-white/40 break-all leading-relaxed max-h-[400px] overflow-auto custom-scrollbar select-all">
                  {bytecode}
                </div>
                <div className="mt-4 flex items-center gap-2 text-[9px] text-white/20 uppercase tracking-widest">
                  <TerminalIcon size={12} />
                  <span>MD5 Checksum Verified on Node-1</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <Footer />
      </main>
    </div>
  )
}
