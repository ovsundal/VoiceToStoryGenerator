---
description: Create a Product Requirements Document through structured conversation
---

# Create PRD: Product Requirements Document

## Objective

Transform conversation history and user input into a comprehensive, professional PRD.

## Process

### 1. Extract Requirements

Analyze the conversation to identify:
- Core problem being solved
- Target users
- Key features and constraints
- Technical preferences mentioned

### 2. Synthesize with Assumptions

Fill gaps with reasonable assumptions. Flag assumptions clearly so the user can correct them.

### 3. Write the PRD

Produce a document with these 15 sections:

1. **Executive Summary** — one paragraph overview
2. **Mission** — the core purpose and value proposition
3. **Target Users** — who uses this and their key needs
4. **MVP Scope** — what's in vs. explicitly deferred (use checkboxes)
5. **User Stories** — as a [user], I want [goal], so that [benefit]
6. **Architecture & Patterns** — high-level technical design
7. **Tools & Features** — key capabilities with brief descriptions
8. **Technology Stack** — languages, frameworks, libraries, tools
9. **Security & Configuration** — auth, secrets, env vars, permissions
10. **API Specification** — endpoints, payloads, response formats (if applicable)
11. **Success Criteria** — measurable outcomes that define done
12. **Implementation Phases** — 3–4 phases with clear deliverables per phase
13. **Future Considerations** — post-MVP ideas, explicitly deferred
14. **Risks & Mitigations** — known risks with mitigation strategies
15. **Appendix** — reference material, links, glossary

### 4. Quality Check

Before outputting:
- [ ] All 15 sections present
- [ ] Concrete examples provided (not vague placeholders)
- [ ] In-scope vs. deferred items clearly distinguished
- [ ] Implementation phases are realistic and sequential
- [ ] Tech stack is specific (versions where known)

## Output

Save to: `.claude/PRD.md`

## Style Guide

- Use markdown with clear headers
- Prefer bullet points and tables over prose paragraphs
- Be action-oriented: "Users can..." not "The system will allow..."
- Target 30–60 sections total (comprehensive but scannable)
- No filler — every sentence earns its place
