# Issue tracker: Local Markdown (single file)

Issues and tasks for this repo live in one file: `docs/tasks.md`. This repo is worked on by multiple
agent tools (Claude Code, Antigravity) at different times, so a single flat file that any tool can
open and update is preferred over GitHub Issues or a `.scratch/<feature>/issues/NN-slug.md` tree.

## Conventions

- Each unit of work is a `### Phase N: <title>` section in `docs/tasks.md`, ordered top-to-bottom by
  dependency (earlier phases should land before later ones depend on them).
- Each section has a `Status:` line (`pending` / `in_progress` / `completed`), a short description of
  what needs to happen and which files it touches, and — once worked on — a `Notes:` sub-list of what
  was actually done, any deviations from plan, and follow-ups it revealed.
- PRs as a request surface: **off**. External PRs are not treated as tickets in this tracker.

## When a skill says "publish to the issue tracker"

Append a new `### Phase N: <title>` section to `docs/tasks.md`, or edit an existing section if the
work refines a task already listed there.

## When a skill says "fetch the relevant ticket"

Read the matching `### Phase N: ...` section in `docs/tasks.md`. The user will normally reference it
by phase number or title.

## Handing work to another agent (e.g. Antigravity)

Before handing off, make sure the target section in `docs/tasks.md` is self-contained: what changes,
which files, what "done" looks like, and any decisions already made (e.g. see `docs/agents/domain.md`
for where broader architectural decisions get recorded). Update `Status:` to `in_progress` when a
tool picks up a phase so two tools don't duplicate the same work.
