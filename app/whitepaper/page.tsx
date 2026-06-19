"use client"

import { Shield, Zap, Cpu, Network, Lock, Coins, ArrowRight, BookOpen, Layers, BarChart3, Globe, Code2, ChevronRight, Share2, Download, Terminal, Check, Server, LockKeyhole, Search } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { cn } from "@/lib/utils"

const SECTIONS = [
   { id: "abstract", label: "Abstract", icon: BookOpen },
   { id: "tech", label: "Technical Core", icon: Cpu },
   { id: "consensus", label: "Consensus", icon: Network },
   { id: "tokenomics", label: "Tokenomics", icon: Coins },
   { id: "security", label: "Security", icon: Shield },
]

export default function WhitepaperPage() {
   const symbol = process.env.NEXT_PUBLIC_TOKEN_SYMBOL || "LUM"

   const handleShare = () => {
      if (navigator.share) {
         navigator.share({
            title: 'Lumina Blockchain Whitepaper',
            text: 'Check out the technical blueprint of Lumina Blockchain.',
            url: window.location.href,
         }).catch(console.error);
      } else {
         navigator.clipboard.writeText(window.location.href);
         alert("Link copied to clipboard! 🚀");
      }
   }

   return (
      <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans selection:bg-teal-100 selection:text-teal-900">
         <Navbar />

         {/* Hero Header */}
         <div className="relative pt-24 pb-32 overflow-hidden bg-[#0f172a]">
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-teal-500/20 rounded-full blur-[120px]" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />

            <div className="max-w-[1200px] mx-auto px-4 relative z-10">
               <div className="flex flex-col items-center text-center space-y-6">
                  <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-5 py-2 backdrop-blur-xl">
                     <Shield className="w-4 h-4 text-teal-400" />
                     <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Protocol Specification v1.0</span>
                  </div>
                  <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-[0.9]">
                     Lumina <span className="text-teal-400">Whitepaper</span>
                  </h1>
                  <p className="text-slate-400 max-w-2xl mx-auto font-medium text-lg leading-relaxed">
                     A comprehensive technical deep-dive into the Lumina protocol: High-performance, Rust-native, and built for sub-second finality.
                  </p>
                  <div className="flex gap-4 pt-4">
                     <a
                        href="/whitepaper.html"
                        target="_blank"
                        className="bg-teal-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-teal-400 transition-all shadow-2xl shadow-teal-500/40"
                     >
                        Download PDF <Download className="w-4 h-4" />
                     </a>
                     <button
                        onClick={handleShare}
                        className="bg-white/5 text-white border border-white/10 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all"
                     >
                        Share Study <Share2 className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            </div>
         </div>

         <main className="max-w-[1200px] mx-auto px-4 py-20 grid grid-cols-1 lg:grid-cols-12 gap-16">

            {/* Sidebar Navigation */}
            <div className="lg:col-span-3 hidden lg:block">
               <div className="sticky top-24 space-y-8">
                  <div className="space-y-2">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Contents</h4>
                     <nav className="space-y-1">
                        {SECTIONS.map((s) => (
                           <a
                              key={s.id}
                              href={`#${s.id}`}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-white hover:text-teal-600 transition-all group border border-transparent hover:border-slate-100"
                           >
                              <s.icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                              {s.label}
                           </a>
                        ))}
                     </nav>
                  </div>

                  <div className="bg-[#1e293b] rounded-2xl p-6 text-white shadow-xl shadow-black/20 space-y-4">
                     <Server className="w-8 h-8 text-teal-400 opacity-50" />
                     <h5 className="font-black italic text-lg leading-tight uppercase">Network Status</h5>
                     <p className="text-slate-400 text-[10px] font-medium leading-relaxed">The Lumina network is currently running on Mainnet-1 with 100% uptime.</p>
                     <a href="/nodes" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-teal-400 hover:text-teal-300 transition-all">
                        Check Nodes <ChevronRight className="w-3 h-3" />
                     </a>
                  </div>
               </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-9 space-y-32">

               {/* Section: Abstract */}
               <section id="abstract" className="space-y-6">
                  <div className="inline-flex items-center gap-3 text-teal-600">
                     <BookOpen className="w-6 h-6" />
                     <span className="text-xs font-black uppercase tracking-[0.3em]">01. Abstract</span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">Introduction</h2>
                  <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-6 text-lg">
                     <p>
                        Lumina is a decentralized Layer 1 blockchain built from the ground up using <strong>Rust</strong>, designed to address the "Blockchain Trilemma" by optimizing for extreme performance without sacrificing security or decentralization.
                     </p>
                     <p>
                        In an era where decentralized applications demand the same responsiveness as traditional web platforms, Lumina provides the infrastructure for a seamless transition. By leveraging modern cryptographic primitives like <strong>BLAKE3</strong> for hashing and <strong>Ed25519</strong> for digital signatures, Lumina achieves sub-second finality and the ability to process thousands of transactions per second (TPS) on commodity hardware.
                     </p>
                     <p>
                        Our mission is to enable a new generation of high-frequency DeFi, real-time gaming, and enterprise-grade decentralized solutions that are not hindered by high gas fees or slow confirmation times.
                     </p>
                  </div>
               </section>

               {/* Section: Technical Core */}
               <section id="tech" className="space-y-8">
                  <div className="inline-flex items-center gap-3 text-teal-600">
                     <Cpu className="w-6 h-6" />
                     <span className="text-xs font-black uppercase tracking-[0.3em]">02. Technical Core</span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">System Architecture</h2>

                  <div className="prose prose-slate max-w-none text-slate-600 font-medium mb-12">
                     <p>
                        Lumina is built on a custom asynchronous engine powered by the <strong>Tokio</strong> framework. This allows our nodes to handle massive amounts of concurrent connections (Gossip Protocol) and transaction validations in parallel across all CPU cores.
                     </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-4 hover:shadow-xl hover:border-teal-500/20 transition-all group">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 group-hover:bg-teal-500 group-hover:text-white transition-all">
                           <Terminal className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-black uppercase italic">Rust-Native Engine</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">Unlike many chains that use interpreted VMs, Lumina executes state transitions natively in Rust. This results in minimal memory overhead and zero garbage collection pauses, which is critical for consistent block times.</p>
                     </div>
                     <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-4 hover:shadow-xl hover:border-teal-500/20 transition-all group">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 group-hover:bg-teal-500 group-hover:text-white transition-all">
                           <LockKeyhole className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-black uppercase italic">Advanced Serialization</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">We utilize <strong>Bincode</strong> binary serialization for all on-chain data. Bincode is significantly more compact than JSON or Protobuf, allowing us to fit more transactions into each 2-second block without increasing bandwidth requirements.</p>
                     </div>
                  </div>

                  <div className="bg-[#0f172a] rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl">
                     <div className="absolute top-0 right-0 p-10 opacity-5">
                        <Layers className="w-96 h-96" />
                     </div>
                     <div className="relative z-10 space-y-10">
                        <div>
                           <h4 className="text-xs font-black text-teal-400 uppercase tracking-[0.3em] mb-4">Architecture Visualization</h4>
                           <img src="/arch.png" className="w-full rounded-2xl border border-white/10 shadow-inner" alt="Architecture" />
                        </div>
                        <div className="space-y-4">
                           <h4 className="text-xs font-black text-teal-400 uppercase tracking-[0.3em]">Transaction Lifecycle Flow</h4>
                           <img src="/flow.png" className="w-full rounded-2xl border border-white/10 shadow-inner mb-8" alt="Flow Diagram" />
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                              <div className="text-center space-y-2 p-6 bg-white/5 rounded-2xl border border-white/5">
                                 <div className="text-2xl font-black italic text-teal-400">SIGN</div>
                                 <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Client-side Ed25519 Secure Signing</div>
                              </div>
                              <div className="text-center space-y-2 p-6 bg-white/5 rounded-2xl border border-white/5">
                                 <div className="text-2xl font-black italic text-teal-400">GOSSIP</div>
                                 <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">P2P Network mempool propagation</div>
                              </div>
                              <div className="text-center space-y-2 p-6 bg-white/5 rounded-2xl border border-white/5">
                                 <div className="text-2xl font-black italic text-teal-400">COMMIT</div>
                                 <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Consensus approval & State Update</div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </section>

               {/* Section: Consensus */}
               <section id="consensus" className="space-y-8">
                  <div className="inline-flex items-center gap-3 text-teal-600">
                     <Network className="w-6 h-6" />
                     <span className="text-xs font-black uppercase tracking-[0.3em]">03. Consensus</span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">Proof of Velocity (PoV)</h2>
                  <div className="prose prose-slate max-w-none text-slate-600 font-medium text-lg leading-relaxed space-y-6">
                     <p>
                        Lumina utilizes a custom <strong>Proof of Velocity</strong> consensus mechanism—a variation of Delegated Proof of Stake (DPoS) optimized for throughput.
                     </p>
                     <p>
                        In traditional DPoS, stake weight is the only metric for leader selection. PoV introduces a second metric: <strong>Propagational Velocity</strong>. Validators are continuously measured on how quickly they can verify and gossip blocks. Nodes with higher velocity are given higher priority in the leader rotation, ensuring the network is always driven by its most efficient participants.
                     </p>
                     <p>
                        This "Natural Selection" of nodes creates a self-optimizing network where validators are financially incentivized to upgrade their hardware and bandwidth, directly benefiting the entire ecosystem with faster finality.
                     </p>
                  </div>
               </section>

               {/* Section: Tokenomics */}
               <section id="tokenomics" className="space-y-8">
                  <div className="inline-flex items-center gap-3 text-teal-600">
                     <Coins className="w-6 h-6" />
                     <span className="text-xs font-black uppercase tracking-[0.3em]">04. Tokenomics</span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">{symbol} Utility & Economy</h2>

                  <div className="prose prose-slate max-w-none text-slate-600 font-medium text-lg leading-relaxed mb-8">
                     <p>
                        The {symbol} token is the heartbeat of the Lumina ecosystem. It is used for transaction fees, staking collateral, and protocol governance.
                     </p>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl">
                     <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100">
                           <tr>
                              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Metric</th>
                              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Formal Specification</th>
                           </tr>
                        </thead>
                        <tbody className="text-slate-600 font-medium">
                           <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-5">Dynamic Block Reward</td>
                              <td className="px-8 py-5 font-bold text-slate-900">0.001 - 0.01 {symbol} (Calculated per transaction load)</td>
                           </tr>
                           <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-5">Network Base Fee</td>
                              <td className="px-8 py-5 font-bold text-teal-600">0.00001 {symbol} (Base unit for standard transfers)</td>
                           </tr>
                           <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-5">Fee Adjustment</td>
                              <td className="px-8 py-5 font-bold text-slate-900">Adaptive algorithm based on mempool congestion</td>
                           </tr>
                           <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-5">Leader Bonus</td>
                              <td className="px-8 py-5 font-bold text-blue-600">10% of Block Pool (Incentivizes block production)</td>
                           </tr>
                        </tbody>
                     </table>
                  </div>
               </section>

               {/* Section: Security */}
               <section id="security" className="space-y-8">
                  <div className="inline-flex items-center gap-3 text-teal-600">
                     <Shield className="w-6 h-6" />
                     <span className="text-xs font-black uppercase tracking-[0.3em]">05. Security</span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">Network Integrity</h2>
                  <div className="prose prose-slate max-w-none text-slate-600 font-medium text-lg leading-relaxed space-y-6">
                     <p>
                        Every byte in Lumina is protected by the <strong>BLAKE3</strong> hashing algorithm, which is significantly faster and more secure than traditional SHA-256. BLAKE3's parallelizable design allows validators to verify block integrity across multiple CPU cores simultaneously.
                     </p>
                     <p>
                        Security is further hardened by <strong>Quantum-Resistant considerations</strong> in our P2P stack and the use of the <strong>Ed25519</strong> signature scheme for all wallet operations.
                     </p>
                     <p>
                        Lumina also implements a <strong>Decentralized Slashing</strong> mechanism: any validator attempting to sign two different blocks at the same height (double-signing) will have their entire staked balance permanently revoked and redistributed to honest participants.
                     </p>
                  </div>
               </section>

               <div className="bg-[#111827] rounded-[3rem] p-12 text-white text-center space-y-8 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <Search className="w-16 h-16 mx-auto text-teal-400 animate-pulse" />
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter relative z-10">Still have questions?</h3>
                  <p className="text-slate-400 font-medium max-w-xl mx-auto relative z-10">Read our detailed technical documentation or join our developer community on Discord.</p>
                  <div className="flex justify-center gap-4 relative z-10">
                     <a href="/docs" className="bg-white text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Developer Docs</a>
                     <a href="https://github.com/boomsatu/lumina-blockchain-sdk" target="_blank" className="bg-white/5 text-white border border-white/10 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all">GitHub SDK</a>
                  </div>
               </div>

            </div>
         </main>

         <Footer />
      </div>
   )
}
