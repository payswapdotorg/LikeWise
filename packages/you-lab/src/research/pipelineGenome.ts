// Pipeline Genome — append-only lineage of candidate pipelines (W9C).
//
// Authority: docs/you/LAB.md "Pipeline Genome" — a PipelineCandidate records
// a graph of adapters/versions, parameters, models, organizations, Bodies,
// Souls, tools/editors, compute and evaluator versions; mutation creates
// new candidates; existing candidates remain immutable. The genome here is
// the you-lab research-plane model of that law: lineage NODES (neutral
// PipelineGenomeNode shapes, structurally aligned with the frozen v9
// PipelineGenomeNode; mapping onto the frozen contract happens ONLY in
// src/contractSeam.ts) appended to an immutable genome, never mutated.
//
// HONEST MODEL: the "score" on a node is a computed deterministic fixture
// objective supplied by the caller (the world-run scorer / search ladder) —
// never a measured benchmark and never a claim about any real pipeline.
// The lineage-strength model (authored mutation weights accumulated along
// a lineage) is a W9C fixture definition: computed, deterministic, and
// explicitly not an assessment of any real technology combination.
//
// Determinism: ids, mutation selection and strength are pure functions of
// their inputs (no clock, no Math.random, no network — sha256-indexed
// derivations only, docs/you/FIXTURES.md).

import { roundTo } from "../determinism.js";
import { sha256Hex } from "../arena/arenaAdapterSeam.js";

/** Error code aligned with the frozen v9 typed error literal (you-lab-owned). */
export const PIPELINE_GENOME_INVALID_CODE = "YOU_PIPELINE_GENOME_INVALID";

/** Typed rejection thrown when a genome or lineage violates the append-only laws. */
export class PipelineGenomeInvalidError extends Error {
  readonly code = PIPELINE_GENOME_INVALID_CODE;
  constructor(detail: string) {
    super(`${PIPELINE_GENOME_INVALID_CODE}: ${detail}`);
  }
}

/**
 * Authored mutation vocabulary (W9C fixture definition) — the LAB.md
 * Pipeline Genome dimensions a mutation may touch. "seed" is the root
 * pseudo-mutation (parentRef null, generation 0), never an exploration
 * mutation.
 */
export const MUTATION_KINDS = [
  "adapter-swap",
  "parameter-tune",
  "model-swap",
  "organization-restructure",
  "body-recompose",
  "soul-reroute",
  "tool-bind",
  "editor-bind",
  "compute-replan",
  "evaluator-bump",
] as const;

export type NeutralMutationKind = (typeof MUTATION_KINDS)[number] | "seed" | (string & {});

/**
 * Authored mutation weights for the lineage-strength model (W9C fixture
 * definition — computed, never measured): each mutation adds its dimension's
 * authored strength delta to the lineage; the root contributes the base.
 */
export const MUTATION_KIND_WEIGHTS: Readonly<Record<string, number>> = {
  seed: 0,
  "adapter-swap": 0.04,
  "parameter-tune": 0.03,
  "model-swap": 0.05,
  "organization-restructure": 0.06,
  "body-recompose": 0.02,
  "soul-reroute": 0.02,
  "tool-bind": 0.04,
  "editor-bind": 0.03,
  "compute-replan": 0.02,
  "evaluator-bump": 0.01,
};

/** Base strength of the seed pipeline (the unsearched generalist root). */
export const GENOME_BASE_STRENGTH = 0.32;

/** Strength cap — no lineage exceeds this in the fixture model. */
export const GENOME_STRENGTH_CAP = 0.98;

/**
 * Neutral genome lineage node — aligned 1:1 with the frozen v9
 * PipelineGenomeNode (append-only lineage, never mutated).
 */
export interface NeutralPipelineGenomeNode {
  readonly id: string;
  readonly parentRef: string | null;
  readonly mutationKind: string;
  readonly score: number;
  readonly generation: number;
  readonly simulated: boolean;
}

/** An append-only genome: the experiment's lineage node ledger. */
export interface PipelineGenome {
  readonly experimentId: string;
  readonly nodes: readonly NeutralPipelineGenomeNode[];
}

const NODE_ID_PREFIX = "you_genome-node_";

