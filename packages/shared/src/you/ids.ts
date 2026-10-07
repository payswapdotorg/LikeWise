// YOU opaque id factory (docs/you/CONTRACTS.md: identifiers stay opaque,
// never embed PII). Fixture mode derives ids from the injected RNG, so id
// sequences are reproducible for a given seed.

import type { OpaqueId } from "./contract.js";
import { uint32ToHex8, type YouRng } from "./rng.js";

/** Id format: `you_<kind>_<16 hex chars>`. */
export const YOU_ID_PREFIX = "you";

/** Injectable id factory boundary. */
export interface YouIdFactory {
  next(kind: string): OpaqueId;
}

function sanitizeKind(kind: string): string {
  const cleaned = kind.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return cleaned.length > 0 ? cleaned : "id";
}

/** Creates an RNG-backed id factory. Kinds are sanitized to `[a-z0-9-]`. */
export function createRngIdFactory(rng: YouRng, prefix: string = YOU_ID_PREFIX): YouIdFactory {
  return {
    next(kind: string): OpaqueId {
      const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "") || YOU_ID_PREFIX;
      const high = uint32ToHex8(rng.nextUint32());
      const low = uint32ToHex8(rng.nextUint32());
      return `${safePrefix}_${sanitizeKind(kind)}_${high}${low}`;
    },
  };
}
