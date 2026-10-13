// Pipeline Genome tests (W9C) — coverage: the lineage is append-only and
// immutable (appends return new genomes; ids are append-unique), the
// generation/parent laws are enforced fail-closed, best-node selection is
// a stable total order, lineage integrity checks catch broken genomes,
// lineage strength accumulates authored weights deterministically from the
// seed root, and mutation selection is hash-indexed from the authored
// vocabulary.
import assert from "node:assert/strict";
import test from "node:test";
import {
  GENOME_BASE_STRENGTH,
  GENOME_STRENGTH_CAP,
  MUTATION_KINDS,
  MUTATION_KIND_WEIGHTS,
  PIPELINE_GENOME_INVALID_CODE,
  PipelineGenomeInvalidError,
  appendGenomeMutation,
  appendGenomeNode,
  assertGenomeIntegrity,
  assertLineageIntegrity,
  bestGenomeNode,
  createPipelineGenome,
  createPipelineGenomeFromNode,
  genomeChildNodeId,
  genomeLineage,
  lineageStrength,
  nextMutationKind,
  seedGenomeNode,
  type NeutralPipelineGenomeNode,
} from "./pipelineGenome.js";
import { canonicalJson } from "../determinism.js";

const EXPERIMENT = "you_experiment_w9c-genometest";

test("genome: the root mints deterministically from (experimentId, seed)", () => {
  const root = seedGenomeNode(EXPERIMENT, "genome-test-seed");
  assert.match(root.id, /^you_genome-node_[0-9a-f]{16}$/);
  assert.equal(root.parentRef, null);
  assert.equal(root.mutationKind, "seed");
  assert.equal(root.generation, 0);
  assert.equal(root.simulated, true);
  assert.deepEqual(seedGenomeNode(EXPERIMENT, "genome-test-seed"), root);
  assert.notEqual(seedGenomeNode(EXPERIMENT, "other-seed").id, root.id);
  assert.throws(() => seedGenomeNode("", "s"), PipelineGenomeInvalidError);
  assert.throws(() => seedGenomeNode(EXPERIMENT, ""), PipelineGenomeInvalidError);
  const genome = createPipelineGenome(EXPERIMENT, "genome-test-seed", 0.5);
  assert.equal(genome.experimentId, EXPERIMENT);
  assert.equal(genome.nodes.length, 1);
  assert.equal(genome.nodes[0]!.score, 0.5);
  assertGenomeIntegrity(genome);
});

test("genome: appendGenomeMutation is append-only and immutable", () => {
  const genome = createPipelineGenome(EXPERIMENT, "genome-test-seed", 0.4);
  const rootId = genome.nodes[0]!.id;
  const extended = appendGenomeMutation(genome, rootId, "model-swap", 0.45);
  assert.equal(genome.nodes.length, 1, "the input genome is untouched (append-only)");
  assert.equal(extended.nodes.length, 2);
  const child = extended.nodes[1]!;
  assert.equal(child.parentRef, rootId);
  assert.equal(child.mutationKind, "model-swap");
  assert.equal(child.generation, 1);
  assert.equal(child.score, 0.45);
  assert.equal(child.simulated, true);
  // the child id is the deterministic append-position id
  assert.equal(child.id, genomeChildNodeId(genome, rootId, "model-swap"));
  // replaying the same append mints the identical genome
  const replay = appendGenomeMutation(genome, rootId, "model-swap", 0.45);
  assert.equal(canonicalJson(replay), canonicalJson(extended));
  assertGenomeIntegrity(extended);
});

