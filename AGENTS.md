# AGENTS

## Goal
- Keep changes small, safe, and easy to review.
- Prefer project conventions over personal style.

## Workflow
1. Read relevant docs in `docs/` and active rules in `.cursor/rules/`.
2. Propose a short plan for non-trivial tasks.
3. Edit only files related to the task.
4. Run checks relevant to touched files.
5. Explain what changed and why.

## Boundaries
- Do not refactor unrelated areas.
- Do not change public API/contracts without explicit request.
- Do not add dependencies unless necessary and justified.

## Quality Bar
- New behavior should be covered by tests where practical.
- Preserve backward compatibility unless asked otherwise.
- Keep naming and structure consistent with nearby code.

## Security
- Never commit secrets or credentials.
- Validate external input and fail safely.

## Delivery
- Provide clear file-level summary.
- Include run/verify steps if execution is not possible.
