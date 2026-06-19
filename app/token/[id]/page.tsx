'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Zap, Activity, Box, Search, ChevronRight, ArrowUpRight,
    ShieldCheck, Cpu, ExternalLink, Wallet, ChevronLeft,
    Coins, Info, Gem, PieChart, Layers, History, Code, Shield,
    ChevronDown, Copy
} from "lucide-react"
import CopyButton from "@/components/CopyButton"
import Footer from "@/components/Footer"
import Navbar from "@/components/Navbar"
import { TOKEN_SYMBOL } from "@/lib/constants"
import { cn, formatHash, formatAddr, formatValue, cleanHash } from "@/lib/utils"
import { fetchRpc } from "@/lib/rpc"

interface TokenTx {
    hash: string;
    from: string;
    to: string;
    value: string;
    method: string;
    status: string;
    timestamp: number;
    data?: string;
    token_info?: {
        contract_id: string;
        method: string;
        token_name?: string;
        token_symbol?: string;
        token_recipient?: string;
        token_amount?: string;
    } | null;
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
}, defaultSymbol: string) {
    if (tx.token_info) {
        const symbol = tx.token_info.token_symbol || defaultSymbol;
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
                        const symbol = tx.token_info?.token_symbol || defaultSymbol;
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
    return { value: tx.value, symbol: "LUM" };
}

export default function TokenDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [tokenData, setTokenData] = useState({
        name: 'LTS-20 Token',
        symbol: 'LTS',
        totalSupply: '0',
        owner: '...',
        decimals: '18',
        holdersCount: 0,
        type: 'Smart Contract',
        logo: ''
    });
    const [txs, setTxs] = useState<TokenTx[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [abi, setAbi] = useState<any[]>([]);
    const [bytecode, setBytecode] = useState("");
    const [activeTab, setActiveTab] = useState<'txs' | 'events' | 'contract'>('txs');
    const [contractSubTab, setContractSubTab] = useState<'code' | 'read' | 'write'>('code');
    const [readResults, setReadResults] = useState<Record<string, any>>({});
    const [readInputs, setReadInputs] = useState<Record<string, string>>({});
    const [isCalling, setIsCalling] = useState<Record<string, boolean>>({});
    const [expandedFunc, setExpandedFunc] = useState<string | null>(null);

    // Lumina Wallet Extension Integration states
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [walletBalance, setWalletBalance] = useState<string>("0.000000");
    const [writeInputs, setWriteInputs] = useState<Record<string, string>>({});
    const [isWriting, setIsWriting] = useState<Record<string, boolean>>({});
    const [writeResults, setWriteResults] = useState<Record<string, string>>({});

    const updateBalance = async (addr: string) => {
        if (!window.lumina) return;
        try {
            const balanceRaw = await window.lumina.request({
                method: 'lumina_getBalance',
                params: { address: addr }
            });
            const balanceLUM = parseFloat(balanceRaw) / 1e18;
            setWalletBalance(balanceLUM.toLocaleString('id-ID', { minimumFractionDigits: 6, maximumFractionDigits: 6 }));
        } catch (e: any) {
            console.error("Gagal mengambil saldo:", e.message);
        }
    };

    // Auto-detect extension wallet on mount
    useEffect(() => {
        if (window.lumina) {
            const currentAddr = window.lumina.getAddress();
            if (currentAddr) {
                setWalletAddress(currentAddr);
                updateBalance(currentAddr);
            }
            const handleAccountsChanged = (accounts: any) => {
                const addr = accounts[0] || null;
                setWalletAddress(addr);
                if (addr) {
                    updateBalance(addr);
                } else {
                    setWalletBalance("0.000000");
                }
            };
            window.lumina.on('accountsChanged', handleAccountsChanged);
            return () => {
                if (window.lumina) {
                    window.lumina.removeListener('accountsChanged', handleAccountsChanged);
                }
            };
        }
    }, []);

    const connectWallet = async () => {
        if (!window.lumina) {
            alert("Lumina Wallet Extension not detected! Please install or sideload the extension.");
            return;
        }
        try {
            const accounts = await window.lumina.request({ method: 'lumina_requestAccounts' });
            const connectedAddr = accounts[0];
            setWalletAddress(connectedAddr);
            updateBalance(connectedAddr);
        } catch (err: any) {
            alert(`Connection rejected: ${err.message}`);
        }
    };

    const callWriteFunction = async (method: string, inputs: any[]) => {
        if (!window.lumina || !walletAddress) {
            alert("Please connect your wallet first!");
            return;
        }
        setIsWriting(prev => ({ ...prev, [method]: true }));
        try {
            // Collect the inputs
            const args = inputs.map(input => writeInputs[`${method}_${input.name}`] || "");

            // Format as CALL:<contractAddress>:<methodName>:<arg1>,<arg2>,...
            const payloadData = `CALL:${params.id}:${method}:${args.join(',')}`;
            const dataBytes = Array.from(new TextEncoder().encode(payloadData));

            const resultHash = await window.lumina.request({
                method: 'lumina_sendTransaction',
                params: {
                    to: params.id as string,
                    amount: "0",
                    data: dataBytes
                }
            });

            setWriteResults(prev => ({ ...prev, [method]: resultHash }));

            // Refresh balance shortly after transaction submission
            setTimeout(() => updateBalance(walletAddress), 3000);
        } catch (e: any) {
            alert(`Transaction failed: ${e.message}`);
        } finally {
            setIsWriting(prev => ({ ...prev, [method]: false }));
        }
    };

    // State untuk Search Bar
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchQuery.trim()) return
        router.push(`/search?q=${searchQuery.trim()}`)
    }

    const callReadFunction = async (method: string, args: string[] = []) => {
        setIsCalling(prev => ({ ...prev, [method]: true }));
        try {
            const queryString = args.length > 0 ? `?args=${args.join(',')}` : '';
            const res = await fetchRpc(`/contract/${params.id}/call/${method}${queryString}`);
            const data = await res.json();
            setReadResults(prev => ({ ...prev, [method]: data }));
        } catch (e) {
            setReadResults(prev => ({ ...prev, [method]: "Error calling function" }));
        } finally {
            setIsCalling(prev => ({ ...prev, [method]: false }));
        }
    };

    useEffect(() => {
        const fetchTokenData = async () => {
            setLoading(true);
            try {
                // KITA PANGGIL METADATA AGGREGATOR (SMARTER RPC)
                const [metaRes, txsRes, eventsRes] = await Promise.all([
                    fetchRpc(`/contract/${params.id}/metadata`),
                    fetchRpc(`/txs/${params.id}?page=0&limit=10`),
                    fetchRpc(`/contract/${params.id}/events`)
                ]);

                const metaData = await metaRes.json();
                const tData = await txsRes.json();
                const eData = await eventsRes.json();

                const meta = metaData.metadata || {};

                // Fetch dynamic live total supply from node
                let liveSupply = meta.total_supply || '0';
                try {
                    const supplyRes = await fetchRpc(`/contract/${params.id}/call/total_supply`);
                    const supplyData = await supplyRes.json();
                    if (supplyData && supplyData.result && !supplyData.error) {
                        liveSupply = supplyData.result;
                    }
                } catch (e) {
                    console.error("Gagal mengambil live total supply:", e);
                }

                let tokenName = meta.name;
                let tokenSymbol = meta.symbol;
                let tokenDecimals = meta.decimals;

                if (!tokenName || tokenName === 'Unknown Token') {
                    try {
                        const nameRes = await fetchRpc(`/contract/${params.id}/call/name`);
                        const nameData = await nameRes.json();
                        if (nameData && nameData.result && !nameData.error) {
                            tokenName = nameData.result;
                        }
                    } catch {}
                }
                if (!tokenSymbol || tokenSymbol === 'Unknown' || tokenSymbol === 'SC') {
                    try {
                        const symRes = await fetchRpc(`/contract/${params.id}/call/symbol`);
                        const symData = await symRes.json();
                        if (symData && symData.result && !symData.error) {
                            tokenSymbol = symData.result;
                        }
                    } catch {}
                }
                if (!tokenDecimals) {
                    try {
                        const decRes = await fetchRpc(`/contract/${params.id}/call/decimals`);
                        const decData = await decRes.json();
                        if (decData && decData.result && !decData.error) {
                            tokenDecimals = decData.result;
                        }
                    } catch {}
                }

                setTokenData({
                    name: tokenName || 'Standard LTS-20 Token',
                    symbol: tokenSymbol || 'TKN',
                    totalSupply: liveSupply,
                    owner: meta.owner || '...',
                    decimals: tokenDecimals || '18',
                    holdersCount: 1,
                    type: metaData.contract_type || 'Smart Contract',
                    logo: meta.logo || ''
                });

                setTxs(tData.transactions || []);
                setEvents(eData.events || []);
                setAbi(metaData.abi || []);

                // Fetch Bytecode separately and EXTRACT ABI (Code-as-Truth)
                try {
                    const bcRes = await fetchRpc(`/contract/${params.id}/bytecode`);
                    const bcData = await bcRes.json();
                    const hexBytecode = bcData.bytecode || "";
                    setBytecode(hexBytecode);

                    if (hexBytecode) {
                        const bytes = new Uint8Array(hexBytecode.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));

                        // WASM Parser Sederhana untuk mencari Custom Section "lumina_abi"
                        let offset = 8; // Lewati WASM Header
                        let foundAbi = null;

                        const readVarUint = (data: Uint8Array, start: number) => {
                            let result = 0;
                            let shift = 0;
                            let pos = start;
                            while (true) {
                                let byte = data[pos++];
                                result |= (byte & 0x7f) << shift;
                                if ((byte & 0x80) === 0) break;
                                shift += 7;
                            }
                            return { value: result, bytesRead: pos - start };
                        };

                        while (offset < bytes.length) {
                            const sectionId = bytes[offset++];
                            const { value: sectionSize, bytesRead: sizeLen } = readVarUint(bytes, offset);
                            offset += sizeLen;

                            if (sectionId === 0) { // Custom Section
                                const sectionStart = offset;
                                const { value: nameLen, bytesRead: nameLenLen } = readVarUint(bytes, offset);
                                offset += nameLenLen;

                                const name = new TextDecoder().decode(bytes.slice(offset, offset + nameLen));
                                offset += nameLen;

                                if (name === "lumina_abi") {
                                    const contentSize = sectionSize - (offset - sectionStart);
                                    const abiJson = new TextDecoder().decode(bytes.slice(offset, offset + contentSize));
                                    foundAbi = JSON.parse(abiJson);
                                    console.log("💎 Code-as-Truth: Rich ABI Extracted from WASM!");
                                    break;
                                }
                                offset = sectionStart + sectionSize; // Skip custom section if not ours
                            } else {
                                offset += sectionSize;
                            }
                        }

                        if (foundAbi) {
                            setAbi(foundAbi.functions || foundAbi);
                        } else {
                            setAbi(metaData.abi || []);
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch/parse bytecode for ABI extraction:", e);
                    setAbi(metaData.abi || []);
                }
            } catch (err) {
                console.error("Failed to fetch token data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchTokenData();
    }, [params.id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f6f6f6] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">
            <Navbar />

            <div className="relative z-10">
                <div className="animate-hero-bg relative pt-6 pb-8 border-b border-white/5">
                    <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(#512da8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                    <div className="max-w-[1400px] mx-auto px-4 relative z-10 space-y-4">
                        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                            Lumina <span className="text-teal-400 uppercase text-xs tracking-widest">{tokenData.type.includes('Token') ? 'Token Detail' : 'Contract Detail'}</span>
                        </h1>

                        <form onSubmit={handleSearch} className="max-w-2xl relative group z-30">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by Address / Signature / Block"
                                className="w-full bg-white/10 border border-white/10 rounded-md py-2 px-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 transition-all"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        </form>

                        <div className="flex flex-col md:flex-row md:items-center gap-6 mt-6">
                            <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20 overflow-hidden">
                                {tokenData.logo && tokenData.logo.startsWith("http") ? (
                                    <img src={tokenData.logo} alt="Token Logo" className="w-full h-full object-cover" />
                                ) : (
                                    tokenData.type.includes('Token') ? <Gem className="text-white" size={32} /> : <Code className="text-white" size={32} />
                                )}
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-3xl font-black text-white tracking-tighter">{tokenData.name}</h2>
                                    {tokenData.type.includes('Token') && (
                                        <span className="px-3 py-1 bg-white/10 border border-white/10 rounded-md text-[10px] font-black text-teal-400 uppercase tracking-widest">
                                            {tokenData.symbol}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-white/50 font-mono text-sm">
                                    {params.id}
                                    <CopyButton value={params.id as string} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-[1400px] mx-auto px-4 -mt-4 relative space-y-3 z-40 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="bg-white p-5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Contract Authority</span>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-50 rounded border border-slate-100 flex items-center justify-center">
                                    <ShieldCheck className="text-teal-600" size={20} />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Owner Address</span>
                                    <Link href={`/address/${tokenData.owner}`} className="text-[13px] font-mono text-teal-600 hover:underline truncate">
                                        {tokenData.owner}
                                    </Link>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Standard</span>
                            <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">LTS-20</span>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-md border border-slate-200 shadow-sm lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {tokenData.type.includes('Token') ? (
                            <>
                                <div className="flex flex-col justify-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Supply</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-slate-900 tracking-tighter">{formatValue(tokenData.totalSupply)}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{tokenData.symbol}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center border-l border-slate-50 pl-6">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Transfers</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-slate-900 tracking-tighter">{txs.length}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">TXS</span>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center border-l border-slate-50 pl-6">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Decimals</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-slate-900 tracking-tighter">{tokenData.decimals}</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="md:col-span-3 flex items-center gap-4 py-2">
                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                                    <Layers className="text-amber-600" size={24} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900">Program Logic / DApp</h4>
                                    <p className="text-xs text-slate-500">This contract does not appear to be a standard token. It may be a DeFi protocol, marketplace, or other logic.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 pt-3 border-b border-slate-100 flex gap-8 bg-slate-50/30">
                        <button
                            onClick={() => setActiveTab('txs')}
                            className={cn(
                                "pb-2.5 text-[12px] font-bold transition-all relative uppercase tracking-widest",
                                activeTab === 'txs' ? "text-teal-600 border-b-2 border-teal-600" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            Recent Transactions
                        </button>
                        <button
                            onClick={() => setActiveTab('events')}
                            className={cn(
                                "pb-2.5 text-[12px] font-bold transition-all relative uppercase tracking-widest",
                                activeTab === 'events' ? "text-teal-600 border-b-2 border-teal-600" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            Events
                        </button>
                        <button
                            onClick={() => setActiveTab('contract')}
                            className={cn(
                                "pb-2.5 text-[12px] font-bold transition-all relative uppercase tracking-widest",
                                activeTab === 'contract' ? "text-teal-600 border-b-2 border-teal-600" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            Contract Details
                        </button>
                    </div>

                    {activeTab === 'txs' && (
                        <div className="overflow-auto max-h-[500px]">
                            <table className="w-full text-left text-[12px]">
                                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-tight border-b border-slate-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3">TX Hash</th>
                                        <th className="px-6 py-3">From</th>
                                        <th className="px-6 py-3 text-center">Type</th>
                                        <th className="px-6 py-3 text-right">Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {txs.length > 0 ? txs.map((tx, idx) => {
                                        const display = getTransactionDisplayValueAndSymbol(tx, tokenData.symbol);
                                        let displayValue = formatValue(display.value);
                                        let displaySymbol = display.symbol;

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-6 py-3 font-mono">
                                                    <Link href={`/tx/${cleanHash(tx.hash)}`} className="text-teal-600 hover:underline">
                                                        {formatHash(tx.hash)}
                                                    </Link>
                                                </td>
                                                <td className="px-6 py-3 font-mono text-slate-500">
                                                    <Link href={`/address/${tx.from}`} className="hover:text-teal-600 transition-colors">
                                                        {formatAddr(tx.from)}
                                                    </Link>
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    {tx.method === "CALL" ? (() => {
                                                        const callInfo = parseCallPayload(tx.data);
                                                        const displayMethod = tx.token_info?.method || callInfo?.methodName;
                                                        if (displayMethod) {
                                                            return (
                                                                <span className="flex flex-col items-center gap-0.5">
                                                                    <span className="text-violet-500 font-black tracking-wider flex items-center gap-1 text-[9px]">
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
                                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 uppercase tracking-widest">
                                                                CALL
                                                            </span>
                                                        );
                                                    })() : (
                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 uppercase tracking-widest">
                                                            {tx.method || "CALL"}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-right font-bold text-slate-900">
                                                    {displayValue} <span className="text-[10px] text-slate-400 font-normal">{displaySymbol}</span>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No transactions detected for this token</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'events' && (() => {
                        const grouped: Record<string, any[]> = {};
                        events.forEach(event => {
                            const hash = event.tx_hash || "";
                            if (!grouped[hash]) {
                                grouped[hash] = [];
                            }
                            grouped[hash].push(event);
                        });
                        const groupedList = Object.entries(grouped).map(([tx_hash, items]) => ({
                            tx_hash,
                            items
                        }));

                        return (
                            <div className="overflow-auto max-h-[500px]">
                                <table className="w-full text-left text-[12px]">
                                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-tight border-b border-slate-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 w-[180px]">Transaction</th>
                                            <th className="px-6 py-3 w-[150px]">Event Names</th>
                                            <th className="px-6 py-3">Details / Attributes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {groupedList.length > 0 ? groupedList.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-6 py-4 font-mono align-top">
                                                    <Link href={`/tx/${cleanHash(row.tx_hash)}`} className="text-teal-600 hover:underline font-bold">
                                                        {formatHash(row.tx_hash)}
                                                    </Link>
                                                </td>
                                                <td className="px-6 py-4 align-top">
                                                    <div className="flex flex-col gap-1.5">
                                                        {row.items.map((item, i) => (
                                                            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-100 text-teal-700 text-[10px] font-black uppercase tracking-wider w-fit">
                                                                <Zap size={10} className="fill-teal-700" />
                                                                {item.event}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-3">
                                                        {row.items.map((item, i) => (
                                                            <div key={i} className="text-slate-600">
                                                                {item.data ? (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {Object.entries(item.data).map(([k, v]: [string, any]) => (
                                                                            <div key={k} className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                                                                                <span className="font-semibold text-slate-400 uppercase text-[9px] tracking-tight">{k}:</span>
                                                                                <span className="font-mono font-bold text-slate-700">
                                                                                    {typeof v === 'string' && v.startsWith('lumina') ? formatAddr(v) : String(v)}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : item.info ? (
                                                                    <span className="font-mono text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100 block w-full">{item.info}</span>
                                                                ) : item.message ? (
                                                                    <span className="font-mono text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100 block w-full">{item.message}</span>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">No attributes</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">No events detected for this contract</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}

                    {activeTab === 'contract' && (
                        <div className="flex flex-col h-full min-h-[400px]">
                            {/* Sub Tabs */}
                            <div className="px-6 border-b border-slate-100 flex gap-6 bg-slate-50/50">
                                <button
                                    onClick={() => setContractSubTab('code')}
                                    className={cn(
                                        "py-3 text-[11px] font-bold transition-all relative uppercase tracking-wider",
                                        contractSubTab === 'code' ? "text-teal-600 border-b-2 border-teal-600" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Code
                                </button>
                                <button
                                    onClick={() => setContractSubTab('read')}
                                    className={cn(
                                        "py-3 text-[11px] font-bold transition-all relative uppercase tracking-wider",
                                        contractSubTab === 'read' ? "text-teal-600 border-b-2 border-teal-600" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Read Contract
                                </button>
                                <button
                                    onClick={() => setContractSubTab('write')}
                                    className={cn(
                                        "py-3 text-[11px] font-bold transition-all relative uppercase tracking-wider",
                                        contractSubTab === 'write' ? "text-teal-600 border-b-2 border-teal-600" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Write Contract
                                </button>
                            </div>

                            <div className="p-6">
                                {contractSubTab === 'code' && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                                                    <Cpu size={16} className="text-teal-600" />
                                                    Functions (ABI / Exports)
                                                </h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {abi.length > 0 ? abi.map((func, i) => (
                                                        <div key={i} className="group relative">
                                                            <span className={cn(
                                                                "px-3 py-1.5 rounded-md border text-[11px] font-mono flex items-center gap-2 transition-all",
                                                                func.type === 'read'
                                                                    ? "bg-blue-50 border-blue-100 text-blue-700 font-bold"
                                                                    : func.type === 'write'
                                                                        ? "bg-amber-50 border-amber-100 text-amber-700 font-bold"
                                                                        : "bg-slate-50 border-slate-100 text-slate-600"
                                                            )}>
                                                                {func.name}
                                                                {func.type === 'read' && (
                                                                    <span className="text-[8px] bg-blue-200 px-1 rounded uppercase">Read</span>
                                                                )}
                                                                {func.type === 'write' && (
                                                                    <span className="text-[8px] bg-amber-200 px-1 rounded uppercase">Write</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    )) : (
                                                        <span className="text-xs text-slate-400 italic">No public functions found</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                                                    <Shield size={16} className="text-teal-600" />
                                                    Contract Properties
                                                </h3>
                                                <div className="space-y-2">
                                                    <div className="p-3 bg-slate-50/50 rounded-md border border-slate-100 flex justify-between items-center">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Compiler</span>
                                                        <span className="text-[10px] font-mono text-slate-600">Rust / WASM (Lumina SDK v1)</span>
                                                    </div>
                                                    <div className="p-3 bg-slate-50/50 rounded-md border border-slate-100 flex justify-between items-center">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Optimization</span>
                                                        <span className="text-[10px] font-mono text-emerald-600 font-bold">Enabled (O3)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                        <History size={16} className="text-teal-600" />
                                                        Raw Bytecode (WASM Hex)
                                                    </h3>
                                                    <CopyButton value={bytecode} />
                                                </div>
                                                <div className="bg-slate-900 rounded-md p-5 font-mono text-[11px] text-emerald-400/80 leading-relaxed break-all max-h-[300px] overflow-auto border border-white/5 shadow-inner custom-scrollbar">
                                                    {bytecode || "No bytecode found"}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                        <Code size={16} className="text-teal-600" />
                                                        Contract ABI (JSON)
                                                    </h3>
                                                    <CopyButton value={JSON.stringify(abi, null, 2)} />
                                                </div>
                                                <div className="bg-slate-900 rounded-md p-5 font-mono text-[11px] text-teal-400/80 leading-relaxed max-h-[400px] overflow-auto border border-white/5 shadow-inner custom-scrollbar">
                                                    <pre>{abi.length > 0 ? JSON.stringify(abi, null, 2) : "// No ABI discovered"}</pre>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {contractSubTab === 'read' && (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                        {abi.filter(f => (f.type || '').toLowerCase() === 'view' || (f.type || '').toLowerCase() === 'read').map((func: any, i) => {
                                            const isExpanded = expandedFunc === `read_${func.name}`;
                                            return (
                                                <div key={i} className="border-b border-slate-100 last:border-0">
                                                    <button
                                                        onClick={() => setExpandedFunc(isExpanded ? null : `read_${func.name}`)}
                                                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/50 transition-colors text-left group"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-[11px] text-slate-400 font-medium w-4">{i + 1}.</span>
                                                            <span className="text-[13px] font-medium text-slate-600 font-mono group-hover:text-teal-600 transition-colors">{func.name}</span>
                                                            {func.inputs && func.inputs.length > 0 && func.inputs.map((_: any, idx: number) => (
                                                                <span key={idx} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-medium text-slate-500 uppercase tracking-tight">Input</span>
                                                            ))}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-slate-300">
                                                            <Copy size={13} className="hover:text-teal-600 transition-colors cursor-pointer" />
                                                            <ChevronDown size={16} className={cn("transition-transform duration-300", isExpanded ? "rotate-180 text-teal-500" : "group-hover:text-slate-400")} />
                                                        </div>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="px-12 py-6 bg-[#fcfcfd] border-t border-slate-50 space-y-6 animate-in fade-in duration-300">
                                                            {func.description && (
                                                                <div className="flex items-start gap-2">
                                                                    <div className="w-1 h-1 rounded-full bg-teal-400 mt-2 shrink-0" />
                                                                    <p className="text-[12px] text-slate-600 leading-relaxed">{func.description}</p>
                                                                </div>
                                                            )}

                                                            <div className="space-y-4">
                                                                {func.inputs && func.inputs.length > 0 ? func.inputs.map((input: any, idx: number) => (
                                                                    <div key={idx} className="flex flex-col gap-1.5">
                                                                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{input.name} <span className="lowercase font-normal italic opacity-70">({input.type})</span></label>
                                                                        <input
                                                                            type="text"
                                                                            placeholder={`Enter value for ${input.name}...`}
                                                                            className="max-w-md bg-white border border-slate-200 rounded-md px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500/50 transition-all shadow-sm font-mono"
                                                                            onChange={(e) => {
                                                                                const key = `${func.name}_${input.name}`;
                                                                                setReadInputs(prev => ({ ...prev, [key]: e.target.value }));
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )) : (
                                                                    <div className="bg-slate-100/50 border border-slate-200/50 rounded-md p-3 text-center">
                                                                        <p className="text-[11px] text-slate-400 font-medium">No input parameters required for this function.</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-col gap-4 pt-2">
                                                                <button
                                                                    onClick={() => {
                                                                        const args = func.inputs?.map((input: any) => readInputs[`${func.name}_${input.name}`] || "") || [];
                                                                        callReadFunction(func.name, args);
                                                                    }}
                                                                    disabled={isCalling[func.name]}
                                                                    className="w-fit px-8 py-2 bg-white border border-slate-300 rounded-md text-[12px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-teal-600 hover:border-teal-200 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                                >
                                                                    {isCalling[func.name] ? 'Processing...' : 'Query Function'}
                                                                </button>

                                                                {func.name in readResults && (
                                                                    <div className="mt-2 group">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <Activity size={12} className="text-teal-500" />
                                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Result</span>
                                                                        </div>
                                                                        <div className="p-4 bg-slate-900 rounded-lg font-mono text-[13px] text-emerald-400 shadow-xl border border-white/5 break-all">
                                                                            <span className="text-emerald-500/50 mr-2">➔</span>
                                                                            {(() => {
                                                                                const res = readResults[func.name];
                                                                                if (!res) return "No result";
                                                                                if (typeof res === 'string') return res;
                                                                                if (res.error) return <span className="text-red-400">{res.error}</span>;

                                                                                const hasText = res.result && res.result.trim() && !res.result.includes('\u0000');

                                                                                return (
                                                                                    <div className="inline-block">
                                                                                        {hasText && <div className="text-emerald-400 mb-1">{res.result}</div>}
                                                                                        {res.hex && (
                                                                                            <div className={cn("font-mono", hasText ? "text-slate-500 text-[10px]" : "text-emerald-400")}>
                                                                                                {hasText ? `(Hex: ${res.hex})` : `0x${res.hex}`}
                                                                                            </div>
                                                                                        )}
                                                                                        {!hasText && !res.hex && <span className="text-slate-500 italic">Empty response</span>}
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {contractSubTab === 'write' && (
                                    <div className="space-y-6">
                                        {/* Wallet Connection Banner */}
                                        <div className={cn(
                                            "p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all shadow-sm",
                                            walletAddress
                                                ? "bg-emerald-50/50 border-emerald-200/50 text-emerald-900"
                                                : "bg-amber-50/50 border-amber-200/50 text-amber-900"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                                    walletAddress ? "bg-emerald-100" : "bg-amber-100"
                                                )}>
                                                    <Wallet size={20} className={walletAddress ? "text-emerald-600" : "text-amber-600"} />
                                                </div>
                                                <div>
                                                    <h5 className="text-[13px] font-bold">
                                                        {walletAddress ? "Connected to Lumina Wallet" : "Lumina Wallet Disconnected"}
                                                    </h5>
                                                    <p className="text-[11px] opacity-80 font-mono break-all max-w-xl">
                                                        {walletAddress
                                                            ? `${walletAddress} (${walletBalance} LUM)`
                                                            : "Please connect your secure extension wallet to sign write endpoints."
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={connectWallet}
                                                className={cn(
                                                    "px-5 py-2 rounded-md text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 shrink-0 shadow-sm",
                                                    walletAddress
                                                        ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                                                        : "bg-amber-500 hover:bg-amber-400 text-black border border-amber-600"
                                                )}
                                            >
                                                {walletAddress ? "Reconnect" : "Connect Wallet"}
                                            </button>
                                        </div>

                                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                            {abi.filter(f => (f.type || '').toLowerCase() === 'endpoint' || (f.type || '').toLowerCase() === 'write').map((func: any, i) => {
                                                const isExpanded = expandedFunc === `write_${func.name}`;
                                                return (
                                                    <div key={i} className="border-b border-slate-100 last:border-0">
                                                        <button
                                                            onClick={() => setExpandedFunc(isExpanded ? null : `write_${func.name}`)}
                                                            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/50 transition-colors text-left group"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-[11px] text-slate-400 font-medium w-4">{i + 1}.</span>
                                                                <span className="text-[13px] font-medium text-slate-600 font-mono group-hover:text-amber-600 transition-colors">{func.name}</span>
                                                                {func.inputs && func.inputs.length > 0 && func.inputs.map((_: any, idx: number) => (
                                                                    <span key={idx} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-medium text-slate-500 uppercase tracking-tight">Input</span>
                                                                ))}
                                                            </div>
                                                            <div className="flex items-center gap-4 text-slate-300">
                                                                <ChevronDown size={16} className={cn("transition-transform duration-300", isExpanded ? "rotate-180 text-amber-500" : "group-hover:text-slate-400")} />
                                                            </div>
                                                        </button>

                                                        {isExpanded && (
                                                            <div className="px-12 py-6 bg-amber-50/10 border-t border-slate-50 space-y-6">
                                                                <div className={cn("space-y-4 transition-all", !walletAddress && "opacity-50 pointer-events-none")}>
                                                                    {func.inputs && func.inputs.length > 0 ? func.inputs.map((input: any, idx: number) => (
                                                                        <div key={idx} className="flex flex-col gap-1.5">
                                                                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{input.name} <span className="lowercase font-normal italic opacity-70">({input.type})</span></label>
                                                                            <input
                                                                                type="text"
                                                                                placeholder={`Enter ${input.name}...`}
                                                                                className="max-w-md bg-white border border-slate-200 rounded-md px-3 py-2 text-[12px] text-slate-700 font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500/50"
                                                                                onChange={(e) => {
                                                                                    setWriteInputs(prev => ({ ...prev, [`${func.name}_${input.name}`]: e.target.value }));
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    )) : (
                                                                        <div className="bg-slate-100/50 border border-slate-200/50 rounded-md p-3 text-center">
                                                                            <p className="text-[11px] text-slate-400 font-medium">No inputs required.</p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="flex flex-col gap-4 pt-2">
                                                                    <button
                                                                        onClick={() => callWriteFunction(func.name, func.inputs || [])}
                                                                        disabled={isWriting[func.name]}
                                                                        className="w-fit px-8 py-2 bg-amber-500 hover:bg-amber-400 text-black border border-amber-600 rounded-md text-[12px] font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                                    >
                                                                        {isWriting[func.name] ? 'Sending Transaction...' : 'Write/Execute Call'}
                                                                    </button>

                                                                    {func.name in writeResults && (
                                                                        <div className="mt-2 group">
                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                <Activity size={12} className="text-amber-500" />
                                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction Sent</span>
                                                                            </div>
                                                                            <div className="p-4 bg-slate-900 rounded-lg font-mono text-[13px] text-amber-400 shadow-xl border border-white/5 break-all">
                                                                                <span className="text-amber-500/50 mr-2">Hash:</span>
                                                                                <a
                                                                                    href={`/tx/${cleanHash(writeResults[func.name])}`}
                                                                                    className="hover:underline font-bold text-amber-400"
                                                                                >
                                                                                    {writeResults[func.name]}
                                                                                </a>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
