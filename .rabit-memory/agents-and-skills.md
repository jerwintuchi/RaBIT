---
name: RaBIT Agents and Skills Map
description: Maps project phases and task types to subagent types and skills Claude should invoke proactively
type: project
---

# RaBIT — Agents & Skills Reference

Claude should use this to decide when to invoke subagents or skills WITHOUT waiting to be asked.
The rule: if the task type matches a row below, invoke the listed agent/skill proactively.

---

## Subagent Types

| Agent | When to use in RaBIT |
|---|---|
| `Explore` | Searching the codebase for patterns, finding which file owns a behavior, auditing imports or dependencies |
| `Plan` | Designing an implementation strategy before writing code (e.g., "how should the CommandSystem be structured?") |
| `general-purpose` | Library/dependency research (comparing crates, checking npm package quality, reading docs), complex multi-step lookups |
| `claude-code-guide` | Questions about Claude Code, Claude API, Anthropic SDK, MCP, hooks, settings |

**Parallel agent rule:** If two or more research tasks are independent, launch them in a single message with multiple Agent tool calls. Do not run them sequentially.

---

## Skills — When to Invoke Proactively

| Skill | Trigger condition in RaBIT |
|---|---|
| `simplify` | After implementing any module or component — review for reuse, quality, efficiency |
| `security-review` | Before any milestone release checkpoint; after implementing file I/O (project save/load), export pipeline, or any Rust IPC command |
| `review` | When a logical "PR-equivalent" chunk of implementation is complete |
| `anthropic-skills:skill-creator` | When a recurring RaBIT-specific workflow needs a dedicated skill (see custom skill ideas below) |
| `anthropic-skills:consolidate-memory` | When `.rabit-memory/` files accumulate redundancy or the MEMORY.md index exceeds ~150 lines |
| `less-permission-prompts` | After any implementation session with many bash/tool calls — reduce repetitive permission prompts |
| `update-config` | When the user says "whenever X do Y" or "from now on..." — this needs a hook, not memory |
| `init` | Only if CLAUDE.md becomes stale or a major architecture pivot happens |

---

## Phase-to-Agent/Skill Matrix

| Phase | Primary Agent/Skill |
|---|---|
| 1 — PRD | None needed (writing, not research) |
| 2 — Architecture | `Plan` agent for module design decisions |
| 3 — UI/UX Design | `Plan` agent for layout/interaction model |
| 4 — Stack Decision | `general-purpose` for library research in parallel |
| 5 — Data Model | `Plan` agent for schema design |
| 6 — Milestones | None (internal planning) |
| 7 — Implementation | `Explore` for codebase search; `simplify` after each module; `security-review` at Rust IPC + file I/O |
| 8 — Optimization | `Explore` for hotspot identification; `general-purpose` for benchmarking research |

---

## Custom Skill Ideas (create via `anthropic-skills:skill-creator` when needed)

These don't exist yet — create them when we hit the relevant phase:

| Skill Name | What it would do | When to create |
|---|---|---|
| `rabit-module-scaffold` | Scaffold a new RaBIT module (correct folder, index.ts, types.ts, tests) following project conventions | Before Phase 7 implementation |
| `rabit-rust-command` | Add a new Tauri command: Rust handler + TypeScript typed wrapper + IPC bridge registration | Phase 7 — when adding Rust commands |
| `rabit-shader` | Scaffold a new WebGL2 shader program (vert + frag + JS loader + type definitions) | Phase 7 — rendering work |
| `rabit-release-check` | Pre-release checklist: run tests, security-review, check perf budgets, verify license audit | Phase 7/8 — before any release |

---

## Decision Log

- **2026-04-19:** Document created. User confirmed Claude should invoke agents/skills proactively without being asked.
- Subagents: proactive, parallel when independent.
- Skills: proactive when trigger condition matches. Never wait for user to say "use skill X."
