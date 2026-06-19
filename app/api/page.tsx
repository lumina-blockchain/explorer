"use client"

import { Code2, Globe, ShieldCheck, Terminal, Copy, Check, Zap, Cpu, Activity, Clock } from "lucide-react"
import { useState } from "react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import CopyButton from "@/components/CopyButton"

const RPC_ENDPOINTS = [
  { method: "GET", path: "/balance/:address", desc: "Get account balance and nonce", example: "/balance/lumina1..." },
  { method: "GET", path: "/latest_block", desc: "Get information about the most recent block", example: "/latest_block" },
  { method: "GET", path: "/block/:height", desc: "Get block details by height or hash", example: "/block/100" },
  { method: "GET", path: "/tx/:hash", desc: "Get specific transaction details", example: "/tx/0x..." },
  { method: "GET", path: "/txs/:address", desc: "Get transaction history for an address", example: "/txs/lumina1..." },
  { method: "GET", path: "/mempool/recent", desc: "Get list of pending transactions", example: "/mempool/recent" },
  { method: "GET", path: "/network/stats", desc: "Get global network statistics", example: "/network/stats" },
  { method: "POST", path: "/submit", desc: "Submit a signed transaction to the network", example: "{ \"transaction\": ... }" },
]

export default function ApiPage() {
  const [activeTab, setActiveTab] = useState<"public" | "developer">("public")
  const baseUrl = "https://rpc1.bariscode.my.id"

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">
      <Navbar />

      {/* Hero Section */}
      <div className="animate-hero-bg relative pt-12 pb-16">
        <div className="max-w-[1400px] mx-auto px-4 relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-md">
            <Code2 className="w-4 h-4 text-teal-400" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Developer Portal</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
            Lumina <span className="text-teal-400">RPC API</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto font-medium">
            Standardized JSON-RPC endpoints to interact with the Lumina Network. Build wallets, explorers, or dApps with ease.
          </p>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-4 -mt-8 relative z-20 pb-20 space-y-6">
        {/* Connection Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Globe className="w-5 h-5 text-teal-600" /> Public RPC Endpoint
              </h2>
              <p className="text-sm text-slate-500 font-medium tracking-tight">Connect your applications to our high-performance nodes.</p>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 w-full md:w-auto">
              <code className="text-sm font-mono font-bold text-teal-600 truncate">{baseUrl}</code>
              <CopyButton value={baseUrl} />
            </div>
          </div>
        </div>

        {/* API Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-slate-400" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Available Methods</h3>
             </div>
             <span className="bg-teal-50 text-teal-600 text-[10px] font-black px-2 py-1 rounded uppercase border border-teal-100">
                v1.0.0 Stable
             </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 w-24">Method</th>
                  <th className="px-6 py-4">Endpoint Path</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 text-right">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {RPC_ENDPOINTS.map((api, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${api.method === 'POST' ? 'bg-purple-100 text-purple-600 border border-purple-200' : 'bg-emerald-100 text-emerald-600 border border-emerald-200'}`}>
                        {api.method}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">
                      {api.path}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {api.desc}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <code className="bg-slate-100 px-2 py-1 rounded text-[11px] text-slate-400 font-mono">
                         {api.example}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Integration Guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-[#1e293b] rounded-xl p-6 text-white space-y-4 border border-white/5">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-teal-400 flex items-center gap-2">
                 <Zap className="w-4 h-4" /> Quick Integration
              </h4>
              <div className="space-y-4">
                 <p className="text-sm text-slate-400 leading-relaxed font-medium">Use our SDK or direct fetch calls to interact with the chain from any environment.</p>
              <div className="bg-black/40 rounded-lg p-4 font-mono text-xs text-teal-300 leading-relaxed border border-white/5">
                <span className="text-slate-500">// Fetch balance</span><br/>
                const res = await fetch(`{"${baseUrl}/balance/YOUR_ADDRESS"}`);<br/>
                const data = await res.json();<br/>
                console.log(data.balance);
              </div>
              </div>
           </div>

           <div className="bg-white rounded-xl p-6 border border-slate-200 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4 text-teal-600" /> Rate Limits
              </h4>
              <div className="space-y-4">
                 <ul className="space-y-3">
                    {[
                       { label: "Public Tier", val: "100 req/min" },
                       { label: "Developer Tier", val: "10,000 req/min" },
                       { label: "White-label Node", val: "Unlimited" },
                    ].map((limit, i) => (
                       <li key={i} className="flex justify-between items-center border-b border-slate-50 pb-2">
                          <span className="text-[12px] font-bold text-slate-600">{limit.label}</span>
                          <span className="text-[12px] font-black text-slate-900">{limit.val}</span>
                       </li>
                    ))}
                 </ul>
                 <p className="text-[11px] text-slate-400 italic">For high-traffic applications, consider running your own dedicated Lumina Node.</p>
              </div>
           </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
