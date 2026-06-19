"use client"

const RPC_URLS = (
  process.env.NEXT_PUBLIC_RPC_URLS || "https://api-explorer.bariscode.my.id"
).split(",").map(u => u.trim())

let currentRpcIndex = 0

/**
 * Mendapatkan URL RPC secara bergantian (Round Robin)
 */
export function getRpcUrl(): string {
  const url = RPC_URLS[currentRpcIndex]
  currentRpcIndex = (currentRpcIndex + 1) % RPC_URLS.length
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    console.log("🌐 Lumina RPC connected to:", url);
  }
  return url
}

/**
 * Auto-derive WSS URL dari HTTP/HTTPS RPC URL.
 * https://rpc1.bariscode.my.id  → wss://rpc1.bariscode.my.id/explorer/ws
 * http://127.0.0.1:9098          → ws://127.0.0.1:9098/explorer/ws
 */
function deriveWssUrl(httpUrl: string): string {
  const wsBase = httpUrl
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://")
    .replace(/\/$/, "")
  return `${wsBase}/explorer/ws`
}

/**
 * Mendapatkan URL WebSocket utama.
 * Prioritas: env NEXT_PUBLIC_WSS_URL → auto-derive dari node pertama
 */
export function getWssUrl(): string {
  if (process.env.NEXT_PUBLIC_WSS_URL) {
    return process.env.NEXT_PUBLIC_WSS_URL
  }
  return deriveWssUrl(RPC_URLS[0])
}

/**
 * Mendapatkan semua WSS URLs dari semua RPC nodes (untuk fallback).
 */
export function getAllWssUrls(): string[] {
  return RPC_URLS.map(deriveWssUrl)
}

/**
 * Fetch dengan fallback ke semua node jika gagal.
 * Mencoba node saat ini dulu, kalau error coba node lainnya.
 */
export async function fetchRpc(path: string, options?: RequestInit): Promise<Response> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`

  // Coba semua node sampai ada yang berhasil
  for (let i = 0; i < RPC_URLS.length; i++) {
    const rpc = RPC_URLS[(currentRpcIndex + i) % RPC_URLS.length]
    const url = path.startsWith("http") ? path : `${rpc}${cleanPath}`
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        currentRpcIndex = (currentRpcIndex + i) % RPC_URLS.length
        return res
      }
    } catch {
      // Node ini gagal, coba berikutnya
    }
  }

  // Fallback ke node terakhir (biar halaman bisa handle error sendiri)
  const fallbackUrl = path.startsWith("http") ? path : `${RPC_URLS[0]}${cleanPath}`
  return fetch(fallbackUrl, options)
}
