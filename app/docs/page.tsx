"use client"

import { BookOpen, Code2, Copy, Check, Zap, Cpu, Activity, Terminal, ShieldCheck, Download, ExternalLink, ChevronRight, Wallet, Globe, Key, Send, Network } from "lucide-react"
import { useState } from "react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import CopyButton from "@/components/CopyButton"
import { cn } from "@/lib/utils"
import { TOKEN_SYMBOL } from "@/lib/constants"

const LANGUAGES = [
  { id: "js", label: "Node.js", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" },
  { id: "go", label: "Go", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original-wordmark.svg" },
  { id: "python", label: "Python", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" },
  { id: "rust", label: "Rust", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-original.svg" },
]

const DOC_SECTIONS = [
  { id: "intro", label: "Introduction", icon: BookOpen },
  { id: "install", label: "Installation", icon: Download },
  { id: "wallet", label: "Wallet Management", icon: Wallet },
  { id: "client", label: "RPC Client", icon: Globe },
  { id: "transactions", label: "Sending Txs", icon: Send },
  { id: "staking", label: "Staking & Validators", icon: Network },
]

function CodeSnippet({ code, title, children }: { code: string, title?: string, children: React.ReactNode }) {
   return (
      <div className="bg-[#0f172a] rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative group">
         <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
               <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
               <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20" />
               <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20" />
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">{title || "code"}</span>
            </div>
            <div className="flex items-center gap-2">
               <CopyButton value={code} className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/5 hover:bg-white/10 border-white/5" />
            </div>
         </div>
         <div className="p-6 overflow-x-auto">
            <pre className="text-[13px] font-mono leading-relaxed text-slate-300">
               {children}
            </pre>
         </div>
      </div>
   )
}

export default function DocsPage() {
  const [activeLang, setActiveLang] = useState("js")
  const [activeSection, setActiveSection] = useState("intro")
  const baseUrl = "https://rpc1.bariscode.my.id"
  const goPackage = "github.com/boomsatu/lumina-blockchain-sdk/go"
  const jsPackage = "lumina-blockchain-sdk"

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-[#1e293b] font-sans">
      <Navbar />

      <div className="animate-hero-bg relative pt-12 pb-16">
        <div className="max-w-[1400px] mx-auto px-4 relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-md">
            <Zap className="w-4 h-4 text-teal-400" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Developer Portal</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
            Lumina <span className="text-teal-400">Official SDKs</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto font-medium">
            Standard development kits for building on Lumina Blockchain.
          </p>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-4 -mt-8 relative z-20 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-3 hidden lg:block">
           <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xl sticky top-20">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-3 pt-2">Documentation Menu</div>
              <nav className="space-y-1">
                 {DOC_SECTIONS.map((section) => (
                    <a 
                      key={section.id}
                      href={`#${section.id}`}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all group",
                        activeSection === section.id ? "bg-teal-50 text-teal-600 border border-teal-100" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                       <section.icon className={cn("w-4 h-4", activeSection === section.id ? "text-teal-600" : "text-slate-400 group-hover:text-slate-600")} />
                       {section.label}
                    </a>
                 ))}
              </nav>
           </div>
        </div>

        <div className="lg:col-span-9 space-y-12">
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
             {LANGUAGES.map((lang) => (
                <button
                   key={lang.id}
                   onClick={() => setActiveLang(lang.id)}
                   className={cn(
                      "flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all shrink-0",
                      activeLang === lang.id 
                         ? "bg-white border-teal-500 shadow-lg shadow-teal-500/10 text-teal-600 scale-105 z-10" 
                         : "bg-white/50 border-slate-200 text-slate-500 hover:border-slate-300"
                   )}
                >
                   <img src={lang.icon} alt={lang.label} className="w-5 h-5" />
                   <span className="text-sm font-black uppercase tracking-widest">{lang.label}</span>
                   {(lang.id === 'python' || lang.id === 'rust') && (
                      <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-bold">SOON</span>
                   )}
                </button>
             ))}
          </div>

          <section id="intro" className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-4">
             <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">Introduction</h2>
             <p className="text-slate-600 font-medium leading-relaxed">
                Connect your app to Lumina with our highly optimized SDKs. We provide full support for <span className="text-teal-600 font-bold">ED25519</span> security and <span className="text-teal-600 font-bold">Bech32m</span> addresses.
             </p>
          </section>

          <section id="install" className="space-y-6">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-600/20">
                   <Download className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Installation</h2>
             </div>
             
             {activeLang === 'js' ? (
                <div className="bg-[#1e293b] rounded-xl p-5 flex items-center justify-between border border-white/5 animate-in fade-in duration-300">
                   <code className="text-sm font-mono text-teal-300">npm install {jsPackage}</code>
                   <CopyButton value={`npm install ${jsPackage}`} />
                </div>
             ) : activeLang === 'go' ? (
                <div className="bg-[#1e293b] rounded-xl p-5 flex items-center justify-between border border-white/5 animate-in fade-in duration-300">
                   <code className="text-sm font-mono text-teal-300">go get {goPackage}</code>
                   <CopyButton value={`go get ${goPackage}`} />
                </div>
             ) : (
                <div className="bg-slate-100 rounded-xl p-10 text-center border-2 border-dashed border-slate-200">
                   <Cpu className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                   <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">SDK Coming Soon</h4>
                </div>
             )}
          </section>

          <section id="wallet" className="space-y-6">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                   <Wallet className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Wallet Management</h2>
             </div>
             
             {activeLang === 'js' ? (
                <div className="space-y-4">
                  <CodeSnippet 
                    title="random_wallet.js"
                    code={`import { LuminaWallet } from '${jsPackage}';\n\n// Generate a new wallet\nconst wallet = LuminaWallet.createRandom();\nconsole.log("Address:", wallet.getAddress());`}
                  >
                    <span className="text-purple-400">import</span> { '{ LuminaWallet }' } <span className="text-purple-400">from</span> <span className="text-amber-200">'{jsPackage}'</span>;<br/><br/>
                    <span className="text-slate-500">// Generate a new random wallet</span><br/>
                    <span className="text-purple-400">const</span> <span className="text-teal-200">wallet</span> = LuminaWallet.<span className="text-blue-400">createRandom</span>();<br/>
                    <span className="text-emerald-400">console</span>.<span className="text-blue-400">log</span>(<span className="text-amber-200">"Address:"</span>, <span className="text-teal-200">wallet</span>.<span className="text-blue-400">getAddress</span>());
                  </CodeSnippet>

                  <CodeSnippet 
                    title="import_mnemonic.js"
                    code={`const mnemonic = "word1 word2 ...";\nconst wallet = LuminaWallet.fromMnemonic(mnemonic);\nconsole.log("Private Key:", wallet.privateKey);`}
                  >
                    <span className="text-slate-500">// Import from BIP39 Mnemonic</span><br/>
                    <span className="text-purple-400">const</span> <span className="text-teal-200">mnemonic</span> = <span className="text-amber-200">"your twelve words here..."</span>;<br/>
                    <span className="text-purple-400">const</span> <span className="text-teal-200">wallet</span> = LuminaWallet.<span className="text-blue-400">fromMnemonic</span>(<span className="text-teal-200">mnemonic</span>);<br/>
                    <span className="text-emerald-400">console</span>.<span className="text-blue-400">log</span>(<span className="text-amber-200">"Private Key:"</span>, <span className="text-teal-200">wallet</span>.privateKey);
                  </CodeSnippet>
                </div>
             ) : activeLang === 'go' ? (
                <div className="space-y-4">
                  <CodeSnippet 
                    title="wallet.go"
                    code={`import "github.com/boomsatu/lumina-blockchain-sdk/go"\n\nwallet, _ := lumina.NewRandomWallet()\nfmt.Println("Address:", wallet.Address)`}
                  >
                    <span className="text-purple-400">import</span> <span className="text-amber-200">"{goPackage}"</span><br/><br/>
                    <span className="text-slate-500">// Generate random wallet</span><br/>
                    <span className="text-teal-200">wallet</span>, <span className="text-purple-400">_</span> := lumina.<span className="text-blue-400">NewRandomWallet</span>()<br/>
                    fmt.<span className="text-blue-400">Println</span>(<span className="text-amber-200">"Address:"</span>, <span className="text-teal-200">wallet</span>.Address)
                  </CodeSnippet>

                  <CodeSnippet 
                    title="import.go"
                    code={`wallet, _ := lumina.NewWalletFromHex("0x...")\nfmt.Println("Address:", wallet.Address)`}
                  >
                    <span className="text-slate-500">// Import from Private Key Hex</span><br/>
                    <span className="text-teal-200">wallet</span>, <span className="text-purple-400">_</span> := lumina.<span className="text-blue-400">NewWalletFromHex</span>(<span className="text-amber-200">"0x..."</span>)<br/>
                    fmt.<span className="text-blue-400">Println</span>(<span className="text-amber-200">"Address:"</span>, <span className="text-teal-200">wallet</span>.Address)
                  </CodeSnippet>
                </div>
             ) : (
                <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 text-center text-slate-400 font-bold italic text-sm">Not available yet</div>
             )}
          </section>

          <section id="client" className="space-y-6">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                   <Globe className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">RPC Client</h2>
             </div>
             
             {activeLang === 'js' ? (
                <div className="space-y-4">
                  <CodeSnippet 
                    title="get_balance.js"
                    code={`import { LuminaClient } from '${jsPackage}';\nconst client = new LuminaClient('${baseUrl}');\n\nconst state = await client.getBalance('lumina1...');\nconsole.log("Balance:", state.balance);`}
                  >
                    <span className="text-purple-400">const</span> <span className="text-teal-200">client</span> = <span className="text-purple-400">new</span> <span className="text-blue-400">LuminaClient</span>(<span className="text-amber-200">'{baseUrl}'</span>);<br/><br/>
                    <span className="text-slate-500">// Get account balance and nonce</span><br/>
                    <span className="text-purple-400">const</span> <span className="text-teal-200">state</span> = <span className="text-purple-400">await</span> <span className="text-teal-200">client</span>.<span className="text-blue-400">getBalance</span>(<span className="text-amber-200">'lumina1...'</span>);<br/>
                    <span className="text-emerald-400">console</span>.<span className="text-blue-400">log</span>(<span className="text-amber-200">"Balance:"</span>, <span className="text-teal-200">state</span>.balance);
                  </CodeSnippet>

                  <CodeSnippet 
                    title="network_stats.js"
                    code={`const stats = await client.getNetworkStats();\nconsole.log("TPS:", stats.tps);`}
                  >
                    <span className="text-slate-500">// Monitor network health</span><br/>
                    <span className="text-purple-400">const</span> <span className="text-teal-200">stats</span> = <span className="text-purple-400">await</span> <span className="text-teal-200">client</span>.<span className="text-blue-400">getNetworkStats</span>();<br/>
                    <span className="text-emerald-400">console</span>.<span className="text-blue-400">log</span>(<span className="text-amber-200">"Current Height:"</span>, <span className="text-teal-200">stats</span>.height);
                  </CodeSnippet>
                </div>
             ) : activeLang === 'go' ? (
                <CodeSnippet 
                  title="client.go"
                  code={`client := lumina.NewClient("${baseUrl}")\nbalance, _ := client.GetBalance("lumina1...")\nfmt.Println("LMN:", balance["balance"])`}
                >
                  <span className="text-teal-200">client</span> := lumina.<span className="text-blue-400">NewClient</span>(<span className="text-amber-200">"{baseUrl}"</span>)<br/><br/>
                  <span className="text-slate-500">// Get balance</span><br/>
                  <span className="text-teal-200">balance</span>, <span className="text-purple-400">_</span> := <span className="text-teal-200">client</span>.<span className="text-blue-400">GetBalance</span>(<span className="text-amber-200">"lumina1..."</span>)<br/>
                  fmt.<span className="text-blue-400">Println</span>(<span className="text-amber-200">"LMN:"</span>, <span className="text-teal-200">balance</span>[<span className="text-amber-200">"balance"</span>])
                </CodeSnippet>
             ) : (
                <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 text-center text-slate-400 font-bold italic text-sm">Not available yet</div>
             )}
          </section>

          <section id="transactions" className="space-y-6">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
                   <Send className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sending Transactions</h2>
             </div>
             
             {activeLang === 'js' ? (
                <CodeSnippet 
                  title="transfer.js"
                  code={`const amount = 100.5;\nconst result = await client.sendTransaction(wallet, 'lumina1target...', amount);\nconsole.log("TX Hash:", result.hash);`}
                >
                  <span className="text-slate-500">// High-level transfer method</span><br/>
                  <span className="text-purple-400">const</span> <span className="text-teal-200">amount</span> = <span className="text-blue-400">100.5</span>;<br/>
                  <span className="text-purple-400">const</span> <span className="text-teal-200">result</span> = <span className="text-purple-400">await</span> <span className="text-teal-200">client</span>.<span className="text-blue-400">sendTransaction</span>(<br/>
                  &nbsp;&nbsp;<span className="text-teal-200">wallet</span>, <br/>
                  &nbsp;&nbsp;<span className="text-amber-200">'lumina1target...'</span>, <br/>
                  &nbsp;&nbsp;<span className="text-teal-200">amount</span><br/>
                  );<br/>
                  <span className="text-emerald-400">console</span>.<span className="text-blue-400">log</span>(<span className="text-amber-200">"TX Hash:"</span>, <span className="text-teal-200">result</span>.hash);
                </CodeSnippet>
             ) : activeLang === 'go' ? (
                <CodeSnippet 
                  title="transfer.go"
                  code={`amount := "100500000000000000000"\nresult, _ := client.SendTransaction(wallet, "target", amount)`}
                >
                  <span className="text-slate-500">// Amount in base units (18 decimals)</span><br/>
                  <span className="text-teal-200">amount</span> := <span className="text-amber-200">"100500000000000000000"</span>;<br/>
                  <span className="text-teal-200">result</span>, <span className="text-purple-400">_</span> := <span className="text-teal-200">client</span>.<span className="text-blue-400">SendTransaction</span>(<span className="text-teal-200">wallet</span>, <span className="text-amber-200">"target"</span>, <span className="text-teal-200">amount</span>)
                </CodeSnippet>
             ) : (
                <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 text-center text-slate-400 font-bold italic text-sm">Not available yet</div>
             )}
          </section>
 
          <section id="staking" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                   <Network className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Staking & Validators</h2>
             </div>
 
             <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
                <div className="space-y-3">
                   <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-teal-600" /> 1. Hardware Requirements
                   </h3>
                   <p className="text-sm text-slate-500 font-medium">To maintain "Velocity" (high-performance consensus), nodes must meet these specs:</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                         { label: "CPU", val: "8+ Cores (Modern)" },
                         { label: "RAM", val: "16GB+ DDR4/5" },
                         { label: "Disk", val: "512GB+ NVMe SSD" },
                         { label: "Net", val: "1Gbps+ Symmetric" }
                      ].map((item, i) => (
                         <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase">{item.label}</span>
                            <span className="text-xs font-bold text-slate-700">{item.val}</span>
                         </div>
                      ))}
                   </div>
                </div>
 
                <div className="space-y-4 pt-4 border-t border-slate-50">
                   <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-teal-600" /> 2. Deploy Node (Native)
                   </h3>
                   <p className="text-sm text-slate-500 font-medium">Build and run the Lumina node directly from source using Cargo:</p>
                   <CodeSnippet title="terminal" code={`# 1. Clone the repository\ngit clone https://github.com/boomsatu/lumina-blockchain\ncd lumina-blockchain\n\n# 2. Build the node in release mode\ncargo build --release -p lumina-node\n\n# 3. Run the node\n./target/release/lumina-node`}>
                      <span className="text-slate-500"># 1. Clone the repository</span><br/>
                      <span className="text-teal-400">git</span> clone https://github.com/boomsatu/lumina-blockchain<br/>
                      <span className="text-teal-400">cd</span> lumina-blockchain<br/><br/>
                      <span className="text-slate-500"># 2. Build the node in release mode</span><br/>
                      <span className="text-teal-400">cargo</span> build --release -p lumina-node<br/><br/>
                      <span className="text-slate-500"># 3. Run the node</span><br/>
                      ./target/release/lumina-node
                   </CodeSnippet>
                </div>
 
                <div className="space-y-4 pt-4 border-t border-slate-50">
                   <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-teal-600" /> 3. Stake for Validator
                   </h3>
                   <p className="text-sm text-slate-500 font-medium">Use the SDK to sign and send a staking transaction. 10,000 {TOKEN_SYMBOL} will be locked in your wallet's staked balance.</p>
                   
                   {activeLang === 'js' ? (
                      <div className="space-y-6">
                        <CodeSnippet title="Option A: Using Mnemonic (Recommended)" code={`import { LuminaWallet, LuminaClient } from 'lumina-blockchain-sdk';\n\nconst wallet = LuminaWallet.fromMnemonic('word1 word2 ...');\nconst client = new LuminaClient('https://rpc1.bariscode.my.id');\n\nasync function stake() {\n  const tx = await wallet.createStakeTransaction(client, {\n    amount: "10000",\n    nodeId: "your_node_id"\n  });\n  const res = await client.sendTransaction(tx);\n  console.log("Staked successfully:", res.hash);\n}\n\nstake();`}>
                           <span className="text-slate-500">// Option A: User Friendly (Mnemonic)</span><br/>
                           <span className="text-purple-400">const</span> <span className="text-teal-200">wallet</span> = LuminaWallet.<span className="text-blue-400">fromMnemonic</span>(<span className="text-amber-200">'twelve words...'</span>);<br/>
                           <span className="text-purple-400">const</span> <span className="text-teal-200">client</span> = <span className="text-purple-400">new</span> <span className="text-blue-400">LuminaClient</span>(<span className="text-amber-200">'https://rpc1.bariscode.my.id'</span>);<br/><br/>
                           <span className="text-purple-400">const</span> <span className="text-teal-200">tx</span> = <span className="text-purple-400">await</span> <span className="text-teal-200">wallet</span>.<span className="text-blue-400">createStakeTransaction</span>(<span className="text-teal-200">client</span>, { '{' }<br/>
                           &nbsp;&nbsp;amount: <span className="text-amber-200">"10000"</span>,<br/>
                           &nbsp;&nbsp;nodeId: <span className="text-amber-200">"node_id"</span><br/>
                           { '}' });<br/>
                           <span className="text-purple-400">await</span> <span className="text-teal-200">client</span>.<span className="text-blue-400">sendTransaction</span>(<span className="text-teal-200">tx</span>);
                        </CodeSnippet>

                        <CodeSnippet title="Option B: Using Private Key (Hex)" code={`import { LuminaWallet, LuminaClient } from 'lumina-blockchain-sdk';\n\nconst wallet = new LuminaWallet('0x...your_hex_key...');\nconst client = new LuminaClient('https://rpc1.bariscode.my.id');\n\nasync function stake() {\n  const tx = await wallet.createStakeTransaction(client, {\n    amount: "10000",\n    nodeId: "your_node_id"\n  });\n  const res = await client.sendTransaction(tx);\n  console.log("Staked successfully:", res.hash);\n}\n\nstake();`}>
                           <span className="text-slate-500">// Option B: Developer/Bot (Private Key Hex)</span><br/>
                           <span className="text-purple-400">const</span> <span className="text-teal-200">wallet</span> = <span className="text-purple-400">new</span> <span className="text-blue-400">LuminaWallet</span>(<span className="text-amber-200">'0x...'</span>);<br/>
                           <span className="text-purple-400">const</span> <span className="text-teal-200">client</span> = <span className="text-purple-400">new</span> <span className="text-blue-400">LuminaClient</span>(<span className="text-amber-200">'https://rpc1.bariscode.my.id'</span>);<br/><br/>
                           <span className="text-purple-400">const</span> <span className="text-teal-200">tx</span> = <span className="text-purple-400">await</span> <span className="text-teal-200">wallet</span>.<span className="text-blue-400">createStakeTransaction</span>(<span className="text-teal-200">client</span>, { '{' }<br/>
                           &nbsp;&nbsp;amount: <span className="text-amber-200">"10000"</span>,<br/>
                           &nbsp;&nbsp;nodeId: <span className="text-amber-200">"node_id"</span><br/>
                           { '}' });<br/>
                           <span className="text-purple-400">await</span> <span className="text-teal-200">client</span>.<span className="text-blue-400">sendTransaction</span>(<span className="text-teal-200">tx</span>);
                        </CodeSnippet>
                      </div>
                   ) : (
                      <CodeSnippet title="stake.go" code={`wallet := lumina.NewWalletFromMnemonic("...")\nclient := lumina.NewClient("https://rpc1.bariscode.my.id")\n\ntx := wallet.CreateStakeTransaction(client, "10000", "node_id")\nres, _ := client.SendTransaction(tx)`}>
                         <span className="text-teal-200">wallet</span> := lumina.<span className="text-blue-400">NewWalletFromMnemonic</span>(<span className="text-amber-200">"..."</span>)<br/>
                         <span className="text-teal-200">client</span> := lumina.<span className="text-blue-400">NewClient</span>(<span className="text-amber-200">"https://rpc1.bariscode.my.id"</span>)<br/><br/>
                         <span className="text-teal-200">tx</span> := <span className="text-teal-200">wallet</span>.<span className="text-blue-400">CreateStakeTransaction</span>(<span className="text-teal-200">client</span>, <span className="text-amber-200">"10000"</span>, <span className="text-amber-200">"node_id"</span>)<br/>
                         <span className="text-teal-200">res</span>, <span className="text-purple-400">_</span> := <span className="text-teal-200">client</span>.<span className="text-blue-400">SendTransaction</span>(<span className="text-teal-200">tx</span>)
                      </CodeSnippet>
                   )}
                </div>
             </div>
          </section>

          <div className="bg-[#111827] rounded-3xl p-10 text-white relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <Code2 className="w-64 h-64" />
             </div>
             <div className="relative z-10 space-y-6">
                <h3 className="text-3xl font-black italic tracking-tighter uppercase">Build it your way</h3>
                <p className="text-slate-400 font-medium max-w-lg leading-relaxed">Join our developer working group and help us expand the Lumina ecosystem.</p>
                <div className="flex flex-wrap gap-4 pt-2">
                   <a href="https://github.com/boomsatu/lumina-blockchain-sdk" target="_blank" className="bg-teal-500 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-teal-400 transition-all shadow-2xl shadow-teal-500/40">GitHub Repo <ExternalLink className="w-4 h-4" /></a>
                   <a href={`https://www.npmjs.com/package/${jsPackage}`} target="_blank" className="bg-white/5 text-white border border-white/10 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all">NPM Page <ExternalLink className="w-4 h-4" /></a>
                </div>
             </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}
