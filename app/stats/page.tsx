"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import {
   Zap, Activity, Clock, ShieldCheck, Cpu, ArrowLeft, Trash2, 
   Layers, AlertTriangle, PlayCircle, RefreshCw, BarChart2
} from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { fetchRpc, getWssUrl } from "@/lib/rpc"
import { cn } from "@/lib/utils"

interface DataPoint {
   timestamp: number
   height: number
   consensusTime: number
   commitTime: number
   blockTime: number
}

export default function StatsPage() {
   const [data, setData] = useState<DataPoint[]>([])
   const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")
   const [timeWindow, setTimeWindow] = useState<5 | 15 | 30 | 60>(60) // in minutes
   const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null)
   const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
   const [isSimulating, setIsSimulating] = useState(false)
   const ws = useRef<WebSocket | null>(null)
   const simInterval = useRef<NodeJS.Timeout | null>(null)

   // Load historical data from localStorage on mount
   useEffect(() => {
      if (typeof window !== "undefined") {
         const stored = localStorage.getItem("lumina_latency_stats")
         if (stored) {
            try {
               const parsed = JSON.parse(stored) as DataPoint[]
               // Filter out entries older than 1 hour on load
               const oneHourAgo = Date.now() - 60 * 60 * 1000
               const valid = parsed.filter(d => d.timestamp > oneHourAgo)
               setData(valid)
            } catch (e) {
               console.error("Failed to parse stored latency stats:", e)
            }
         }
      }
   }, [])

   // Connect to real-time WebSocket
   useEffect(() => {
      const connectWs = () => {
         setWsStatus("connecting")
         ws.current = new WebSocket(getWssUrl())

         ws.current.onopen = () => {
            setWsStatus("connected")
         }

         ws.current.onmessage = (event) => {
            try {
               const msg = JSON.parse(event.data)
               if (msg.type === "new_block") {
                  const now = Date.now()
                  // Active BFT time calculation (eliminating proposal delay of 900ms)
                  const consensusTime = Math.max(1, (msg.consensus_time_ms ?? 901) - 900)

                  const newPoint: DataPoint = {
                     timestamp: now,
                     height: msg.height,
                     consensusTime,
                     commitTime: msg.commit_time_ms ?? 0,
                     blockTime: msg.block_time_ms ?? 1000
                  }

                  addDataPoint(newPoint)
               }
            } catch (e) {
               console.error("Error handling ws message:", e)
            }
         }

         ws.current.onclose = () => {
            setWsStatus("disconnected")
            // Reconnect after 3 seconds
            setTimeout(connectWs, 3000)
         }
      }

      connectWs()
      return () => {
         ws.current?.close()
      }
   }, [])

   // Simulation handler (for local testing/empty state visualization)
   useEffect(() => {
      if (isSimulating) {
         let simHeight = data.length > 0 ? data[data.length - 1].height + 1 : 85000
         simInterval.current = setInterval(() => {
            const now = Date.now()
            
            // Generate realistic values with fluctuating spikes
            const isSpike = Math.random() > 0.85
            const blockTime = isSpike 
               ? Math.floor(Math.random() * 2000) + 1500  // Spike/Stall: 1.5s - 3.5s
               : 1000 + Math.floor(Math.random() * 150 - 75) // Normal: 925ms - 1150ms

            const consensusTime = isSpike
               ? Math.floor(Math.random() * 150) + 80   // Spike: 80ms - 230ms
               : Math.floor(Math.random() * 40) + 15    // Normal: 15ms - 55ms

            const newPoint: DataPoint = {
               timestamp: now,
               height: simHeight++,
               consensusTime,
               commitTime: parseFloat((Math.random() * 0.5 + 0.1).toFixed(2)),
               blockTime
            }

            addDataPoint(newPoint)
         }, 1500)
      } else {
         if (simInterval.current) clearInterval(simInterval.current)
      }

      return () => {
         if (simInterval.current) clearInterval(simInterval.current)
      }
   }, [isSimulating, data])

   const addDataPoint = (point: DataPoint) => {
      setData(prev => {
         const combined = [...prev, point]
         // Filter out points older than 1 hour (3600000 ms)
         const oneHourAgo = Date.now() - 3600 * 1000
         const filtered = combined.filter(d => d.timestamp > oneHourAgo)
         
         // Save to localStorage
         if (typeof window !== "undefined") {
            localStorage.setItem("lumina_latency_stats", JSON.stringify(filtered))
         }
         return filtered
      })
   }

   const handleClearStats = () => {
      if (confirm("Apakah Anda yakin ingin menghapus data statistik lokal?")) {
         setData([])
         if (typeof window !== "undefined") {
            localStorage.removeItem("lumina_latency_stats")
         }
      }
   }

   // Filtering data points based on chosen time window (5, 15, 30, 60 minutes)
   const filteredData = data.filter(d => {
      const cutoff = Date.now() - timeWindow * 60 * 1000
      return d.timestamp > cutoff
   })

   // Aggregate Stats Calculations
   const latestPoint = data.length > 0 ? data[data.length - 1] : null
   
   const avgBlockTime = filteredData.length > 0
      ? Math.round(filteredData.reduce((acc, curr) => acc + curr.blockTime, 0) / filteredData.length)
      : 0
   const maxBlockTime = filteredData.length > 0 
      ? Math.max(...filteredData.map(d => d.blockTime)) 
      : 0
   const avgConsensus = filteredData.length > 0
      ? Math.round(filteredData.reduce((acc, curr) => acc + curr.consensusTime, 0) / filteredData.length)
      : 0
   const avgCommit = filteredData.length > 0
      ? parseFloat((filteredData.reduce((acc, curr) => acc + curr.commitTime, 0) / filteredData.length).toFixed(2))
      : 0
   
   // Percent of block time spike occurrences (> 1500ms, indicating consensus stalls)
   const spikeCount = filteredData.filter(d => d.blockTime > 1500).length
   const spikePercentage = filteredData.length > 0
      ? Math.round((spikeCount / filteredData.length) * 100)
      : 0

   // Custom SVG Chart Drawer Helper
   const renderLineChart = (
      chartData: DataPoint[], 
      valueKey: "blockTime" | "consensusTime",
      colorClass: string,
      fillGradientId: string,
      label: string,
      unit: string,
      minScale: number = 200
   ) => {
      const width = 1000
      const height = 300
      const padding = { top: 20, right: 30, bottom: 40, left: 60 }

      if (chartData.length < 2) {
         return (
            <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 bg-slate-900/10 rounded-xl border border-white/5 border-dashed">
               <AlertTriangle className="w-8 h-8 text-amber-500/70 mb-2 animate-bounce" />
               <span className="text-xs font-bold uppercase tracking-wider">Menunggu Data Lebih Banyak...</span>
               <span className="text-[10px] text-slate-500 mt-1">Harap tunggu kedatangan blok baru atau jalankan simulasi.</span>
            </div>
         )
      }

      // Calculations for scaling
      const values = chartData.map(d => d[valueKey])
      const maxVal = Math.max(...values, minScale)
      const minVal = 0

      const times = chartData.map(d => d.timestamp)
      const minTime = Math.min(...times)
      const maxTime = Math.max(...times)
      const timeSpan = maxTime - minTime || 1

      const graphWidth = width - padding.left - padding.right
      const graphHeight = height - padding.top - padding.bottom

      // Map data to SVG coordinates
      const points = chartData.map((d) => {
         const x = padding.left + ((d.timestamp - minTime) / timeSpan) * graphWidth
         const y = padding.top + graphHeight - ((d[valueKey] - minVal) / (maxVal - minVal)) * graphHeight
         return { x, y, data: d }
      })

      // Construct path string
      let dPath = `M ${points[0].x} ${points[0].y}`
      for (let i = 1; i < points.length; i++) {
         dPath += ` L ${points[i].x} ${points[i].y}`
      }

      // Construct area fill path
      const dArea = `${dPath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`

      // Y-axis gridlines & labels
      const yTicks = 4
      const gridLines = Array.from({ length: yTicks + 1 }).map((_, idx) => {
         const value = Math.round(minVal + (idx / yTicks) * (maxVal - minVal))
         const y = padding.top + graphHeight - (idx / yTicks) * graphHeight
         return { y, value }
      })

      // X-axis ticks (timestamps)
      const xTicksCount = 5
      const xTicks = Array.from({ length: xTicksCount }).map((_, idx) => {
         const time = minTime + (idx / (xTicksCount - 1)) * timeSpan
         const x = padding.left + (idx / (xTicksCount - 1)) * graphWidth
         const date = new Date(time)
         const label = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`
         return { x, label }
      })

      const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
         const rect = e.currentTarget.getBoundingClientRect()
         const svgMouseX = ((e.clientX - rect.left) / rect.width) * width

         let closestIdx = 0
         let minDiff = Infinity

         points.forEach((pt, i) => {
            const diff = Math.abs(pt.x - svgMouseX)
            if (diff < minDiff) {
               minDiff = diff
               closestIdx = i
            }
         })

         if (minDiff < 50) {
            setHoveredPoint(points[closestIdx].data)
            setHoveredIndex(closestIdx)
         } else {
            setHoveredPoint(null)
            setHoveredIndex(null)
         }
      }

      const handleMouseLeave = () => {
         setHoveredPoint(null)
         setHoveredIndex(null)
      }

      return (
         <div className="relative group/chart">
            <svg 
               viewBox={`0 0 ${width} ${height}`} 
               className="w-full h-auto bg-[#1a2235] border border-white/5 rounded-xl shadow-2xl"
               onMouseMove={handleMouseMove}
               onMouseLeave={handleMouseLeave}
            >
               <defs>
                  <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
                     <stop offset="0%" stopColor={colorClass} stopOpacity="0.25" />
                     <stop offset="100%" stopColor={colorClass} stopOpacity="0.00" />
                  </linearGradient>
               </defs>

               {/* Gridlines */}
               {gridLines.map((line, idx) => (
                  <g key={idx}>
                     <line 
                        x1={padding.left} 
                        y1={line.y} 
                        x2={width - padding.right} 
                        y2={line.y} 
                        stroke="rgba(255,255,255,0.04)" 
                        strokeWidth="1"
                     />
                     <text 
                        x={padding.left - 12} 
                        y={line.y + 4} 
                        className="text-[10px] fill-slate-500 font-mono font-bold text-right"
                        textAnchor="end"
                     >
                        {line.value.toLocaleString()}{unit}
                     </text>
                  </g>
               ))}

               {/* X Axis ticks */}
               {xTicks.map((tick, idx) => (
                  <g key={idx}>
                     <line 
                        x1={tick.x} 
                        y1={padding.top} 
                        x2={tick.x} 
                        y2={height - padding.bottom} 
                        stroke="rgba(255,255,255,0.03)"
                        strokeDasharray="2 2"
                     />
                     <text 
                        x={tick.x} 
                        y={height - padding.bottom + 18} 
                        className="text-[9px] fill-slate-500 font-mono font-bold text-center"
                        textAnchor="middle"
                     >
                        {tick.label}
                     </text>
                  </g>
               ))}

               {/* Shaded Area */}
               <path d={dArea} fill={`url(#${fillGradientId})`} />

               {/* Solid Line */}
               <path 
                  d={dPath} 
                  fill="none" 
                  stroke={colorClass} 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
               />

               {/* Data Points hover circle */}
               {hoveredIndex !== null && points[hoveredIndex] && (
                  <g>
                     <line 
                        x1={points[hoveredIndex].x} 
                        y1={padding.top} 
                        x2={points[hoveredIndex].x} 
                        y2={height - padding.bottom} 
                        stroke="rgba(255,255,255,0.15)" 
                        strokeWidth="1.5" 
                        strokeDasharray="3 3"
                     />
                     <circle 
                        cx={points[hoveredIndex].x} 
                        cy={points[hoveredIndex].y} 
                        r="7" 
                        fill={colorClass} 
                        fillOpacity="0.25"
                     />
                     <circle 
                        cx={points[hoveredIndex].x} 
                        cy={points[hoveredIndex].y} 
                        r="4" 
                        fill="#fff" 
                        stroke={colorClass}
                        strokeWidth="2.5"
                     />
                  </g>
               )}
            </svg>

            {/* Hover Tooltip overlay */}
            {hoveredPoint && hoveredIndex !== null && points[hoveredIndex] && (
               <div 
                  className="absolute bg-[#0f172a] border border-white/10 text-white rounded-lg shadow-xl p-3 z-30 pointer-events-none text-xs font-mono w-48 space-y-1.5"
                  style={{
                     left: `${Math.min(
                        (points[hoveredIndex].x / width) * 100, 
                        78
                     )}%`,
                     top: `${Math.min((points[hoveredIndex].y / height) * 100 - 15, 60)}%`
                  }}
               >
                  <div className="font-bold border-b border-white/10 pb-1 text-slate-400">
                     Blok #{hoveredPoint.height.toLocaleString()}
                  </div>
                  <div className="flex justify-between">
                     <span className="text-slate-400">Block Time:</span>
                     <span className="font-bold text-teal-400">{hoveredPoint.blockTime} ms</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-slate-400">Consensus Round:</span>
                     <span className="font-bold text-purple-400">{hoveredPoint.consensusTime} ms</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-slate-400">Engine Commit:</span>
                     <span className="font-bold text-blue-400">{hoveredPoint.commitTime.toFixed(2)} ms</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-1 text-[10px] text-slate-500">
                     <span>Time:</span>
                     <span>{new Date(hoveredPoint.timestamp).toLocaleTimeString()}</span>
                  </div>
               </div>
            )}
         </div>
      )
   }

   return (
      <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans flex flex-col justify-between">
         <div>
            <Navbar />

            {/* Title / Hero */}
            <div className="bg-[#111827] text-white pt-10 pb-12 border-b border-white/5 relative overflow-hidden">
               <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(#2dd4bf 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
               <div className="max-w-[1400px] mx-auto px-4 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  
                  <div className="space-y-2">
                     <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-teal-400 font-bold uppercase tracking-wider hover:text-teal-300 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
                     </Link>
                     <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                        <BarChart2 className="w-7 h-7 text-teal-400" />
                        Block Time & Consensus Stats
                     </h1>
                     <p className="text-xs text-slate-400 font-medium max-w-xl">
                        Memonitor metrik performa blockchain murni dari node. Menampilkan interval block time dan durasi ronde konsensus BFT untuk mendeteksi fluktuasi/spikes pada jaringan P2P.
                     </p>
                  </div>

                  <div className="flex items-center gap-3">
                     {/* Window Selector */}
                     <div className="bg-slate-800/80 border border-white/10 p-0.5 rounded-lg flex items-center shrink-0">
                        {([5, 15, 30, 60] as const).map(w => (
                           <button
                              key={w}
                              onClick={() => setTimeWindow(w)}
                              className={cn(
                                 "px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                                 timeWindow === w 
                                    ? "bg-teal-500 text-slate-950 font-black shadow-md" 
                                    : "text-slate-400 hover:text-white"
                              )}
                           >
                              {w}m
                           </button>
                        ))}
                     </div>

                     {/* WS Status Indicator */}
                     <div className="flex items-center gap-2 bg-slate-800/80 border border-white/10 px-3 py-2 rounded-lg">
                        <div className={cn(
                           "w-2 h-2 rounded-full",
                           wsStatus === "connected" ? "bg-emerald-400 animate-pulse" :
                           wsStatus === "connecting" ? "bg-amber-400 animate-ping" : "bg-red-400"
                        )} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                           {wsStatus}
                        </span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Dashboard Container */}
            <main className="max-w-[1400px] mx-auto px-4 -mt-6 relative z-20 space-y-4 pb-12">
               
               {/* Controls / Options bar */}
               <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alat Diagnostik:</span>
                     <button
                        onClick={() => setIsSimulating(!isSimulating)}
                        className={cn(
                           "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm",
                           isSimulating 
                              ? "bg-amber-100 text-amber-800 border border-amber-300" 
                              : "bg-teal-500 text-slate-950 hover:bg-teal-400"
                        )}
                     >
                        <PlayCircle className="w-3.5 h-3.5" />
                        {isSimulating ? "Stop Simulasi" : "Simulasikan Lalu Lintas"}
                     </button>
                  </div>

                  <button
                     onClick={handleClearStats}
                     disabled={data.length === 0}
                     className="px-3 py-1.5 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                     <Trash2 className="w-3.5 h-3.5" /> Clear Stats
                  </button>
               </div>

               {/* Stats Overviews */}
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                     {
                        label: "Rata-rata Block Time",
                        value: `${avgBlockTime} ms`,
                        sub: `Jendela ${timeWindow}m Terakhir`,
                        icon: Clock,
                        color: "text-teal-600",
                        bg: "bg-teal-50"
                     },
                     {
                        label: "Block Time Terakhir",
                        value: latestPoint ? `${latestPoint.blockTime} ms` : "0 ms",
                        sub: latestPoint ? `Tinggi #${latestPoint.height}` : "No Block Recvd",
                        icon: Activity,
                        color: "text-blue-600",
                        bg: "bg-blue-50"
                     },
                     {
                        label: "Block Time Maksimum",
                        value: `${maxBlockTime} ms`,
                        sub: `Jendela ${timeWindow}m Terakhir`,
                        icon: AlertTriangle,
                        color: maxBlockTime > 1500 ? "text-amber-600" : "text-slate-700",
                        bg: maxBlockTime > 1500 ? "bg-amber-50" : "bg-slate-50"
                     },
                     {
                        label: "Rata-rata Konsensus",
                        value: `${avgConsensus} ms`,
                        sub: "BFT Round Duration",
                        icon: ShieldCheck,
                        color: "text-purple-600",
                        bg: "bg-purple-50"
                     },
                     {
                        label: "Rata-rata Engine Commit",
                        value: `${avgCommit} ms`,
                        sub: "MPT Trie Store Delay",
                        icon: Cpu,
                        color: "text-indigo-600",
                        bg: "bg-indigo-50"
                     },
                     {
                        label: "Rasio Spikes / Stalls",
                        value: `${spikePercentage} %`,
                        sub: `Blok dengan Interval > 1.5s`,
                        icon: AlertTriangle,
                        color: spikePercentage > 15 ? "text-red-600" : "text-emerald-600",
                        bg: spikePercentage > 15 ? "bg-red-50" : "bg-emerald-50"
                     }
                  ].map((stat, idx) => (
                     <div key={idx} className="bg-white border border-slate-200 shadow-sm p-4 rounded-xl flex flex-col justify-between hover:border-slate-300 transition-colors">
                        <div className="flex justify-between items-center mb-1.5">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide leading-tight">{stat.label}</span>
                           <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0", stat.bg)}>
                              <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
                           </div>
                        </div>
                        <div className="text-xl font-black text-slate-900 tracking-tight">{stat.value}</div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase mt-0.5 tracking-wider">{stat.sub}</div>
                     </div>
                  ))}
               </div>

               {/* Charts Block */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Block Time (Interval) Chart */}
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-4">
                     <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                           <Clock className="w-4 h-4 text-teal-500 animate-pulse" />
                           <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Real-time Block Interval Time</h3>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Target: ~1000 ms</span>
                     </div>
                     {renderLineChart(filteredData, "blockTime", "#0d9488", "tealFillGrad", "Block Time", "ms", 1200)}
                  </div>

                  {/* Consensus Round Time Line Chart */}
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-4">
                     <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                           <ShieldCheck className="w-4 h-4 text-purple-500" />
                           <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Consensus Round Duration (BFT)</h3>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Nilai dalam Milidetik (ms)</span>
                     </div>
                     {renderLineChart(filteredData, "consensusTime", "#8b5cf6", "purpleFillGrad", "Consensus Time", "ms", 200)}
                  </div>
               </div>

               {/* Live Blocks Log Table */}
               <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                     <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4 text-teal-600 animate-pulse" /> Log Aliran Blok & Diagnostik Performa Node
                     </h2>
                     <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                        Record Count: {filteredData.length} Blocks
                     </span>
                  </div>
                  
                  <div className="overflow-auto max-h-[350px] custom-scrollbar">
                     <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-tight border-b border-slate-100 sticky top-0 z-10">
                           <tr>
                              <th className="px-4 py-2.5">Tinggi Blok</th>
                              <th className="px-4 py-2.5">Receive Time (UI)</th>
                              <th className="px-4 py-2.5 text-center">Consensus Round</th>
                              <th className="px-4 py-2.5 text-center">Engine Commit</th>
                              <th className="px-4 py-2.5 text-right">Block Interval Status (Node)</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-mono">
                           {filteredData.length === 0 ? (
                              <tr>
                                 <td colSpan={5} className="text-center py-12 text-slate-400 italic">
                                    Belum ada data terkumpul. Hubungkan ke node atau aktifkan "Simulasikan Lalu Lintas" untuk mulai mengumpulkan data.
                                 </td>
                              </tr>
                           ) : (
                              [...filteredData].reverse().map((point, idx) => {
                                 const isHigh = point.blockTime > 1500
                                 const isMedium = point.blockTime > 1200 && point.blockTime <= 1500
                                 return (
                                    <tr key={`${point.height}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                       <td className="px-4 py-2.5 font-bold text-slate-800">
                                          <Link href={`/block/${point.height}`} className="text-teal-600 hover:underline">
                                             #{point.height.toLocaleString()}
                                          </Link>
                                       </td>
                                       <td className="px-4 py-2.5 text-slate-500 font-bold">
                                          {new Date(point.timestamp).toLocaleTimeString()}
                                       </td>
                                       <td className="px-4 py-2.5 text-center text-purple-600 font-bold">
                                          {point.consensusTime.toLocaleString()} ms
                                       </td>
                                       <td className="px-4 py-2.5 text-center text-blue-600 font-bold">
                                          {point.commitTime.toFixed(2)} ms
                                       </td>
                                       <td className="px-4 py-2.5 text-right">
                                          <span className={cn(
                                             "inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded border shadow-sm",
                                             isHigh ? "bg-red-50 text-red-600 border-red-200" :
                                             isMedium ? "bg-amber-50 text-amber-600 border-amber-200" :
                                             "bg-emerald-50 text-emerald-600 border-emerald-200"
                                          )}>
                                             {point.blockTime.toLocaleString()} ms {isHigh ? "⚠️ Stall" : isMedium ? "⚠️ Slow" : "✅ Normal"}
                                          </span>
                                       </td>
                                    </tr>
                                 )
                              })
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>

            </main>
         </div>

         <Footer />
      </div>
   )
}
