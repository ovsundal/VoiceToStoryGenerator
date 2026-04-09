---
description: Create a new git commit
---

# Commit: Create Atomic Git Commit

## Steps

### 1. Check Uncommitted Changes

```bash
git status && git diff HEAD && git status --porcelain
```

Review all modified and untracked files.

### 2. Stage Files

Add relevant untracked and modified files to the staging area. Be selective — avoid staging files that shouldn't be committed (e.g., `.env`, secrets, build artifacts).

### 3. Write the Commit Message

- Be **atomic**: one logical change per commit
- Be **accurate**: the message must reflect the actual changes
- Be **concise**: one clear sentence describing what and why

### 4. Add a Semantic Tag

Prefix the commit message with the appropriate tag:

| Tag | Use |
|-----|-----|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructure, no behavior change |
| `test` | Adding or updating tests |
| `chore` | Tooling, deps, config |
| `style` | Formatting, no logic change |

### Example

```bash
git add src/main/transcriber.ts
git commit -m "feat: add whisper subprocess transcription pipeline"
```