function isExplorationKind(kind: string): boolean {
  return kind !== "seed" && (MUTATION_KINDS as readonly string[]).includes(kind);
}

function assertValidScore(score: number, context: string): void {
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
    throw new PipelineGenomeInvalidError(`${context}: score ${score} is outside [0, 1] (never silently clamped)`);
  }
}

function assertValidNodeId(id: string, context: string): void {
  if (id.length === 0) {
    throw new PipelineGenomeInvalidError(`${context}: node id is empty`);
  }
  if (!id.startsWith(NODE_ID_PREFIX)) {
    throw new PipelineGenomeInvalidError(`${context}: node id '${id}' does not carry the '${NODE_ID_PREFIX}' prefix`);
  }
}

/** Deterministic root node id for (experimentId, seed) — the seed pipeline. */
export function seedGenomeNodeId(experimentId: string, seed: string): string {
  return `${NODE_ID_PREFIX}${sha256Hex(`${experimentId}|root|${seed}`).slice(0, 16)}`;
}

/**
 * Mint the root (generation 0, mutationKind "seed", parentRef null) node
 * for (experimentId, seed) with score 0 — the caller scores it through the
 * world-run machinery and constructs the genome from the scored copy.
 */
export function seedGenomeNode(experimentId: string, seed: string): NeutralPipelineGenomeNode {
  if (experimentId.length === 0) {
    throw new PipelineGenomeInvalidError("experimentId is empty (a genome names its experiment)");
  }
  if (seed.length === 0) {
    throw new PipelineGenomeInvalidError("seed is empty (the root node derives from it)");
  }
  return {
    id: seedGenomeNodeId(experimentId, seed),
    parentRef: null,
    mutationKind: "seed",
    score: 0,
    generation: 0,
    simulated: true,
  };
}

/** Construct a one-node genome from a scored root (validates the root). */
export function createPipelineGenomeFromNode(
  experimentId: string,
  root: NeutralPipelineGenomeNode,
): PipelineGenome {
  if (experimentId.length === 0) {
    throw new PipelineGenomeInvalidError("experimentId is empty (a genome names its experiment)");
  }
  assertValidNodeId(root.id, "createPipelineGenomeFromNode root");
  if (root.parentRef !== null) {
    throw new PipelineGenomeInvalidError(`root node ${root.id} carries parentRef '${root.parentRef}' (the root has no parent)`);
  }
  if (root.generation !== 0) {
    throw new PipelineGenomeInvalidError(`root node ${root.id} carries generation ${root.generation} (the root is generation 0)`);
  }
  if (root.mutationKind !== "seed") {
    throw new PipelineGenomeInvalidError(`root node ${root.id} carries mutationKind '${root.mutationKind}' (roots are 'seed')`);
  }
  assertValidScore(root.score, `root node ${root.id}`);
  return { experimentId, nodes: [{ ...root }] };
}

/** Convenience: root-from-(experimentId, seed) with the caller's root score. */
export function createPipelineGenome(
  experimentId: string,
  seed: string,
  rootScore: number,
): PipelineGenome {
  assertValidScore(rootScore, "createPipelineGenome root");
  return createPipelineGenomeFromNode(experimentId, { ...seedGenomeNode(experimentId, seed), score: rootScore });
}

/** Deterministic child node id for (genome, parentRef, mutationKind) at the next append position. */
export function genomeChildNodeId(genome: PipelineGenome, parentRef: string, mutationKind: string): string {
  return `${NODE_ID_PREFIX}${sha256Hex(`${genome.experimentId}|${parentRef}|${mutationKind}|${genome.nodes.length}`).slice(0, 16)}`;
}

/**
 * Append a fully-formed node to the genome (the append-only core). The
 * caller mints the node (e.g. via genomeChildNodeId); this enforces the
 * laws: parent exists, generation = parent.generation + 1, exploration
 * kinds only (the root is minted by seedGenomeNode, never appended), id
 * unique, score in [0, 1]. Returns a NEW genome — the input is untouched.
 */
