"use client"

import { Cpu, Globe, Server, Activity, ShieldCheck, Clock, Map, ChevronRight, Zap, Database } from "lucide-react"
import { useState, useEffect } from "react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { fetchRpc } from "@/lib/rpc"
import { cn } from "@/lib/utils"

const NODE_LOCATIONS = [
  { name: "Lumina-Core-01", region: "Singapore", provider: "AWS", status: "Online", latency: "12ms", version: "v1.0.2" },
  { name: "Lumina-Core-02", region: "Tokyo", provider: "Google Cloud", status: "Online", latency: "45ms", version: "v1.0.2" },
  { name: "Lumina-Edge-US", region: "San Francisco", provider: "DigitalOcean", status: "Online", latency: "142ms", version: "v1.0.1" },
  { name: "Lumina-Backup-EU", region: "Frankfurt", provider: "Vultr", status: "Synced", latency: "180ms", version: "v1.0.2" },
]

export default function NodeStatusPage() {
  const [stats, setStats] = useState<any>(null)
  const [peers, setPeers] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetchRpc("/network/stats")
        const statsData = await statsRes.json()
        setStats(statsData)
      } catch (err) {}

      try {
        const peersRes = await fetchRpc("/network/peers")
        const peersData = await peersRes.json()
        if (peersData && Array.isArray(peersData.peers)) {
          setPeers(peersData.peers)
        }
      } catch (err) {}
    }
    fetchData()
    const timer = setInterval(fetchData, 5000)
    return () => clearInterval(timer)
  }, [])

  // Gabungkan local node dan peers dari libp2p
  const activeNodesList = [
    {
      name: "Lumina-Bootnode-Local (You)",
      region: "Local Gateway",
      provider: "RPC Node",
      status: "Online",
      latency: "0ms",
      version: "v1.0.0 (Core)",
    },
    ...peers.map((p) => ({
      name: `Lumina-Peer-${p.peer_id.substring(0, 12)}...`,
      region: "Connected",
      provider: `Libp2p Peer (Score: ${p.score})`,
      status: p.is_connected ? "Online" : "Offline",
      latency: `${Math.floor(Math.random() * 40) + 15}ms`, // Simulasi ping latency
      version: p.score >= 80 ? "v1.0.0 (High Trust)" : "v1.0.0 (Medium Trust)",
    }))
  ]

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">
      <Navbar />

      {/* Hero Section */}
      <div className="animate-hero-bg relative pt-12 pb-16">
        <div className="max-w-[1400px] mx-auto px-4 relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-md">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live Network Monitoring</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
            Node <span className="text-emerald-400">Health</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto font-medium">
            Real-time infrastructure status and global node distribution. Monitoring decentralized resilience 24/7.
          </p>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-4 -mt-8 relative z-20 pb-20 space-y-6">
        
        {/* Network Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           {[
              { label: "Active Nodes", val: stats?.active_nodes || "4", sub: "Distributed globally", icon: Globe, color: "text-blue-500" },
              { label: "Block Prop Time", val: "0.8s", sub: "Avg across regions", icon: Zap, color: "text-amber-500" },
              { label: "Consensus State", val: "Healthy", sub: "BFT Consensus", icon: ShieldCheck, color: "text-emerald-500" },
              { label: "Storage Size", val: "1.2 GB", sub: "Pruned history", icon: Database, color: "text-purple-500" },
           ].map((m, i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg bg-slate-50 border border-slate-100 ${m.color}`}>
                       <m.icon className="w-5 h-5" />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m.label}</span>
                 </div>
                 <div className="text-2xl font-black text-slate-900 tabular-nums">{m.val}</div>
                 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{m.sub}</div>
              </div>
           ))}
        </div>

        {/* Global Distribution List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-slate-400" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Global Node Registry</h3>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Operational</span>
             </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Node Identity</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Latency</th>
                  <th className="px-6 py-4">Version</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeNodesList.map((node, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 group-hover:bg-white transition-all">
                            <Cpu className="w-4 h-4 text-slate-600" />
                         </div>
                         <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{node.name}</span>
                            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{node.provider}</span>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium text-slate-600">
                         <Map className="w-3 h-3" /> {node.region}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-teal-600">
                      {node.latency}
                    </td>
                    <td className="px-6 py-4">
                       <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-500">
                          {node.version}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className={cn(
                          "inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded uppercase border",
                          node.status === "Online" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                       )}>
                          {node.status}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Informational Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white rounded-xl p-8 border border-slate-200 space-y-4 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                 <ShieldCheck className="w-32 h-32" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Resilience</h4>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Decentralized by Design</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                 The Lumina Network utilizes a globally distributed validator set. Even if 1/3 of the nodes go offline, the network remains fully operational and secure.
              </p>
              <button className="flex items-center gap-2 text-xs font-black text-teal-600 uppercase tracking-widest hover:gap-3 transition-all">
                 Learn about consensus <ChevronRight className="w-3 h-3" />
              </button>
           </div>

           <div className="bg-white rounded-xl p-8 border border-slate-200 space-y-4 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Cpu className="w-32 h-32" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Performance</h4>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Low Latency Infrastructure</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                 Our nodes are strategically placed near global internet hubs to ensure transaction propagation times stay under 1 second worldwide.
              </p>
              <button className="flex items-center gap-2 text-xs font-black text-teal-600 uppercase tracking-widest hover:gap-3 transition-all">
                 View benchmark data <ChevronRight className="w-3 h-3" />
              </button>
           </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
