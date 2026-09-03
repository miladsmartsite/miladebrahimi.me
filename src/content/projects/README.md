# Adding a New System / Project

Not rendered on the site. Adding a sixth (or seventh) real system should never require touching
a page or component — this is the workflow.

## The workflow

1. Create `src/content/projects/my-new-system.md`.
2. Fill in the frontmatter — see the five existing files in this folder for real examples.
3. Set `draft: false` when ready to publish.

The filename becomes the URL (`my-new-system.md` → `/projects/my-new-system`).

## What happens automatically

- Appears on `/projects` (the systems archive) and, if `featured: true`, in the homepage's
  Selected Systems section — both read from `order`.
- Appears in the domain filter on `/projects` automatically if its `tags` include one already in
  use (`src/lib/site.ts`'s `DOMAIN_CODES`).
- Gets a full case-study page at `/projects/<slug>` using whichever of the case-study fields
  you've filled in (see below) — an empty field simply doesn't render its section; numbering
  never drifts.
- Gets a conceptual `SystemPreview` diagram based on `previewType`.
- Shows up under "Related Systems" on any other system that shares a tag.

## Frontmatter reference

```markdown
---
title: "System Name"
summary: "One sentence, editorial — this is the headline description everywhere it's listed."
tags: ["business-operations", "systems"]
role: "Operations"
client: "Employer or client name"
year: "2026"
featured: true
previewType: "dashboard"   # dashboard | workflow | reporting | operations | marketing
order: 6
context: "Where the problem existed."
problem: "What needed to improve."
approach: "How it was approached."
system: "What was actually designed/built."
howItWorks: "The workflow, in plain terms."
tools: ["Google Sheets", "..."]
implementation: "What was actually implemented."
outcome: "ONLY if there's a real, verifiable result — do not estimate or invent one."
evidenceNote: "If there's no outcome yet, say so honestly here instead."
lessons: "Optional — only if there's something genuinely worth stating."
redacted: false   # true if this write-up deliberately omits confidential detail
draft: false
placeholder: false
---
```

**Do not invent `outcome` values.** If no measurable result is confirmed yet, leave `outcome`
empty and fill in `evidenceNote` honestly instead — the case-study page is built to handle either
state without looking broken.