export function appendGenomeNode(genome: PipelineGenome, node: NeutralPipelineGenomeNode): PipelineGenome {
  assertValidNodeId(node.id, "appendGenomeNode");
  if (!isExplorationKind(node.mutationKind)) {
    throw new PipelineGenomeInvalidError(
      `appendGenomeNode: mutationKind '${node.mutationKind}' is outside the authored mutation vocabulary (the root is minted by seedGenomeNode, never appended)`,
    );
  }
  if (node.parentRef === null) {
    throw new PipelineGenomeInvalidError(`appended node ${node.id} has parentRef null (only the root is parentless)`);
  }
  if (genome.nodes.some((entry) => entry.id === node.id)) {
    throw new PipelineGenomeInvalidError(`appendGenomeNode: node id '${node.id}' already exists (lineage ids are append-unique)`);
  }
  const parent = genome.nodes.find((entry) => entry.id === node.parentRef);
  if (!parent) {
    throw new PipelineGenomeInvalidError(`appendGenomeNode: parentRef '${node.parentRef}' does not resolve (dangling lineage refused)`);
  }
  if (node.generation !== parent.generation + 1) {
    throw new PipelineGenomeInvalidError(
      `appendGenomeNode: node ${node.id} generation ${node.generation} != parent generation ${parent.generation} + 1`,
    );
  }
  assertValidScore(node.score, `node ${node.id}`);
  return { experimentId: genome.experimentId, nodes: [...genome.nodes, { ...node }] };
}

/** Convenience: append a mutation of (parentRef, mutationKind) with the caller's score. */
export function appendGenomeMutation(
  genome: PipelineGenome,
  parentRef: string,
  mutationKind: string,
  score: number,
): PipelineGenome {
  const parent = genome.nodes.find((entry) => entry.id === parentRef);
  if (!parent) {
    throw new PipelineGenomeInvalidError(`appendGenomeMutation: parentRef '${parentRef}' does not resolve`);
  }
  if (!isExplorationKind(mutationKind)) {
    throw new PipelineGenomeInvalidError(
      `appendGenomeMutation: mutationKind '${mutationKind}' is outside the authored mutation vocabulary`,
    );
  }
  assertValidScore(score, `mutation '${mutationKind}' of ${parentRef}`);
  return appendGenomeNode(genome, {
    id: genomeChildNodeId(genome, parentRef, mutationKind),
    parentRef,
    mutationKind,
    score,
    generation: parent.generation + 1,
    simulated: true,
  });
}

/**
 * The best node by score. Stable total order: highest score, then lowest
 * generation, then lexicographically smallest id (never iteration order).
 */
export function bestGenomeNode(genome: PipelineGenome): NeutralPipelineGenomeNode {
  if (genome.nodes.length === 0) {
    throw new PipelineGenomeInvalidError("bestGenomeNode: the genome is empty");
  }
  let best = genome.nodes[0]!;
  for (const node of genome.nodes) {
    if (
      node.score > best.score ||
      (node.score === best.score && node.generation < best.generation) ||
      (node.score === best.score && node.generation === best.generation && node.id < best.id)
    ) {
      best = node;
    }
  }
  return best;
}

/** The root -> node lineage chain (contiguous, ordered). Typed error on unknown ids. */
export function genomeLineage(genome: PipelineGenome, nodeId: string): readonly NeutralPipelineGenomeNode[] {
  const byId = new Map(genome.nodes.map((node) => [node.id, node]));
  const chain: NeutralPipelineGenomeNode[] = [];
  let cursor: NeutralPipelineGenomeNode | undefined = byId.get(nodeId);
  while (cursor) {
    chain.unshift(cursor);
    cursor = cursor.parentRef === null ? undefined : byId.get(cursor.parentRef);
  }
  if (chain.length === 0 || chain[0]!.parentRef !== null || chain[chain.length - 1]!.id !== nodeId) {
    throw new PipelineGenomeInvalidError(`genomeLineage: node id '${nodeId}' does not resolve in genome ${genome.experimentId}`);
  }
  assertLineageIntegrity(chain);
  return chain;
}

