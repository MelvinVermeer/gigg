import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 12 KB, 340 MB, 1.25 GB. */
export function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`
  if (b < 1024 ** 3) return `${+(b / 1024 ** 2).toFixed(1)} MB`
  return `${+(b / 1024 ** 3).toFixed(2)} GB`
}
