---
name: e2e-test
description: Comprehensive end-to-end testing command. Launches parallel sub-agents to research the codebase (structure, database schema, potential bugs), then uses the Vercel Agent Browser CLI to test every user journey — taking screenshots, validating UI/UX, and querying the database to verify records. Run after implementation to validate everything before code review.
disable-model-invocation: true
---

# End-to-End Application Testing

## Pre-flight Check

### 1. Platform Check

Verify Linux, WSL, or macOS compatibility:
```bash
uname -s
```
If Windows (not WSL), stop and notify user that agent-browser requires Linux/WSL/macOS.

### 2. Frontend Check

Verify the application has a browser-accessible frontend by checking for `package.json`, framework config files, and web server configuration.

### 3. agent-browser Installation

```bash
# Check if installed
agent-browser --version

# Install if missing
npm install -g @agentlabs/agent-browser

# Set up browser engine
agent-browser install --with-deps

# Verify
agent-browser --version
```

---

## Phase 1: Parallel Research

Launch three simultaneous sub-agents:

### Sub-agent 1: Application Structure & User Journeys
Research:
- Startup commands and dev server setup
- Authentication flows (if any)
- All routes and pages
- Complete user journeys from start to finish
- Interactive UI components and forms

### Sub-agent 2: Database Schema & Data Flows
Research:
- Database type and connection environment variables
- Full schema (tables, columns, relationships)
- What data is written/read per user action
- Validation queries to confirm data after each action

### Sub-agent 3: Bug Hunting
Research:
- Logic errors and edge cases
- UI/UX inconsistencies
- Data integrity risks
- Security concerns
- File references for each finding

---

## Phase 2: Start the Application

1. Install dependencies (`npm install`, `pip install`, etc.)
2. Start dev server in background
3. Open with agent-browser: `agent-browser open <local-url>`
4. Capture initial screenshot: `agent-browser screenshot initial.png`

---

## Phase 3: Create Task List

Use TaskCreate to create one task per user journey identified in Phase 1, plus a responsive testing task. Include bug findings from Sub-agent 3 in the relevant journey tasks.

---

## Phase 4: User Journey Testing

### 4a. Browser Testing

For each user journey:

```bash
# Navigate
agent-browser open <url>

# Snapshot interactive elements
agent-browser snapshot -i

# Interact using refs
agent-browser click @e1
agent-browser fill @e2 "value"
agent-browser select @e3 "option"
agent-browser press Enter

# Wait for result
agent-browser wait --load networkidle
agent-browser wait --url "**/expected-path"
agent-browser wait --text "Expected text"

# Capture and analyze
agent-browser screenshot journey-name-step.png
agent-browser get url
agent-browser get text @e1

# Check for errors
agent-browser console
agent-browser errors
```

> Re-snapshot after navigation or significant DOM changes — refs are invalidated.

Steps per interaction:
1. Snapshot to get current refs
2. Perform action
3. Wait for result
4. Take screenshot
5. Analyze outcome
6. Check console for errors

### 4b. Database Validation

After any action that writes data, validate via query:

```bash
# PostgreSQL
psql $DATABASE_URL -c "SELECT * FROM table WHERE condition;"

# SQLite
sqlite3 database.db "SELECT * FROM table WHERE condition;"

# Other: use a project script or ORM shell
```

Verify:
- Records exist with correct values
- Relationships are intact
- No orphaned or duplicate records

### 4c. Issue Handling

1. Document the issue (what, where, screenshot)
2. Fix the code
3. Re-run the affected journey
4. Confirm resolution

### 4d. Responsive Testing

Test at these viewport sizes:

```bash
# Mobile
agent-browser set viewport 375 812
agent-browser screenshot responsive-mobile.png

# Tablet
agent-browser set viewport 768 1024
agent-browser screenshot responsive-tablet.png

# Desktop
agent-browser set viewport 1440 900
agent-browser screenshot responsive-desktop.png
```

Analyze layout, overflow, readability, and touch target sizes at each size.

---

## Phase 5: Cleanup

```bash
# Stop dev server (kill background process)
# Close browser session
agent-browser close
```

---

## Phase 6: Report

### Text Summary

```
E2E Test Complete
─────────────────
Journeys tested:   X
Screenshots taken: X
Issues fixed:      X
Issues remaining:  X

Fixed:
- [description] (file:line)

Remaining:
- [description] — [reason not fixed]

Bug hunt findings:
- [finding] (file:line)

Screenshots: ./screenshots/
```

### Markdown Export (optional)

If the user requests a detailed report, export findings to `e2e-test-report.md` containing:
- Journey-by-journey breakdown with screenshots
- Database validation results
- Issues found, fixed, and remaining
- Recommendations for follow-up
