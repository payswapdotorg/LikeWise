import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityGap } from "./contract.js";
import { recordCapabilityGap } from "./gap.js";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import {
  GAP_PROJECTION_DEFAULT_REMEDIATION,
  defaultRequiredCapability,
  projectKnowledgeGap,
  projectToolGap,
} from "./gapProjections.js";

const DEPS = {
  clock: createDeterministicClock(),
  ids: createRngIdFactory(createDeterministicRng(9909)),
};

function toolGap(): CapabilityGap {
  const gap = recordCapabilityGap(
    {
      intentRef: "you_intent_0000000000000001",
      attemptedStrategies: [{ strategy: "gltf-transform", outcome: "failed", evidenceRef: null }],
      failureEvidence: ["you_evidence_0000000000000001"],
      category: "TOOL_GAP",
      confidence: 0.8,
      suggestedNextAction: "substitute-gltf-pipeline",
    },
    DEPS,
  );
  return gap;
}

function knowledgeGap(): CapabilityGap {
  return recordCapabilityGap(
    {
      attemptedStrategies: [{ strategy: "proportion-rules-lookup", outcome: "partial", evidenceRef: null }],
      category: "KNOWLEDGE_GAP",
      confidence: 0.6,
      suggestedNextAction: "human-proportion-rules",
    },
    DEPS,
  );
}

test("a TOOL_GAP record projects onto the tool inventory with derived defaults", () => {
  const gap = toolGap();
  const result = projectToolGap(gap);
  assert.ok(result.ok);
  if (!result.ok) {
    return;
  }
  const projection = result.projection;
  assert.equal(projection.gapId, gap.id);
  assert.equal(projection.toolId, null);
  assert.equal(projection.requiredCapability, "substitute-gltf-pipeline");
  assert.equal(projection.remediation, GAP_PROJECTION_DEFAULT_REMEDIATION.TOOL_GAP);
  assert.ok(Object.isFrozen(projection));
});

test("a KNOWLEDGE_GAP record projects onto knowledge domains with derived defaults", () => {
  const gap = knowledgeGap();
  const result = projectKnowledgeGap(gap);
  assert.ok(result.ok);
  if (!result.ok) {
    return;
  }
  const projection = result.projection;
  assert.equal(projection.gapId, gap.id);
  assert.equal(projection.domain, "human-proportion-rules");
  assert.equal(projection.missingKnowledgeRef, null);
  assert.equal(projection.remediation, GAP_PROJECTION_DEFAULT_REMEDIATION.KNOWLEDGE_GAP);
  assert.ok(Object.isFrozen(projection));
});

test("explicit inputs override the derived defaults", () => {
  const tool = projectToolGap(toolGap(), {
    toolId: "you_tool_0000000000000007",
    requiredCapability: "mesh-repair",
    remediation: "install-blender-adapter",
  });
  assert.ok(tool.ok);
  if (!tool.ok) {
    return;
  }
  assert.equal(tool.projection.toolId, "you_tool_0000000000000007");
  assert.equal(tool.projection.requiredCapability, "mesh-repair");
  assert.equal(tool.projection.remediation, "install-blender-adapter");

  const knowledge = projectKnowledgeGap(knowledgeGap(), {
    domain: "anthropometry",
    missingKnowledgeRef: "you_content_0123456789abcdef",
    remediation: "scoped-knowledge-patch",
  });
  assert.ok(knowledge.ok);
  if (!knowledge.ok) {
    return;
  }
  assert.equal(knowledge.projection.domain, "anthropometry");
  assert.equal(knowledge.projection.missingKnowledgeRef, "you_content_0123456789abcdef");
  assert.equal(knowledge.projection.remediation, "scoped-knowledge-patch");
});

test("category gates refuse the wrong projection kind with stable reasons", () => {
  const toolOnKnowledge = projectToolGap(knowledgeGap());
  assert.ok(!toolOnKnowledge.ok);
  if (toolOnKnowledge.ok) {
    return;
  }
  assert.equal(toolOnKnowledge.refusal.reason, "category-not-tool-gap");

  const knowledgeOnTool = projectKnowledgeGap(toolGap());
  assert.ok(!knowledgeOnTool.ok);
  if (knowledgeOnTool.ok) {
    return;
  }
  assert.equal(knowledgeOnTool.refusal.reason, "category-not-knowledge-gap");
});

test("empty derived facts refuse (projections carry non-empty remediation facts)", () => {
  const blankAction = { ...toolGap(), suggestedNextAction: "" } as CapabilityGap;
  assert.equal(defaultRequiredCapability(blankAction), "tool_gap");
  const refused = projectToolGap(toolGap(), { remediation: "  " });
  assert.ok(!refused.ok);
  if (refused.ok) {
    return;
  }
  assert.equal(refused.refusal.reason, "remediation-empty");

  const blankCapability = projectToolGap(toolGap(), { requiredCapability: "" });
  assert.ok(!blankCapability.ok);
  if (blankCapability.ok) {
    return;
  }
  assert.equal(blankCapability.refusal.reason, "required-capability-empty");

  const blankDomain = projectKnowledgeGap(knowledgeGap(), { domain: "" });
  assert.ok(!blankDomain.ok);
  if (blankDomain.ok) {
    return;
  }
  assert.equal(blankDomain.refusal.reason, "domain-empty");
});

test("defaultRequiredCapability falls back to the category token on blank actions", () => {
  const gap: CapabilityGap = { ...knowledgeGap(), suggestedNextAction: "   " };
  assert.equal(defaultRequiredCapability(gap), "knowledge_gap");
  assert.equal(defaultRequiredCapability(toolGap()), "substitute-gltf-pipeline");
});
