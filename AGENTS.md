# AGENTS.md

Instructions for AI agents (Claude Code, Antigravity, etc.) working in this repo.

## Agent skills

### Issue tracker

Issues/tasks live in `docs/tasks.md` (single flat file, one `### Phase N` section per task). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the repo root (created lazily, not yet present). See `docs/agents/domain.md`.

### API / data contract

Server Actions return `ActionResult<T>` (`src/lib/action-result.ts`) instead of throwing for expected
failures; list actions return `{ items, page, pageSize, totalCount }`. Applied to new/touched code,
ahead of a planned mobile app that will need to reuse the same logic via HTTP. See
`docs/agents/api-contract.md`.
