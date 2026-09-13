/**
 * Cart state. Plain nanostores + localStorage, no framework.
 *
 * The cart stores ONLY {slug, size, qty}. It never stores or sends a price —
 * the checkout Worker resolves money from the server-side catalog. A cart that
 * carries prices is trivially exploitable.
 */
import { atom } from 'nanostores';

export interface CartLine {
  slug: string;
  size: string;
  qty: number;
}

const STORAGE_KEY = 'bolder.cart.v1';

function read(): CartLine[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.slug === 'string')
      .map((l) => ({ slug: l.slug, size: String(l.size ?? ''), qty: Math.max(1, Number(l.qty) || 1) }));
  } catch {
    return [];
  }
}

function write(lines: CartLine[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* private mode / blocked storage — cart is per-session only, not fatal */
  }
}

export const $cart = atom<CartLine[]>(read());
export const $cartOpen = atom(false);

function commit(lines: CartLine[]): void {
  $cart.set(lines);
  write(lines);
}

const sameLine = (a: CartLine, slug: string, size: string) => a.slug === slug && a.size === size;

export function addToCart(slug: string, size = '', qty = 1): void {
  const lines = [...$cart.get()];
  const existing = lines.findIndex((l) => sameLine(l, slug, size));
  if (existing >= 0) lines[existing] = { ...lines[existing]!, qty: lines[existing]!.qty + qty };
  else lines.push({ slug, size, qty });
  commit(lines);
}

export function setQty(slug: string, size: string, qty: number): void {
  if (qty <= 0) return removeFromCart(slug, size);
  commit($cart.get().map((l) => (sameLine(l, slug, size) ? { ...l, qty } : l)));
}

export function removeFromCart(slug: string, size: string): void {
  commit($cart.get().filter((l) => !sameLine(l, slug, size)));
}

export function clearCart(): void {
  commit([]);
}

export function cartCount(lines: readonly CartLine[] = $cart.get()): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/** Keep multiple tabs consistent. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) $cart.set(read());
  });
}
