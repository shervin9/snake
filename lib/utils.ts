import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert number to Persian digits
 */
export function toPersian(num: number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num.toString().replace(/\d/g, (d) => persianDigits[parseInt(d)]);
}

/**
 * Format milliseconds to MM:SS display
 */
export function formatTime(ms: number, usePersian = false): string {
  if (!ms || ms <= 0) {
    const zero = usePersian ? toPersian(0) : '0';
    return `${zero}:${zero}${zero}`;
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const secStr = seconds < 10 ? `0${seconds}` : String(seconds);
  const formatted = `${minutes}:${secStr}`;
  return usePersian ? toPersian(parseInt(minutes.toString())) + ':' + (seconds < 10 ? toPersian(0) + toPersian(seconds) : toPersian(seconds)) : formatted;
}

/**
 * Generate unique ID
 */
export function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


