# YOU Technology and Provider Ecosystem

## Registry rule

Every replaceable technology is represented by:

- technologyId;
- version;
- adapterVersion;
- capability profile;
- inputs;
- outputs;
- resource requirements;
- benchmark evidence;
- latency;
- cost;
- rights/license;
- provenance;
- failure classes;
- production status.

## Open-source research families

### Reconstruction / geometry

- COLMAP
- AliceVision/Meshroom
- SMPL-X
- PIFu / PIFuHD
- ICON
- ECON
- HUGS
- Gaussian-avatar families
- relevant human-neural-rendering projects

### Vision / tracking

- SAM 2
- MMPose
- MediaPipe

### Avatar / realtime

- three-vrm
- glTF-Transform
- WebGPU/Three.js ecosystem
- WebRTC

### Asset / environment

- Blender
- OpenUSD
- Godot
- other open scene/asset tooling

### Media / editorial

- OpenTimelineIO
- OpenReel
- WebCodecs ecosystem
- FFmpeg where deployment/licensing strategy permits

### Annotation / vector

- Excalidraw
- SVG-Edit

## Closed/provider research families

Investigate only through published documentation, public papers, authorized APIs/SDKs or observable output from legitimate access:

- OpenAI
- Anthropic
- xAI/Grok
- Google/Vertex AI
- HeyGen
- Tavus
- D-ID
- Synthesia
- NVIDIA ACE
- MetaHuman
- Autodesk/Flow Studio
- Rokoko
- relevant regional providers in China, Japan, Korea, India and other markets

## Model/technology selection

The runtime chooses by:

capability + policy + evidence + rights + cost + latency + availability + platform + user intent.

There is no globally best provider.

## Licensing

Track separately:

- source-code license;
- model-weight license;
- dataset license;
- dependency licenses;
- API/provider terms;
- commercial-use constraints.

Research-only or non-commercial candidates cannot pass the production gate.

## System-one/system-two

These are runtime routing profiles.

Do not encode a specific provider name into the semantic contract.

## Provider isolation

Provider names and credentials belong in adapter implementations/configuration.

Core contracts remain provider-neutral.

## Open-source integration rule

Prefer reuse over reinvention, but only when:

- license is compatible;
- maintenance is acceptable;
- security is acceptable;
- required functionality is actually available;
- round-trip behavior can be tested;
- no protected internals are copied.

Record the decision in the technology registry and an ADR when architectural impact exists.
