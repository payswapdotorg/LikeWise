// Realtime media technology seed profiles (W7C) — the W7C realtime media
// stack registry additions (WebRTC-class transports: pion-webrtc, aiortc;
// SFU-class servers: livekit, mediasoup, janus-gateway; streaming
// protocols: whip — RFC 9725).
//
// DATA PROVENANCE: every license / maintenance / repo fact below was fetched
// from the public web during the one-time W7C research seeding on 2026-10-12
// (raw.githubusercontent.com LICENSE files, the github.com releases.atom /
// commits.atom feeds, and rfc-editor.org for the WHIP RFC). The fetched
// evidence is preserved in the sandbox research logs (research-w7c/).
// License and maintenance claims are static data by ship time. Capability
// tags and compatibility summaries are YOU-lab engineering assessments (not
// external claims) — see provenance.claimBasis on each profile. Aspects that
// could not be verified stay listed in provenance.unverifiedClaims (truth
// law — never invent, never present an unverified claim as verified).

import type { TechnologyProfile } from "./registry.js";

const RESEARCH_DATE = "2026-10-12";
const CLAIM_BASIS =
  "license/maintenance/repo facts fetched from the web during one-time W7C research; capabilityTags and compatibility are YOU-lab engineering assessments, not external claims";

export const REALTIME_SEED_PROFILES: readonly TechnologyProfile[] = [
  {
    id: "livekit",
    name: "LiveKit Server",
    kind: "runtime",
    capabilityTags: ["sfu-server", "webrtc-transport", "audio-video-transport", "data-transport", "go-server", "scalable-media"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://raw.githubusercontent.com/livekit/livekit/master/LICENSE",
      verified: true,
      note: "Apache License 2.0 text, per the livekit/livekit repository LICENSE file (master branch — the repository's default branch is master; the main branch does not exist).",
    },
    maintenance: [
      { kind: "github-release", signal: "v1.13.9", date: "2026-10-07", sourceUrl: "https://github.com/livekit/livekit/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/livekit/livekit",
    compatibility: {
      summary: "SFU-class realtime media server (W7C sfu-server class): scalable WebRTC selective forwarding over audio/video/data tracks — a fit for realtime avatar channels (RealtimeChannelDescriptor latency class 'realtime').",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/livekit/livekit/master/LICENSE",
        "https://github.com/livekit/livekit/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the alignment between repository tags and the distributed cloud/oss binaries not verified at research time (the GitHub release feed is the maintenance signal)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "mediasoup",
    name: "mediasoup",
    kind: "library",
    capabilityTags: ["sfu-server", "webrtc-transport", "audio-video-transport", "data-transport", "node-library", "ortc-layer"],
    license: {
      spdxId: "ISC",
      name: "ISC License",
      sourceUrl: "https://raw.githubusercontent.com/versatica/mediasoup/v3/LICENSE",
      verified: true,
      note: "ISC License, Copyright (c) 2015, Iñaki Baz Castillo, per the versatica/mediasoup repository LICENSE file (v3 branch — the repository's default branch). ISC is a permissive license in spirit but OUTSIDE the authored you-lab permissive SPDX set (MIT/Apache-2.0/BSD-2-Clause/BSD-3-Clause) — production use needs a one-line set addition by the TL (honest disclosure, not silently waved through).",
    },
    maintenance: [
      { kind: "github-release", signal: "3.29.0", date: "2026-10-08", sourceUrl: "https://github.com/versatica/mediasoup/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/versatica/mediasoup",
    compatibility: {
      summary: "SFU-class realtime media library (W7C sfu-server class): Node.js/Rust WebRTC SFU at the ORTC layer — embeddable realtime avatar channels. ISC license is outside the authored permissive SPDX set (blocked pending TL review).",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/versatica/mediasoup/v3/LICENSE",
        "https://github.com/versatica/mediasoup/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the npm package feeds (mediasoup + mediasoup-client) not consulted at research time (the GitHub release feed is the maintenance signal)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "janus-gateway",
    name: "Janus WebRTC Server",
    kind: "runtime",
    capabilityTags: ["sfu-server", "webrtc-transport", "audio-video-transport", "data-transport", "c-server", "plugin-architecture"],
    license: {
      spdxId: "GPL-3.0",
      name: "GNU General Public License v3.0",
      sourceUrl: "https://raw.githubusercontent.com/meetecho/janus-gateway/master/COPYING",
      verified: true,
      note: "GNU General Public License v3.0 text, per the meetecho/janus-gateway repository COPYING file (master branch; the license file is COPYING, not LICENSE). GPL-3.0 is NOT in the you-lab permissive SPDX set — this profile deliberately exercises the not-production-friendly branch.",
    },
    maintenance: [
      { kind: "github-release", signal: "v1.4.2", date: "2026-09-23", sourceUrl: "https://github.com/meetecho/janus-gateway/releases.atom", verified: true },
      { kind: "github-commit", signal: "commits/master (latest observed: 'SIP plugin: clear late_offer after late_ack so re-INVITEs are ACKed')", date: "2026-10-05", sourceUrl: "https://github.com/meetecho/janus-gateway/commits/master.atom", verified: true },
    ],
    repoUrl: "https://github.com/meetecho/janus-gateway",
    compatibility: {
      summary: "SFU-class realtime media server (W7C sfu-server class): general-purpose WebRTC server with a plugin architecture. GPL-3.0 — not production-friendly without legal review.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/meetecho/janus-gateway/master/COPYING",
        "https://github.com/meetecho/janus-gateway/releases.atom",
        "https://github.com/meetecho/janus-gateway/commits/master.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "repository commit activity (2026-10-05) is fresher than the latest observed release v1.4.2 (2026-09-23); the alignment between repository tags and the distributed packages not verified at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "pion-webrtc",
    name: "Pion WebRTC",
    kind: "library",
    capabilityTags: ["webrtc-transport", "audio-video-transport", "data-transport", "go-library"],
    license: {
      spdxId: "MIT",
      name: "MIT License",
      sourceUrl: "https://raw.githubusercontent.com/pion/webrtc/main/LICENSE",
      verified: true,
      note: "MIT License, Copyright (c) 2026 The Pion community <https://pion.ly>, per the pion/webrtc repository LICENSE file (main branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "v4.2.23", date: "2026-10-07", sourceUrl: "https://github.com/pion/webrtc/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/pion/webrtc",
    compatibility: {
      summary: "WebRTC-class transport implementation (W7C webrtc-transport class): pure-Go WebRTC stack over audio/video/data tracks — a fit for embedding realtime avatar channels without a native dependency.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/pion/webrtc/main/LICENSE",
        "https://github.com/pion/webrtc/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the pion ecosystem spans many repositories (the webrtc repo is the core); per-package npm/go module feeds not consulted at research time",
      ],
    },
    editorCapable: false,
  },
  {
    id: "aiortc",
    name: "aiortc",
    kind: "library",
    capabilityTags: ["webrtc-transport", "audio-video-transport", "data-transport", "python-library"],
    license: {
      spdxId: "BSD-3-Clause",
      name: "BSD 3-Clause License",
      sourceUrl: "https://raw.githubusercontent.com/aiortc/aiortc/main/LICENSE",
      verified: true,
      note: "BSD 3-Clause redistribution text, Copyright (c) Jeremy Lainé, per the aiortc/aiortc repository LICENSE file (main branch).",
    },
    maintenance: [
      { kind: "github-release", signal: "1.15.0", date: "2026-07-13", sourceUrl: "https://github.com/aiortc/aiortc/releases.atom", verified: true },
    ],
    repoUrl: "https://github.com/aiortc/aiortc",
    compatibility: {
      summary: "WebRTC-class transport implementation (W7C webrtc-transport class): Python WebRTC/ORTC stack over audio/video/data tracks — a fit for server-side realtime avatar channels in Python environments.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://raw.githubusercontent.com/aiortc/aiortc/main/LICENSE",
        "https://github.com/aiortc/aiortc/releases.atom",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the PyPI upload feed not consulted at research time (the GitHub release feed is the maintenance signal)",
      ],
    },
    editorCapable: false,
  },
  {
    id: "whip",
    name: "WHIP (WebRTC-HTTP Ingestion Protocol)",
    kind: "format",
    capabilityTags: ["streaming-protocol", "webrtc-ingest", "audio-video-transport", "ietf-standard"],
    license: {
      spdxId: null,
      name: "IETF Trust Legal Provisions (TLP) — document copyright; code components under Revised BSD",
      sourceUrl: "https://www.rfc-editor.org/rfc/rfc9725.txt",
      verified: true,
      note: "RFC 9725 (March 2025, Standards Track / Proposed Standard; updates RFC 8840 and RFC 8842): 'Copyright (c) 2025 IETF Trust... This document is subject to BCP 78 and the IETF Trust's Legal Provisions Relating to IETF Documents... Code Components extracted from this document must include Revised BSD License text'. A protocol document, not a software package — no software SPDX id applies (custom/non-SPDX entry with explanatory note).",
    },
    maintenance: [
      { kind: "ietf-rfc", signal: "RFC 9725 (WHIP)", date: "2025-03-01", sourceUrl: "https://www.rfc-editor.org/rfc/rfc9725.txt", verified: true },
    ],
    repoUrl: "https://www.rfc-editor.org/rfc/rfc9725.txt",
    compatibility: {
      summary: "Streaming protocol (W7C streaming-protocol class): HTTP-based signaling for WebRTC ingestion into streaming services/CDNs — a fit for ingest-side realtime avatar channels. A frozen standards-track protocol: maintenance is errata-driven, not release-driven.",
      verified: false,
    },
    provenance: {
      researchDate: RESEARCH_DATE,
      sourceUrls: [
        "https://www.rfc-editor.org/rfc/rfc9725.txt",
        "https://www.rfc-editor.org/rfc-index.txt",
      ],
      claimBasis: CLAIM_BASIS,
      unverifiedClaims: [
        "the RFC header states only 'March 2025' — the exact publication DAY is not verified (the datatracker API was inaccessible from the sandbox, HTTP 403); the signal date 2025-03-01 is month precision. Even at the latest possible day (2025-03-31) the signal ages 560 days by the research date, so any plausible maintenance gate outcome is unchanged",
        "maintenance for a frozen standards-track protocol means errata/updates, not releases; no errata activity was verified at research time",
      ],
    },
    editorCapable: false,
  },
];
