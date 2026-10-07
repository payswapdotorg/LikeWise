// YOU deterministic serialization helpers.
//
// FIXTURES.md laws 2/4/8: byte-identical outputs require a canonical JSON
// form with recursively sorted object keys, plus content hashes computed
// over that canonical form. Records published by the fixture runtime are
// deep-frozen so immutable contract objects cannot be mutated in place.

/** Canonical JSON: object keys sorted recursively, arrays kept in order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => stableStringify(item));
    return `[${items.join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const entry = record[key];
    if (entry === undefined) {
      continue;
    }
    parts.push(`${JSON.stringify(key)}:${stableStringify(entry)}`);
  }
  return `{${parts.join(",")}}`;
}

/** Structural equality under the canonical JSON form. */
export function stableEquals(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

/**
 * Deterministic 32-bit content hash (hex, 8 chars) over the canonical
 * serialization of a value. Used for fixture-record content addressing.
 */
export function stableContentHash(value: unknown): string {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Recursively freezes plain objects and arrays (in place). Returns the
 * same reference, typed as T, so callers can publish frozen records.
 * Primitive leaves and already-frozen values are returned unchanged.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    Object.freeze(value);
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    deepFreeze(record[key]);
  }
  Object.freeze(value);
  return value;
}
