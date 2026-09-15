import type { Embroidery, FabricSource, Style } from "../data/types";

export const EMBROIDERY_ADD: Record<Embroidery, number> = { none: 0, simple: 80, heavy: 250 };
export const RUSH_RATE = 0.2;
export const DEPOSIT_RATE = 0.5;

export function unitPrice(style: Pick<Style, "fromPrice" | "studioFabricFrom">, fabric: FabricSource, embroidery: Embroidery): number {
  return style.fromPrice + (fabric === "studio" ? style.studioFabricFrom : 0) + EMBROIDERY_ADD[embroidery];
}

export interface Estimate {
  subtotal: number;
  rushFee: number;
  total: number;
  deposit: number;
}

export function estimate(lines: { unitPrice: number; qty: number }[], rush: boolean): Estimate {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * Math.max(0, line.qty), 0);
  const rushFee = rush ? roundTo(subtotal * RUSH_RATE, 10) : 0;
  const total = subtotal + rushFee;
  return { subtotal, rushFee, total, deposit: depositFor(total) };
}

/** Half the total, rounded up to the nearest GH₵ 10. */
export function depositFor(total: number): number {
  return roundTo(total * DEPOSIT_RATE, 10, "up");
}

function roundTo(value: number, step: number, mode: "nearest" | "up" = "nearest"): number {
  const fn = mode === "up" ? Math.ceil : Math.round;
  return fn(value / step) * step;
}
