"use client"

import { useState, useEffect, useRef } from "react"
import {
  Globe, Activity, ShieldCheck, Zap, Server, Settings,
  RefreshCw, Play, Info, Copy, CheckCircle2, ChevronRight, X, ArrowUpRight
} from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { cn } from "@/lib/utils"

// ============================================================================
// Data Model & Types
// ============================================================================

interface NetworkNode {
  id: string
  name: string
  is_validator: boolean
  wallet_address: string
  badge: string
  timestamp: number
  peer_count: number
  // Sim posisi untuk force-directed layout
  x?: number
  y?: number
  vx?: number
  vy?: number
}

interface NetworkLink {
  source: string
  target: string
}

export default function NetworkTopologyPage() {
  const [telemetryUrl, setTelemetryUrl] = useState("https://telemetry.bariscode.my.id")
  const [wsStatus, setWsStatus] = useState<"CONNECTED" | "DISCONNECTED" | "CONNECTING">("CONNECTING")
  const [nodes, setNodes] = useState<NetworkNode[]>([])
  const [links, setLinks] = useState<NetworkLink[]>([])
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Kontrol simulasi
  const [isSimActive, setIsSimActive] = useState(true)

  const wsRef = useRef<WebSocket | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragNodeRef = useRef<string | null>(null)

  // ============================================================================
  // WebSocket Connection
  // ============================================================================

  const connectTelemetry = (url: string) => {
    if (wsRef.current) {
      wsRef.current.close()
    }

    setWsStatus("CONNECTING")

    // Convert http(s) to ws(s)
    const wsBase = url
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://")
      .replace(/\/$/, "")

    const wsUrl = `${wsBase}/ws`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setWsStatus("CONNECTED")
        console.log("🛰️ Connected to Telemetry WebSocket Server:", wsUrl)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data && Array.isArray(data.nodes)) {
            updateGraphData(data.nodes, data.links || [])
          }
        } catch (e) {
          console.error("Failed to parse telemetry websocket message:", e)
        }
      }

      ws.onerror = (err) => {
        console.warn("Telemetry WebSocket error:", err)
        setWsStatus("DISCONNECTED")
      }

      ws.onclose = () => {
        setWsStatus("DISCONNECTED")
        console.log("🔌 Telemetry WebSocket disconnected")
      }
    } catch (e) {
      setWsStatus("DISCONNECTED")
    }
  }

  // ============================================================================
  // Fetch Data (Manual & On Connect)
  // ============================================================================

  const fetchTelemetryHttp = async (baseUrl: string) => {
    try {
      const cleanUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
      const res = await fetch(`${cleanUrl}/telemetry`, { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const data = await res.json()
        if (data && Array.isArray(data.nodes)) {
          updateGraphData(data.nodes, data.links || [])
          return true
        }
      }
    } catch (err) {
      console.warn("HTTP telemetry fetch failed:", err)
    }
    return false
  }

  // Gabungkan posisi saat ada data baru
  const updateGraphData = (newNodes: NetworkNode[], newLinks: NetworkLink[]) => {
    setNodes((prevNodes) => {
      // Pertahankan koordinat x, y, vx, vy dari node sebelumnya jika ada
      return newNodes.map((node) => {
        const existing = prevNodes.find((n) => n.id === node.id)
        return {
          ...node,
          x: existing?.x ?? Math.random() * 400 + 200,
          y: existing?.y ?? Math.random() * 300 + 150,
          vx: existing?.vx ?? 0,
          vy: existing?.vy ?? 0,
        }
      })
    })
    setLinks(newLinks)
  }

  // Pemicu koneksi otomatis on mount dan polling cadangan
  useEffect(() => {
    connectTelemetry(telemetryUrl)
    fetchTelemetryHttp(telemetryUrl)

    const interval = setInterval(() => {
      fetchTelemetryHttp(telemetryUrl)
    }, 8000) // Polling HTTP setiap 8 detik jika koneksi WS terkendala

    return () => {
      wsRef.current?.close()
      clearInterval(interval)
    }
  }, [telemetryUrl])

  // ============================================================================
  // Force-Directed Layout Simulation (Pure React requestAnimationFrame Loop)
  // ============================================================================

  useEffect(() => {
    if (!isSimActive || nodes.length === 0) return

    let animId: number

    const tick = () => {
      setNodes((prevNodes) => {
        if (prevNodes.length === 0) return prevNodes

        // 1. Inisialisasi salinan posisi
        const updated = prevNodes.map((n) => ({
          ...n,
          x: n.x ?? Math.random() * 400 + 200,
          y: n.y ?? Math.random() * 300 + 150,
          vx: n.vx ?? 0,
          vy: n.vy ?? 0,
        }))

        const width = 800
        const height = 450
        const center = { x: width / 2, y: height / 2 }

        // Gaya parameter
        const gravity = 0.015 // Diperkecil agar node lebih menyebar ke luar
        const repulsion = 100000 // Diperbesar agar gaya tolak-menolak antar node jauh lebih kuat
        const attraction = 0.045 // Gaya tarik disesuaikan
        const friction = 0.82 // Gesekan ditingkatkan untuk meredam goyangan / osilasi
        const idealLength = 160 // Jarak antar link diperpanjang agar tidak tumpang tindih

        // 2. Terapkan Repulsion Force (Gaya tolak-menolak antar node)
        for (let i = 0; i < updated.length; i++) {
          const nodeA = updated[i]
          for (let j = i + 1; j < updated.length; j++) {
            const nodeB = updated[j]

            const dx = nodeB.x! - nodeA.x!
            const dy = nodeB.y! - nodeA.y!
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1) dist = 1; // Cegah pembagian dengan nol

            if (dist < 400) {
              // Capping jarak minimum untuk menghindari lonjakan force yang membuat node melompat keluar
              let forceDist = Math.max(30, dist);
              const force = repulsion / (forceDist * forceDist);
              const fx = (dx / forceDist) * force;
              const fy = (dy / forceDist) * force;

              // Tolak berlawanan arah
              nodeA.vx = (nodeA.vx ?? 0) - fx;
              nodeA.vy = (nodeA.vy ?? 0) - fy;
              nodeB.vx = (nodeB.vx ?? 0) + fx;
              nodeB.vy = (nodeB.vy ?? 0) + fy;
            }
          }
        }

        // 3. Terapkan Attraction Force (Gaya tarik-menarik sepanjang link)
        links.forEach((link) => {
          const sourceNode = updated.find((n) => n.id === link.source)
          const targetNode = updated.find((n) => n.id === link.target)

          if (sourceNode && targetNode) {
            const dx = targetNode.x! - sourceNode.x!
            const dy = targetNode.y! - sourceNode.y!
            const dist = Math.sqrt(dx * dx + dy * dy) || 1

            // Tarik jika lebih panjang dari panjang ideal, dorong jika lebih pendek
            const displacement = dist - idealLength
            const force = displacement * attraction
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force

            sourceNode.vx = (sourceNode.vx ?? 0) + fx
            sourceNode.vy = (sourceNode.vy ?? 0) + fy
            targetNode.vx = (targetNode.vx ?? 0) - fx
            targetNode.vy = (targetNode.vy ?? 0) - fy
          }
        })

        // 4. Terapkan Gravity & Center Force (Gaya tarik ke pusat layar)
        updated.forEach((node) => {
          // Jangan gerakkan node yang sedang di-drag
          if (node.id === dragNodeRef.current) return

          const dx = center.x - node.x!
          const dy = center.y - node.y!

          node.vx = (node.vx ?? 0) + dx * gravity
          node.vy = (node.vy ?? 0) + dy * gravity

          // Update koordinat posisi + gesekan
          node.vx = (node.vx ?? 0) * friction
          node.vy = (node.vy ?? 0) * friction
          node.x = node.x! + node.vx
          node.y = node.y! + node.vy

          // Batasi agar tidak melompat keluar SVG
          node.x = Math.max(25, Math.min(width - 25, node.x))
          node.y = Math.max(25, Math.min(height - 25, node.y))
        })

        return updated
      })

      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(animId)
  }, [links, isSimActive])

  // ============================================================================
  // Interactive Drag & Drop Handlers
  // ============================================================================

  const handleMouseDown = (nodeId: string) => {
    dragNodeRef.current = nodeId
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!dragNodeRef.current || !svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()
    // Konversi koordinat mouse sesuai ukuran SVG viewBox 800x450
    const x = ((e.clientX - rect.left) / rect.width) * 800
    const y = ((e.clientY - rect.top) / rect.height) * 450

    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        if (n.id === dragNodeRef.current) {
          return { ...n, x, y, vx: 0, vy: 0 }
        }
        return n
      })
    )
  }

  const handleMouseUp = () => {
    dragNodeRef.current = null
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getRelativeTime = (timestamp: number) => {
    const diff = Math.floor(Date.now() / 1000 - timestamp)
    if (diff < 3) return "0s ago"
    if (diff < 60) return `${diff}s ago`
    return `${Math.floor(diff / 60)}m ago`
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">
      <Navbar />

      {/* Hero Section */}
      <div className="animate-hero-bg relative pt-12 pb-16 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {/* Floating Neon Orbs */}
        <div className="absolute -top-12 left-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="max-w-[1400px] mx-auto px-4 relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-md">
            <Globe className="w-4 h-4 text-teal-400 animate-spin" style={{ animationDuration: '10s' }} />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">P2P Network Agregation</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
            Network <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Topology</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto font-medium text-sm">
            Visualisasi peta jaringan P2P Lumina secara real-time. Memantau integrasi tanda tangan Ed25519 validator dan topologi peer-to-peer terdistribusi.
          </p>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-4 -mt-8 relative z-20 pb-20 space-y-6">

        {/* TOP STATUS BAR */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Status Telemetry */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center border",
              wsStatus === "CONNECTED" ? "bg-emerald-50 border-emerald-100 text-emerald-600 animate-pulse" :
                wsStatus === "CONNECTING" ? "bg-amber-50 border-amber-100 text-amber-600" :
                  "bg-red-50 border-red-100 text-red-600"
            )}>
              {wsStatus === "CONNECTED" ? <Zap className="w-6 h-6" /> :
                wsStatus === "CONNECTING" ? <RefreshCw className="w-6 h-6 animate-spin" /> :
                  <X className="w-6 h-6" />}
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Telemetry Server</span>
              <span className="text-sm font-black text-slate-800">
                {wsStatus === "CONNECTED" ? "CONNECTED" :
                  wsStatus === "CONNECTING" ? "CONNECTING..." :
                    "DISCONNECTED"}
              </span>
            </div>
          </div>

          {/* Total Nodes */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center font-black">
              {nodes.length}
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Peers</span>
              <span className="text-sm font-black text-slate-800">Active Network Nodes</span>
            </div>
          </div>

          {/* Total Links */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center font-black">
              {links.length}
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Connected Links</span>
              <span className="text-sm font-black text-slate-800">Decentralized P2P Links</span>
            </div>
          </div>

          {/* Total Staked Validators */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[9px] font-black text-teal-500 uppercase tracking-widest block">Validators</span>
              <span className="text-sm font-black text-slate-800">
                {nodes.filter(n => n.is_validator).length} Verified Nodes
              </span>
            </div>
          </div>
        </div>

        {/* SERVER SETTINGS DRAWER & CONFIG PANEL */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Settings className="w-5 h-5 text-slate-400 shrink-0" />
            <div className="w-full">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Telemetry Server Host Address</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={telemetryUrl}
                  onChange={(e) => setTelemetryUrl(e.target.value)}
                  placeholder="e.g. http://127.0.0.1:3009"
                  className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono w-60 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white transition-all text-slate-700 font-bold"
                />
                <button
                  onClick={() => connectTelemetry(telemetryUrl)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-black text-[10px] uppercase tracking-widest px-3 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>

          {/* Simulation controls */}
          <div className="flex items-center gap-3 w-full md:w-auto md:border-l md:border-slate-100 md:pl-6">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Simulation Layout Engine</span>
              <button
                onClick={() => setIsSimActive(!isSimActive)}
                className="mt-1.5 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-600 font-black uppercase tracking-wider px-3.5 py-2 rounded-lg border border-slate-200 transition-colors"
              >
                {isSimActive ? (
                  <>
                    <Play className="w-3 h-3 text-emerald-500 fill-emerald-500 animate-pulse" /> Running
                  </>
                ) : (
                  <>
                    <Info className="w-3 h-3 text-amber-500" /> Frozen (Static)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* CORE INTERACTIVE MAP & DETAILS PANEL */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* MAP CANVAS PANEL */}
          <div className="flex-1 bg-[#0b0f19] rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden h-[500px] flex flex-col">
            {/* Background Grid Accent */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

            {/* Screen border neon line */}
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 opacity-60" />

            {/* Canvas Header overlay */}
            <div className="absolute top-6 left-6 z-10 flex items-center gap-3 bg-slate-900/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full">
              <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping" />
              <span className="text-[10px] font-black text-cyan-400 tracking-[0.22em] uppercase">Interactive P2P Mesh</span>
            </div>

            {/* SVG Visualizer */}
            <svg
              ref={svgRef}
              viewBox="0 0 800 450"
              className="w-full h-full select-none cursor-grab active:cursor-grabbing grow"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* SVG Defs for Glowing Shadows & Markers */}
              <defs>
                <filter id="glow-validator" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glow-node" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="neon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
                </linearGradient>
              </defs>

              {/* Render Links (Lines) */}
              {links.map((link, idx) => {
                const sourceNode = nodes.find((n) => n.id === link.source)
                const targetNode = nodes.find((n) => n.id === link.target)

                if (!sourceNode?.x || !targetNode?.x) return null

                // Cek apakah link ini terhubung ke node yang sedang aktif dipilih
                const isHighlighted = selectedNode &&
                  (sourceNode.id === selectedNode.id || targetNode.id === selectedNode.id)

                return (
                  <line
                    key={idx}
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={isHighlighted ? "#22d3ee" : "url(#neon-grad)"}
                    strokeWidth={isHighlighted ? 2.5 : 1.2}
                    strokeDasharray={isHighlighted ? "none" : sourceNode.is_validator && targetNode.is_validator ? "none" : "4, 4"}
                    opacity={isHighlighted ? 1 : 0.6}
                    className="transition-all duration-300"
                  />
                )
              })}

              {/* Render Nodes (Glow Circles) */}
              {nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id
                const r = node.is_validator ? 18 : 12

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x ?? 400}, ${node.y ?? 225})`}
                    className="cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedNode(node)
                      setIsSidebarOpen(true)
                    }}
                    onMouseDown={() => handleMouseDown(node.id)}
                  >
                    {/* Glowing ring under node */}
                    <circle
                      r={r + (isSelected ? 10 : 6)}
                      fill={node.is_validator ? "#06b6d4" : "#10b981"}
                      opacity={isSelected ? 0.35 : 0.08}
                      filter={node.is_validator ? "url(#glow-validator)" : "url(#glow-node)"}
                      className="group-hover:opacity-30 transition-all duration-300"
                    />

                    {/* Main Node Circle */}
                    <circle
                      r={r}
                      fill={isSelected ? "#ffffff" : node.is_validator ? "#06b6d4" : "#10b981"}
                      stroke={isSelected ? (node.is_validator ? "#06b6d4" : "#10b981") : "#0b0f19"}
                      strokeWidth={isSelected ? 4 : 2}
                      className="transition-all duration-300"
                    />

                    {/* Core icon symbol overlay inside node circle */}
                    {node.is_validator && (
                      <text
                        textAnchor="middle"
                        y="4"
                        fontSize="10"
                        fill={isSelected ? "#082f49" : "#ffffff"}
                        fontWeight="black"
                        className="pointer-events-none select-none font-sans"
                      >
                        💎
                      </text>
                    )}

                    {/* Label Name (Floating text with stroke background for readability) */}
                    <text
                      textAnchor="middle"
                      y={r + 20}
                      fill="none"
                      stroke="#0b0f19"
                      strokeWidth="5"
                      strokeLinejoin="round"
                      fontSize={isSelected ? "11" : "9.5"}
                      fontWeight={isSelected ? "bold" : "bold"}
                      className="pointer-events-none select-none font-mono"
                    >
                      {node.name.length > 18 ? `${node.name.substring(0, 15)}...` : node.name}
                    </text>
                    <text
                      textAnchor="middle"
                      y={r + 20}
                      fill={isSelected ? "#22d3ee" : "#e2e8f0"}
                      fontSize={isSelected ? "11" : "9.5"}
                      fontWeight={isSelected ? "bold" : "bold"}
                      className="pointer-events-none select-none font-mono"
                    >
                      {node.name.length > 18 ? `${node.name.substring(0, 15)}...` : node.name}
                    </text>
                  </g>
                )
              })}
            </svg>

            {/* Hint overlay inside graph */}
            <div className="absolute bottom-6 left-6 z-10 flex items-center gap-6 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-cyan-500 border border-cyan-400" />
                <span>Validator Node</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-400" />
                <span>Edge Peer Node</span>
              </div>
              <div className="text-slate-400/80 italic font-normal">
                * Drag node to adjust layout
              </div>
            </div>
          </div>

          {/* SIDE DETAILS VIEW PANEL */}
          <div className="w-full lg:w-96 flex flex-col gap-4">

            {/* IN-DEPTH NODE SPECIFICATION */}
            {selectedNode ? (
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col animate-in slide-in-from-right-1 duration-200">
                {/* Header detail */}
                <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
                  {/* Glowing background */}
                  <div className={cn(
                    "absolute -right-12 -top-12 w-32 h-32 rounded-full blur-3xl opacity-30",
                    selectedNode.is_validator ? "bg-cyan-500" : "bg-emerald-500"
                  )} />

                  <div className="flex justify-between items-start relative z-10">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      selectedNode.is_validator
                        ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-400"
                        : "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                    )}>
                      {selectedNode.badge}
                    </span>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-xl font-black tracking-tight mt-4 uppercase italic">
                    {selectedNode.name}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono block truncate mt-1">
                    PeerID: {selectedNode.id}
                  </span>
                </div>

                {/* Details list */}
                <div className="p-6 space-y-5 grow">
                  {/* Wallet address */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Wallet Identity</span>
                    {selectedNode.wallet_address !== "Hidden" ? (
                      <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-[11px] font-bold text-slate-700">
                        <span className="break-all select-all pr-1">{selectedNode.wallet_address}</span>
                        <button
                          onClick={() => handleCopy(selectedNode.wallet_address)}
                          className="text-slate-400 hover:text-teal-600 transition-colors cursor-pointer shrink-0"
                        >
                          {copiedId === selectedNode.wallet_address ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic block">🔒 Wallet Hidden (Privacy Enabled)</span>
                    )}
                  </div>

                  {/* Node specifications grid */}
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Connected Peers</span>
                      <span className="text-sm font-black text-slate-800">{selectedNode.peer_count} Neighbors</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Heartbeat Age</span>
                      <span className="text-sm font-black text-slate-800">{getRelativeTime(selectedNode.timestamp)}</span>
                    </div>
                  </div>

                  {/* Connected links set */}
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Active Peer Connections</span>
                    <div className="space-y-1 max-h-32 overflow-auto custom-scrollbar">
                      {links
                        .filter((l) => l.source === selectedNode.id || l.target === selectedNode.id)
                        .map((link, lIdx) => {
                          const neighborId = link.source === selectedNode.id ? link.target : link.source
                          const neighborNode = nodes.find((n) => n.id === neighborId)
                          return (
                            <button
                              key={lIdx}
                              onClick={() => neighborNode && setSelectedNode(neighborNode)}
                              className="w-full text-left flex items-center justify-between text-[11px] font-bold text-teal-600 hover:text-teal-700 bg-slate-50 hover:bg-slate-100/80 transition-colors p-2 rounded-lg border border-slate-100 group"
                            >
                              <span className="truncate pr-4 font-mono">
                                🔗 {neighborNode?.name ?? neighborId.substring(0, 16)}...
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          )
                        })}
                      {links.filter((l) => l.source === selectedNode.id || l.target === selectedNode.id).length === 0 && (
                        <span className="text-xs text-slate-400 italic block">No active connections found</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer specs */}
                <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center gap-2">
                  <ShieldCheck className={cn(
                    "w-4 h-4 shrink-0",
                    selectedNode.is_validator ? "text-cyan-500" : "text-slate-400"
                  )} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {selectedNode.is_validator
                      ? "Verifikasi Tanda Tangan Ed25519 Lulus"
                      : "Node Reporter Unsigned (No Staking)"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center h-[360px] space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                  <Info className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black uppercase text-slate-800 tracking-tight">Select Node</h4>
                  <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                    Click any node inside the topology map to view its real-time telemetry details.
                  </p>
                </div>
              </div>
            )}

            {/* DECENTRALIZED PROTOCOL INFO CARD */}
            <div className="bg-gradient-to-br from-slate-900 to-[#1e293b] rounded-[2rem] p-6 text-white border border-white/5 space-y-3 relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Server className="w-24 h-24 text-white" />
              </div>
              <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-teal-400">Ed25519 Protocol</h4>
              <h3 className="text-base font-black tracking-tight uppercase italic">Secure Verification</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                Validator telemetry data is signed on the node using Ed25519 private keys. The telemetry server validates this signature directly, preventing spoofing without requiring manual validator registration.
              </p>
            </div>

          </div>

        </div>

      </main>

      <Footer />
    </div>
  )
}
