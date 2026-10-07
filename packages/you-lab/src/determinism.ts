// Deterministic primitives for the YOU Lab (W1C).
//
// Laws (docs/you/FIXTURES.md): no Date.now / Math.random / performance.now /
// network anywhere in the compiler or benchmark path. All ordering is stable
// (explicit sorts, never Map/Set insertion order on output paths), and all
// digests use integer-only FNV-1a arithmetic so results are byte-identical on
// every run and platform.

/** 32-bit FNV-1a hash, returned as 8 lowercase hex chars. Integer ops only. */
export function fnv1a32(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Deterministic JSON: object keys sorted recursively, arrays keep order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysDeep(item));
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort(compareStrings)) {
      const entry = record[key];
      if (entry !== undefined) {
        out[key] = sortKeysDeep(entry);
      }
    }
    return out;
  }
  return value;
}

/** Stable string comparison (total order, no locale dependence). */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Deduplicate + sort (stable output ordering for any input ordering). */
export function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareStrings);
}

/** Round to a fixed number of decimals — deterministic IEEE-754 arithmetic. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Deterministic date difference in days (calendar arithmetic on ISO dates,
 * no clock access). Both inputs must be "YYYY-MM-DD".
 */
export function daysBetweenIso(fromIsoDate: string, toIsoDate: string): number {
  const from = Date.parse(`${fromIsoDate}T00:00:00Z`);
  const to = Date.parse(`${toIsoDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new Error(`invalid ISO date: ${fromIsoDate} or ${toIsoDate}`);
  }
  return Math.floor((to - from) / 86_400_000);
}
