// Provider-neutral TechnologyProfile registry (W1C).
//
// Truth law: every license / maintenance / repo claim carries a source URL and
// a verified flag. Claims that could not be verified during the one-time
// research seeding are marked unverified and listed in provenance
// .unverifiedClaims — they are never presented as verified. Capability tags
// and compatibility summaries are YOU-lab engineering assessments and are
// labeled as such in provenance.claimBasis.

export type TechnologyKind = "editor" | "library" | "runtime" | "format";

export interface LicenseClaim {
  /** SPDX id, or null for a custom/non-SPDX license. */
  readonly spdxId: string | null;
  readonly name: string;
  /** URL where the claim was verified. */
  readonly sourceUrl: string;
  readonly verified: boolean;
  /** Nuances (aggregates, per-module exceptions, review requirements). */
  readonly note: string;
}

// W2C: "github-commit" added additively for capture candidates that publish
// neither releases nor registry packages (SAM/SAM2, Depth-Anything-V2); the
// signal cites the last observed commit date on the default branch.

export type MaintenanceSignalKind = "npm-publish" | "github-release" | "pypi-upload" | "github-commit";

export interface MaintenanceSignal {
  readonly kind: MaintenanceSignalKind;
  /** e.g. "three@0.186.1" or "v5.2.2". */
  readonly signal: string;
  /** ISO-8601 date from the source (static research snapshot, no clock access). */
  readonly date: string;
  readonly sourceUrl: string;
  readonly verified: boolean;
}

export interface TechnologyProvenance {
  /** Date of the one-time web research seeding (constant). */
  readonly researchDate: string;
  readonly sourceUrls: readonly string[];
  readonly claimBasis: string;
  /** Aspects that remain unverified; must be non-empty when any claim is unverified. */
  readonly unverifiedClaims: readonly string[];
}

export interface TechnologyProfile {
  readonly id: string;
  readonly name: string;
  readonly kind: TechnologyKind;
  readonly capabilityTags: readonly string[];
  readonly license: LicenseClaim;
  readonly maintenance: readonly MaintenanceSignal[];
  readonly repoUrl: string;
  /** Compatibility note — an engineering assessment unless marked verified. */
  readonly compatibility: { readonly summary: string; readonly verified: boolean };
  readonly provenance: TechnologyProvenance;
  /** Whether the technology participates in editor-capability derivation. */
  readonly editorCapable: boolean;
}

export interface TechnologyRegistry {
  /** All profiles, deterministically ordered by id. */
  readonly profiles: readonly TechnologyProfile[];
  byId(id: string): TechnologyProfile | null;
  ids(): readonly string[];
}

export function createRegistry(profiles: readonly TechnologyProfile[]): TechnologyRegistry {
  const sorted = [...profiles].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byIdMap = new Map<string, TechnologyProfile>();
  for (const profile of sorted) {
    byIdMap.set(profile.id, profile);
  }
  return {
    profiles: sorted,
    byId(id: string): TechnologyProfile | null {
      return byIdMap.get(id) ?? null;
    },
    ids(): readonly string[] {
      return sorted.map((profile) => profile.id);
    },
  };
}

export interface RegistryIntegrityReport {
  readonly valid: boolean;
  /** Sorted issue strings (empty when valid). */
  readonly issues: readonly string[];
}

/**
 * Registry integrity rules (tested):
 * 1. ids are unique;
 * 2. every profile has a license with a non-empty name and source URL;
 * 3. every verified claim (license, maintenance) carries a source URL;
 * 4. any unverified license/maintenance claim is explicitly listed in
 *    provenance.unverifiedClaims (an unverified claim never masquerades as
 *    verified);
 * 5. editorCapable profiles are editors or libraries.
 */
export function validateRegistryIntegrity(registry: TechnologyRegistry): RegistryIntegrityReport {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const profile of registry.profiles) {
    const pid = profile.id;
    if (pid.length === 0) issues.push(`${pid || "<empty>"}: empty id`);
    if (seen.has(pid)) issues.push(`${pid}: duplicate id`);
    seen.add(pid);
    const license = profile.license;
    if (!license.name) issues.push(`${pid}: license name missing`);
    if (!license.sourceUrl) issues.push(`${pid}: license sourceUrl missing`);
    if (license.verified && !license.sourceUrl) issues.push(`${pid}: license verified without sourceUrl`);
    if (!license.verified) {
      const flagged = profile.provenance.unverifiedClaims.some((claim) => claim.toLowerCase().includes("license"));
      if (!flagged) issues.push(`${pid}: unverified license not listed in provenance.unverifiedClaims`);
    }
    if (license.spdxId === null && !license.note) issues.push(`${pid}: non-SPDX license without explanatory note`);
    if (profile.maintenance.length === 0) issues.push(`${pid}: no maintenance evidence`);
    for (const signal of profile.maintenance) {
      if (signal.verified && !signal.sourceUrl) issues.push(`${pid}: maintenance ${signal.signal} verified without sourceUrl`);
      if (!signal.verified) {
        const flagged = profile.provenance.unverifiedClaims.some((claim) => claim.toLowerCase().includes("maintenance"));
        if (!flagged) issues.push(`${pid}: unverified maintenance ${signal.signal} not listed in provenance.unverifiedClaims`);
      }
    }
    if (profile.editorCapable && profile.kind !== "editor" && profile.kind !== "library") {
      issues.push(`${pid}: editorCapable on kind "${profile.kind}"`);
    }
    if (profile.capabilityTags.length === 0) issues.push(`${pid}: no capability tags`);
    if (!profile.provenance.researchDate) issues.push(`${pid}: no researchDate`);
  }
  const sortedIssues = [...new Set(issues)].sort();
  return { valid: sortedIssues.length === 0, issues: sortedIssues };
}
