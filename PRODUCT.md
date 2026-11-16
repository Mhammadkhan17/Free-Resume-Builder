# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone who wants to create a resume for free, whether technical or non-technical, senior or fresher — no account, no signup, no payment. Primary job: build, edit, and print a resume entirely in the browser.

## Product Purpose

A local-first, client-side resume builder that lets a visitor compose a resume (personal info, experience, education, projects, certifications, custom sections, skills), preview it live, and export a print-accurate PDF, Markdown, DOCX, or JSON — with data that never leaves the browser.

## Positioning

100% local-first, no accounts, free forever. User data never leaves the browser; there is no server-side storage, no signup wall, and no paid tier — a claim a hosted, account-based competitor cannot truthfully copy.

## Operating Context

A single-page web app opened in a browser. State lives in memory and mirrors to localStorage on every mutation (autosaved, no explicit save). Output targets native print (Ctrl/Cmd+P) via CSS @media print rules, with user-controlled paper size (A4/Letter), margins, density, accent color, dark mode, and font. Imports JSON Resume and PDF text; exports PDF, DOCX, Markdown, and JSON. Keyboard shortcuts: ⌘/Ctrl+Z/Y (undo/redo), ⌘/Ctrl+P (print), ⌘/Ctrl+K (command palette).

## Capabilities and Constraints

Confirmed capability:
- Resume schema: personal info (name, headline, location, email, phone, website, LinkedIn, summary, photo), experience, education, projects, certifications, custom sections, skills, plus job description, font family, font size (9–18px), section order, hidden sections.
- Ten templates: classic, sidebar, modern, minimal, elegant, bold, mono, photo, executive, ATS-safe. The photo template shows an optional headshot (circle or square, client-side center-crop, data URL in resume state).
- Completeness gauge (name, contact, summary, experience, education, skills).
- Job-description keyword gap report (matched vs missing keywords).
- Undo/redo history (200 steps), named versions, example resume, reset.
- Export: PDF (print), DOCX, Markdown, JSON. Import: JSON (incl. JSON Resume mapping), PDF text into a custom section.
- LocalStorage persistence keyed `resume-builder:v1`; templates/accent/margin/density/dark stored under `resume-builder:*`.

Confirmed constraint:
- Client-side only: no backend, no auth, no accounts, no server-side storage.
- Single route (`src/routes/+page.svelte`); the whole builder is one Svelte 5 component.
- Web-safe / system font stacks only — no external font downloads (local-first).
- Paper sizes limited to A4 and Letter.

Explicitly undecided:
- Product name / logo / brand asset (not yet binding).
- Formal accessibility standard (WCAG level) not yet set.
- Self-hosting, custom domains, and multi-resume workspaces not yet decided.

## Brand Commitments

None yet. Product name, logo, and identity are undecided; no invented name, personality, or visual reference is recorded here.

## Evidence on Hand

- Incumbent implementation at `src/routes/+page.svelte` (the resume builder itself), `src/app.css`, `src/lib/index.ts`, `vite.config.ts` (SvelteKit + Tailwind + Vite + adapter-auto).
- `README.md` (default `sv` scaffold text — not product copy).
- Example resume data embedded in `exampleResume()` (Ada Lovelace, illustrative only — not a testimonial or customer claim).

## Product Principles

1. Local-first: user data never leaves the browser; no accounts, no server-side storage, no signup.
2. Free for everyone: no paywalls, tiers, or signup, for technical and non-technical users, senior and fresher alike.
3. Print-accurate output: the preview prints to PDF natively via CSS @media print, with user-controlled paper, margins, and density.
4. Open data: import/export (JSON Resume, JSON, Markdown, DOCX) so users always own and can move their resume.
5. Progressive disclosure: one page, optional sections, completeness gauge, and keyword guidance without overwhelming the visitor.

## Accessibility & Inclusion

Confirmed in code: field labels, `sr-only` visually-hidden labels, polite live region for notices (`aria-live="polite"`), dialog role (`role="dialog"`, `aria-modal="true"`), and keyboard shortcuts. No formal accessibility standard (WCAG level) established yet — undecided.
