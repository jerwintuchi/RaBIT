---
name: RaBIT Rendering Strategy
description: WebGL2 canvas renderer design decisions
type: project
---

Decided in Phase 2 (Architecture).

- WebGL2 context owns: composite framebuffer, scratch buffer, onion buffer, texture cache (LRU, 64 textures max)
- Pixel data lives as Uint8ClampedArray in JS memory; uploaded to GPU textures when dirty
- Dirty flag system: LAYER_DATA | LAYER_ORDER | ONION | OVERLAY | FULL — only necessary work re-done per rAF tick
- Stroke preview: rendered to scratchBuffer (GPU only); committed to undo stack only on pointerUp
- Onion skin: pre-composited into onionBuffer on frame change; overlay on composite each frame
- Large canvases (≥ 2048×2048): tiled into 1024×1024 GPU sub-textures

**Why:** 60fps target at 4K canvas size is not achievable with CPU 2D canvas API.
**How to apply:** All visual output goes through the WebGL2 renderer. No CSS transforms or 2D canvas for pixel content.
