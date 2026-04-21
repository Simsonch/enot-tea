# Coding Style

## General
- Favor simple, explicit code over abstraction-heavy solutions.
- Keep files and functions focused and reasonably small.
- Reuse existing patterns from nearby code.

## Naming
- Use descriptive names for variables and functions.
- Avoid vague names like `data`, `tmp`, `handler2` unless temporary in tiny scope.

## Errors
- Fail early with actionable error messages.
- Do not swallow exceptions silently.

## Logging
- Log operationally useful context.
- Do not log secrets or personal data.

## Reviews
- Each change should include rationale and verification steps.
