# Free Resume Builder

A free, local-first resume builder that runs entirely in your browser. No accounts, no signup, no server — your data never leaves your device. Build, preview, and export a print-accurate resume in minutes.

## Features

- **Live preview** — see every edit reflected instantly on an accurate paper page
- **10 templates** — Classic, Sidebar, Modern, Minimal, Elegant, Bold, Mono, Photo, Executive, and ATS-safe
- **Photo (headshot) template** — upload a photo, choose circle or square; center-cropped and downscaled in your browser, never uploaded
- **Print-to-PDF** — native browser printing (`Ctrl/⌘+P`) with CSS print rules; no server, no PDF libraries
- **Paper options** — A4 / Letter, margins (Narrow / Normal / Wide), density (Comfortable / Compact)
- **Styling controls** — web-safe font families, font size (9–18px), accent color, light/dark mode
- **Sections** — personal info, summary, experience (with roles), education, projects, certifications, skills, and custom sections; reorder, hide, and show what you need
- **Skills layout** — switch between bullet list and inline chips
- **Undo / redo** — 200-step history with `Ctrl/⌘+Z` / `Ctrl/⌘+Shift+Z`
- **Named versions** — save and restore snapshots of your resume from the More menu
- **Command palette** — `Ctrl/⌘+K` for quick actions
- **Completeness gauge** — instant feedback on missing key fields
- **Job-description keyword check** — paste a posting and see matched vs. missing keywords
- **AI Tailor** — optional OpenRouter-powered rewrite of summary, skills, and experience bullets to a job description; runs in a side panel with live keyword highlights and a change log; one-click undo restores the pre-run resume
- **Import** — JSON (incl. JSON Resume schema) and PDF text
- **Export** — PDF (via print), DOCX, Markdown, and JSON
- **Autosave** — everything persists to `localStorage` automatically; works offline
- **Accessible** — labeled inputs, live regions for notices, keyboard shortcuts, dialog semantics

## Stack

| Layer | Tech |
| --- | --- |
| Framework | [Svelte 5](https://svelte.dev) + [SvelteKit 3](https://kit.svelte.dev) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Language | TypeScript |
| Build | [Vite 8](https://vite.dev) |
| Icons | [lucide-svelte](https://lucide.dev) |
| Drag & drop | [svelte-dnd-action](https://github.com/isaacHagoel/svelte-dnd-action) |
| DOCX export | [docx](https://docx.js.org) |
| PDF import | [pdfjs-dist](https://mozilla.github.io/pdf.js) |
| E2E tests | [Playwright](https://playwright.dev) |

## Getting started

```sh
# install dependencies
npm install

# start dev server
npm run dev

# or open in browser
npm run dev -- --open
```

## Scripts

```sh
npm run dev       # start dev server
npm run build     # production build
npm run preview   # preview production build
npm run check     # svelte-check type checking
npx playwright test  # run e2e tests (e2e/)
```

## Deployment

The project uses `@sveltejs/adapter-auto`, so it deploys to any supported platform (Vercel, Netlify, Cloudflare, Node) with zero config — push to `main` and the platform builds automatically.

```sh
npm run build     # output in .svelte-kit/ + build/
```

## Privacy

All resume data is stored only in your browser's `localStorage`. There is no backend, no tracking, and no data ever leaves your machine — except the optional **AI Tailor** feature, which sends your resume text and job description to OpenRouter (the model provider) only when you press **Tailor Resume**. Your API key stays in the browser. Clearing site data removes your resume — export JSON to keep a backup.

## License

[MIT](LICENSE)
