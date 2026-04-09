---
name: code-quality
description: Run Biome (TypeScript/React linting + formatting) and Ruff (Python linting + formatting) across the project. Fixes auto-fixable issues and reports the rest.
---

# Code Quality Check

Runs two tools in parallel — Biome for the TypeScript/Electron/React side, Ruff for the Python FastAPI backend.

## Tools

| Tool | Covers | Replaces |
|------|--------|----------|
| [Biome](https://biomejs.dev/) | TypeScript, React, JS | ESLint + Prettier |
| [Ruff](https://docs.astral.sh/ruff/) | Python | Flake8 + isort + Black + pylint |

---

## Step 1: Ensure Tools Are Installed

```bash
# Biome — install as dev dependency if not present
npm list @biomejs/biome || npm install --save-dev @biomejs/biome

# Ruff — install in Python environment
pip show ruff || pip install ruff
```

---

## Step 2: Run Biome on TypeScript/React

```bash
# Check and auto-fix
npx biome check --apply src/ electron/

# Or check only (no writes)
npx biome check src/ electron/
```

If no `biome.json` config exists yet, initialize one:
```bash
npx biome init
```

Key rules Biome enforces by default:
- No unused imports/variables
- Consistent formatting (indentation, quotes, semicolons)
- React hooks rules
- Accessibility basics

---

## Step 3: Run Ruff on Python Backend

```bash
# Lint + fix auto-fixable issues
ruff check backend/ --fix

# Format
ruff format backend/
```

If no `ruff.toml` or `pyproject.toml` config exists, Ruff runs with sensible defaults. To add config:
```toml
# pyproject.toml
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]  # pycodestyle, pyflakes, isort, pyupgrade
```

---

## Step 4: TypeScript Type Check

```bash
npx tsc --noEmit
```

This catches type errors that Biome does not (Biome is a linter, not a type checker).

---

## Step 5: Report

Summarize findings:

```
Code Quality Report
───────────────────
Biome:   X issues fixed, Y remaining
Ruff:    X issues fixed, Y remaining
tsc:     X type errors

Files changed: [list]
Remaining issues: [list with file:line]
```

Fix remaining issues inline unless they require architectural decisions — in that case, list them for the user.

---

## When to Run

- Before `/commit` — ensure no lint errors in staged files
- After implementing a feature — clean up before code review
- On demand: `/code-quality`