test("genome: appends validate fail-closed (typed YOU_PIPELINE_GENOME_INVALID rejections)", () => {
  const genome = createPipelineGenome(EXPERIMENT, "genome-test-seed", 0.4);
  const rootId = genome.nodes[0]!.id;
  const malformed: readonly [string, () => unknown][] = [
    ["unknown parent", () => appendGenomeMutation(genome, "you_genome-node_missing00000", "model-swap", 0.5)],
    ["unknown mutation kind", () => appendGenomeMutation(genome, rootId, "spontaneous-mutation", 0.5)],
    ["root kind is not appendable", () => appendGenomeMutation(genome, rootId, "seed", 0.5)],
    ["score above 1", () => appendGenomeMutation(genome, rootId, "model-swap", 1.5)],
    ["score below 0", () => appendGenomeMutation(genome, rootId, "model-swap", -0.1)],
    ["score NaN", () => appendGenomeMutation(genome, rootId, "model-swap", Number.NaN)],
    [
      "appended node with null parent",
      () =>
        appendGenomeNode(genome, {
          id: "you_genome-node_nullparent00000",
          parentRef: null,
          mutationKind: "model-swap",
          score: 0.5,
          generation: 1,
          simulated: true,
        }),
    ],
    [
      "appended node with bad id prefix",
      () =>
        appendGenomeNode(genome, {
          id: "not-a-genome-node-id",
          parentRef: rootId,
          mutationKind: "model-swap",
          score: 0.5,
          generation: 1,
          simulated: true,
        }),
    ],
    [
      "appended node with wrong generation",
      () =>
        appendGenomeNode(genome, {
          id: "you_genome-node_wronggen000000",
          parentRef: rootId,
          mutationKind: "model-swap",
          score: 0.5,
          generation: 3,
          simulated: true,
        }),
    ],
    ["empty experimentId on create", () => createPipelineGenomeFromNode("", genome.nodes[0]!)],
    [
      "root with a parent",
      () => createPipelineGenomeFromNode(EXPERIMENT, { ...genome.nodes[0]!, parentRef: rootId }),
    ],
    [
      "root with wrong kind",
      () => createPipelineGenomeFromNode(EXPERIMENT, { ...genome.nodes[0]!, mutationKind: "model-swap" }),
    ],
  ];
  for (const [label, run] of malformed) {
    assert.throws(
      run,
      (error: unknown) => {
        assert.ok(error instanceof PipelineGenomeInvalidError, `${label}: typed error`);
        assert.equal(error.code, PIPELINE_GENOME_INVALID_CODE);
        return true;
      },
      label,
    );
  }
  // duplicate node ids are refused (append-unique lineage)
  const extended = appendGenomeMutation(genome, rootId, "model-swap", 0.5);
  assert.throws(
    () => appendGenomeNode(extended, { ...extended.nodes[1]!, parentRef: rootId, generation: 1 }),
    PipelineGenomeInvalidError,
  );
});

test("genome: bestGenomeNode is a stable total order (score, then generation, then id)", () => {
  const genome = createPipelineGenome(EXPERIMENT, "genome-test-seed", 0.4);
  const rootId = genome.nodes[0]!.id;
  let working = appendGenomeMutation(genome, rootId, "model-swap", 0.4);
  working = appendGenomeMutation(working, rootId, "tool-bind", 0.5);
  working = appendGenomeMutation(working, rootId, "evaluator-bump", 0.5);
  // tie on 0.5 between tool-bind and evaluator-bump: both generation 1, id order decides
  const best = bestGenomeNode(working);
  assert.equal(best.score, 0.5);
  const tied = working.nodes.filter((node) => node.score === 0.5);
  assert.equal(best.id, tied.map((node) => node.id).sort()[0]);
  // generation tie-break: a generation-1 node beats an equal-score generation-2 node
  let deeper = appendGenomeMutation(working, best.id, "parameter-tune", 0.5);
  assert.equal(bestGenomeNode(deeper).id, best.id);
  deeper = appendGenomeMutation(deeper, best.id, "model-swap", 0.6);
  assert.equal(bestGenomeNode(deeper).score, 0.6);
  assert.throws(() => bestGenomeNode({ experimentId: EXPERIMENT, nodes: [] }), PipelineGenomeInvalidError);
});

test("genome: genomeLineage returns the contiguous root -> node chain", () => {
  const genome = createPipelineGenome(EXPERIMENT, "genome-test-seed", 0.4);
  const rootId = genome.nodes[0]!.id;
  let working = appendGenomeMutation(genome, rootId, "model-swap", 0.45);
  working = appendGenomeMutation(working, working.nodes[1]!.id, "tool-bind", 0.5);
  const chain = genomeLineage(working, working.nodes[2]!.id);
  assert.equal(chain.length, 3);
  assert.equal(chain[0]!.id, rootId);
  assert.equal(chain[1]!.id, working.nodes[1]!.id);
  assert.equal(chain[2]!.id, working.nodes[2]!.id);
  assert.deepEqual(chain.map((node) => node.generation), [0, 1, 2]);
  assert.throws(() => genomeLineage(working, "you_genome-node_missing00000"), PipelineGenomeInvalidError);
});

