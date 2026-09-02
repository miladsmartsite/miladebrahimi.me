---
title: "Material Request System"
summary: "Turning a verbal material request into a self-tracking, auditable approval chain."
tags: ["systems", "process-improvement"]
role: "Operations"
client: "Perla Engineering"
year: "2026"
featured: true
order: 2
context: >
  Site engineers needed materials delivered on time, but requests were made informally — with no
  consistent record of what was needed, by when, or at what cost.
problem: >
  There was no single, trusted record of a material request from the moment it was raised to the
  moment it was approved and delivered. Cost, urgency, and approval level all had to be worked
  out by hand, every time.
challenge: >
  Making the process trustworthy without adding new procurement software — it had to run on tools
  the team already used every day.
approach: >
  Rebuilt the request itself as structured data rather than a message, then automated everything
  that could be calculated instead of judged by hand.
system: >
  A material request form feeding an auto-calculating log that works out total cost, the earliest
  date something is needed, how much time is left, and how urgent the procurement risk is — then
  routes the request through the right approval level automatically and generates a numbered,
  structured document for the record.
howItWorks: >
  An engineer submits a request with up to ten line items. The system calculates total cost,
  earliest required date, and procurement risk, decides which approval level applies, and moves
  the request through a defined status — from pending review to approved, ordered, and delivered.
tools: ["Google Forms", "Google Sheets", "Google Apps Script", "Google Drive"]
implementation: >
  Live and in active use — the system is on its third revision, generating real, numbered request
  documents automatically.
evidenceNote: >
  No formal before/after measurement exists yet for time saved or request volume — that evidence
  is still in development.
redacted: true
placeholder: false
draft: false
---

Real generated request documents exist, but include another requester's name and the company's
contact details — they aren't shown here as-is. The description above reflects exactly what the
system does, without exposing those specifics.
