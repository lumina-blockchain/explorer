"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CopyButtonProps {
  value: string
  className?: string
}

export default function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "hover:text-teal-600 transition-all active:scale-95 shrink-0",
        copied ? "text-emerald-500" : "text-slate-400",
        className
      )}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 animate-in zoom-in duration-200" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  )
}