test("genome: integrity checks catch broken genomes and lineages", () => {
  const genome = createPipelineGenome(EXPERIMENT, "genome-test-seed", 0.4);
  const root = genome.nodes[0]!;
  const child: NeutralPipelineGenomeNode = {
    id: "you_genome-node_child000000000",
    parentRef: root.id,
    mutationKind: "model-swap",
    score: 0.5,
    generation: 1,
    simulated: true,
  };
  const broken: readonly [string, { experimentId: string; nodes: readonly NeutralPipelineGenomeNode[] }][] = [
    ["duplicate ids", { experimentId: EXPERIMENT, nodes: [root, { ...root }] }],
    ["dangling parentRef", { experimentId: EXPERIMENT, nodes: [root, { ...child, parentRef: "you_genome-node_missing00000" }] }],
    ["generation mismatch", { experimentId: EXPERIMENT, nodes: [root, { ...child, generation: 4 }] }],
    ["two roots", { experimentId: EXPERIMENT, nodes: [root, { ...child, parentRef: null, generation: 0 }] }],
    ["parentless wrong generation", { experimentId: EXPERIMENT, nodes: [{ ...root, generation: 2 }] }],
    ["empty experiment", { experimentId: "", nodes: [root] }],
  ];
  for (const [label, bad] of broken) {
    assert.throws(() => assertGenomeIntegrity(bad), PipelineGenomeInvalidError, label);
  }
  assert.doesNotThrow(() => assertGenomeIntegrity({ experimentId: EXPERIMENT, nodes: [root, child] }));
  assert.throws(() => assertLineageIntegrity([]), PipelineGenomeInvalidError);
  assert.throws(() => assertLineageIntegrity([child]), PipelineGenomeInvalidError);
  assert.throws(
    () => assertLineageIntegrity([root, { ...child, parentRef: "you_genome-node_other0000000" }]),
    PipelineGenomeInvalidError,
  );
});

test("genome: lineage strength accumulates authored weights deterministically", () => {
  const genome = createPipelineGenome(EXPERIMENT, "genome-test-seed", 0.4);
  const rootId = genome.nodes[0]!.id;
  let working = appendGenomeMutation(genome, rootId, "model-swap", 0.45);
  working = appendGenomeMutation(working, working.nodes[1]!.id, "organization-restructure", 0.5);
  const chain = genomeLineage(working, working.nodes[2]!.id);
  const expected = GENOME_BASE_STRENGTH + MUTATION_KIND_WEIGHTS["seed"]! + MUTATION_KIND_WEIGHTS["model-swap"]! + MUTATION_KIND_WEIGHTS["organization-restructure"]!;
  assert.equal(lineageStrength(chain), expected);
  assert.equal(lineageStrength([seedGenomeNode(EXPERIMENT, "s")]), GENOME_BASE_STRENGTH);
  // the cap holds under a deep lineage
  let deep = working;
  for (let index = 0; index < 40; index++) {
    deep = appendGenomeMutation(deep, bestGenomeNode(deep).id, "organization-restructure", 0.9);
  }
  assert.ok(lineageStrength(genomeLineage(deep, bestGenomeNode(deep).id)) <= GENOME_STRENGTH_CAP);
  // unknown kinds never get a weight (fail-closed)
  assert.throws(
    () => lineageStrength([{ ...seedGenomeNode(EXPERIMENT, "s"), mutationKind: "spontaneous-mutation" }]),
    PipelineGenomeInvalidError,
  );
});

test("genome: mutation selection is hash-indexed, deterministic and closed", () => {
  const first = nextMutationKind("genome-test-seed", EXPERIMENT, 0);
  const second = nextMutationKind("genome-test-seed", EXPERIMENT, 0);
  assert.equal(first, second);
  assert.ok((MUTATION_KINDS as readonly string[]).includes(first));
  const seen = new Set<string>();
  for (let ordinal = 0; ordinal < 50; ordinal++) {
    seen.add(nextMutationKind("genome-test-seed", EXPERIMENT, ordinal));
  }
  assert.ok(seen.size > 1, "the selection varies across ordinals");
  assert.throws(() => nextMutationKind("s", EXPERIMENT, -1), PipelineGenomeInvalidError);
  assert.throws(() => nextMutationKind("s", EXPERIMENT, 1.5), PipelineGenomeInvalidError);
});