/** Fail-closed integrity check over a root -> leaf chain (contiguity + generation law). */
export function assertLineageIntegrity(lineage: readonly NeutralPipelineGenomeNode[]): void {
  if (lineage.length === 0) {
    throw new PipelineGenomeInvalidError("assertLineageIntegrity: lineage is empty");
  }
  for (let index = 0; index < lineage.length; index++) {
    const node = lineage[index]!;
    assertValidNodeId(node.id, `lineage[${index}]`);
    assertValidScore(node.score, `node ${node.id}`);
    if (index === 0) {
      if (node.parentRef !== null || node.generation !== 0) {
        throw new PipelineGenomeInvalidError(`lineage root ${node.id} has parentRef '${node.parentRef}' / generation ${node.generation} (roots are parentless generation 0)`);
      }
    } else {
      const parent = lineage[index - 1]!;
      if (node.parentRef !== parent.id) {
        throw new PipelineGenomeInvalidError(`lineage node ${node.id} parentRef '${node.parentRef}' != chain predecessor ${parent.id}`);
      }
      if (node.generation !== parent.generation + 1) {
        throw new PipelineGenomeInvalidError(`lineage node ${node.id} generation ${node.generation} != ${parent.generation} + 1`);
      }
    }
  }
}

/** Fail-closed integrity check over a whole genome (unique ids, resolved parents, generation law). */
export function assertGenomeIntegrity(genome: PipelineGenome): void {
  if (genome.experimentId.length === 0) {
    throw new PipelineGenomeInvalidError("assertGenomeIntegrity: experimentId is empty");
  }
  const seen = new Set<string>();
  let roots = 0;
  const byId = new Map<string, NeutralPipelineGenomeNode>();
  for (const node of genome.nodes) {
    assertValidNodeId(node.id, "genome node");
    if (seen.has(node.id)) {
      throw new PipelineGenomeInvalidError(`assertGenomeIntegrity: duplicate node id '${node.id}'`);
    }
    seen.add(node.id);
    byId.set(node.id, node);
  }
  for (const node of genome.nodes) {
    assertValidScore(node.score, `node ${node.id}`);
    if (node.parentRef === null) {
      roots += 1;
      if (node.generation !== 0) {
        throw new PipelineGenomeInvalidError(`assertGenomeIntegrity: parentless node ${node.id} has generation ${node.generation} (parentless nodes are generation 0 roots)`);
      }
    } else {
      const parent = byId.get(node.parentRef);
      if (!parent) {
        throw new PipelineGenomeInvalidError(`assertGenomeIntegrity: node ${node.id} parentRef '${node.parentRef}' does not resolve`);
      }
      if (node.generation !== parent.generation + 1) {
        throw new PipelineGenomeInvalidError(`assertGenomeIntegrity: node ${node.id} generation ${node.generation} != parent ${parent.generation} + 1`);
      }
    }
  }
  if (roots !== 1) {
    throw new PipelineGenomeInvalidError(`assertGenomeIntegrity: expected exactly one root, found ${roots}`);
  }
}

/**
 * Lineage strength (W9C fixture model): the base plus the authored weight
 * of every mutation along the root -> leaf chain, capped and rounded — a
 * pure function of the chain (byte-identical replay).
 */
export function lineageStrength(lineage: readonly NeutralPipelineGenomeNode[]): number {
  assertLineageIntegrity(lineage);
  let strength = GENOME_BASE_STRENGTH;
  for (const node of lineage) {
    const weight = MUTATION_KIND_WEIGHTS[node.mutationKind];
    if (weight === undefined) {
      throw new PipelineGenomeInvalidError(`lineageStrength: mutationKind '${node.mutationKind}' has no authored weight`);
    }
    strength += weight;
  }
  return roundTo(Math.min(strength, GENOME_STRENGTH_CAP), 4);
}

/**
 * Deterministic hash-indexed mutation-kind selection for exploration step
 * (seed, experimentId, ordinal) — from the authored vocabulary only.
 */
export function nextMutationKind(seed: string, experimentId: string, ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 0) {
    throw new PipelineGenomeInvalidError(`nextMutationKind: ordinal must be an integer >= 0 (got ${ordinal})`);
  }
  const digest = sha256Hex(`${seed}|${experimentId}|mutation|${ordinal}`);
  const index = parseInt(digest.slice(0, 8), 16) % MUTATION_KINDS.length;
  return MUTATION_KINDS[index] ?? MUTATION_KINDS[0]!;
}
