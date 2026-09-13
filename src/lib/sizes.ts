/**
 * Standard US ring sizes offered on made-to-order pieces that can be cast at
 * any size. Defined once so the size dropdown, the checkout validator and the
 * sizing guide can never drift apart.
 */
export const STANDARD_RING_SIZES = [
  '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5',
  '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13',
] as const;

export type StandardRingSize = (typeof STANDARD_RING_SIZES)[number];

export function isStandardSize(size: string): boolean {
  return (STANDARD_RING_SIZES as readonly string[]).includes(size);
}
