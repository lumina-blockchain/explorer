import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function cleanHash(hash: string) {
  if (!hash) return ""
  return hash.replace("Hash(", "").replace(")", "").replace("0x", "")
}

export function formatHash(hash: string) {
  if (!hash) return "..."
  const clean = cleanHash(hash)
  return `${clean.substring(0, 6)}...${clean.substring(clean.length - 4)}`
}

export function formatAddr(addr: string) {
  if (!addr) return "..."
  return `${addr.substring(0, 10)}...${addr.substring(addr.length - 4)}`
}

export function formatValue(value: string | number) {
  if (!value || value === "0") return "0"
  const valStr = value.toString()
  const decimals = 18

  let whole: string;
  let frac: string;

  if (valStr.length <= decimals) {
    const padded = valStr.padStart(decimals + 1, "0")
    whole = padded.slice(0, padded.length - decimals)
    frac = padded.slice(padded.length - decimals)
  } else {
    whole = valStr.slice(0, valStr.length - decimals)
    frac = valStr.slice(valStr.length - decimals)
  }

  // Format ribuan untuk angka utuh (Thousand Separator)
  const formattedWhole = new Intl.NumberFormat('en-US').format(BigInt(whole))

  // Buang nol di paling belakang (trailing zeros)
  let trimmedFrac = frac.replace(/0+$/, "")

  if (trimmedFrac.length === 0) return formattedWhole;

  // Tampilkan maksimal 8 digit biar nggak kepanjangan tapi tetep dapet presisinya
  return `${formattedWhole}.${trimmedFrac.substring(0, 8)}`
}

export function formatTime(timestamp: number) {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
