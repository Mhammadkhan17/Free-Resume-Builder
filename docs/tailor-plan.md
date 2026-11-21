# Feature Plan: AI Tailor (OpenRouter Tool-Calling)

**Status:** Approved — ready to implement.
**Date:** 2026-11-21
**Repo:** `Mhammadkhan17/Free-Resume-Builder` (`main` @ `6a61912`)

---

## 1. Goal

Add an **AI Tailor** feature: paste a job description (JD), press **Tailor Resume**, and an LLM running through OpenRouter rewrites the resume's summary, skills, and experience bullets to match the JD — applying changes locally with a **single undo step**, a human-readable change log, and a live JD↔resume keyword highlighter.

This is **additive** to the existing single-page editor. No new routes, no store/preview extraction, no new npm dependencies (native `fetch` only).

---

## 2. Locked decisions (user-confirmed)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Slide-over panel inside `+page.svelte`**, not a `/tailor` route | User chose panel over route; keeps resume state local |
| D2 | **JD lives at `resume.jobDescription`** (shared with keyword-gap report) | One source of truth; report + tailor read the same textarea |
| D3 | **Stay on Svelte 5** — no Vue migration | Pain is one 2,835-line file, not the framework |
| D4 | **Additive-only guardrail**: new logic in new files; `+page.svelte` grows only ~50–100 lines of wiring | Avoids mid-feature refactors; monolith stays manageable |
| D5 | **No new dependencies** — native `fetch` to OpenRouter | `package.json` already has unused SDKs; do not add more |
| D6 | **Print via CSS only**; panel + backdrop hidden with Tailwind `print:hidden` | Existing `.no-print` rules are scoped and will not match child components (header/toolbar already `no-print`) |
| D7 | **No emojis in UI**; commit/push only when asked | Standing user constraints |

### Deferred refactor triggers (do NOT do these now)

- Extract a `resume` store / preview component → when a **second route** needs resume state.
- Split `+page.svelte` by section → only after tailor ships, when edits start to hurt.
- Replace the unused `openai` / `dexie` / `@anthropic-ai/sdk` deps → housekeeping pass later.
- Panel-side JD editing → only if that ships later; then introduce a `$bindable` chain.

---

## 3. Spec corrections (original spec was guesswork)

The original feature spec had these bugs; **this plan supersedes them**:

| Spec said | Correct |
|-----------|---------|
| `fetch('https://openrouter.ai', ...)` | `POST https://openrouter.ai/api/v1/chat/completions` |
| `while (true)` tool loop | `MAX_ROUNDS = 10` + `JSON.parse` guard on tool args; break on no `tool_calls` |
| `{@html}` render of JD highlights | **Escape HTML first**, then wrap matches (XSS: JD is user input) |
| No model input in UI | Model text input (default `google/gemini-2.5-flash`) |
| `finally` only | Also `catch` → surface `tailorError` + **auto-rollback** |
| Un-guarded `JSON.parse(localStorage…)` | `try/catch` on load |
| `resume.personal.data.summary` | `resume.personal.summary` (matches schema) |
| `bullets: string[]` written as-is | `bullets` field is a **newline-joined string** → tool must `args.bullets.join('\n')` |
| `saveVersion('Pre-Tailor')` for undo | **Wrong subsystem** — `saveVersion` is named versions (`prompt()`). Undo = history effect at 499–540. Coalesce during run; one ⌘Z for the whole run |
| Full `JSON.stringify(resume)` in prompt | **Compact projection**: strip `photo` (base64), `jobDescription`, font/style fields |
| Headers omitted / `X-OpenRouter-Title` | `Authorization: Bearer …`, `Content-Type: application/json`, **`X-Title: Free Resume Builder`** (verify at impl; OpenRouter quickstart documents `X-Title`, not `X-OpenRouter-Title`); optional `HTTP-Referer` |

**Verified against OpenRouter docs** (`https://openrouter.ai/docs/guides/features/tool-calling`): chat-completions shape is correct — tools nested under `function`, model returns `tool_calls[]` on an assistant message, results go back as `role: "tool"` messages with `tool_call_id`; **`tools` must be present in every request** of the loop.

---

## 4. Repo facts (line numbers as of `6a61912`, file is 2,835 lines)

All references are `src/routes/+page.svelte` unless noted.

| Concern | Location |
|---------|----------|
| `cls` helpers | 168–186 |
| Resume schema (`personal.summary`, `skills: string[]`, `jobDescription`, `photo`) | 70–230 |
| `keywords()` + `STOPWORDS` + `keywordReport` | 640–707 |
| Undo history effect (hydrate-first, push-on-change, 200 cap, `isUndoing` guard) | 499–540; `isUndoing` at 484 |
| Named-versions `saveVersion()` (`prompt()` → `versions[]`) — **not undo** | 1060–1070 |
| `restoreVersion()` uses `normalize(JSON.parse(...))` | ~1072 |
| `handleKeydown` — currently **returns immediately if `!mod`** (no Escape today) | 1051–1058 |
| Command palette overlay `z-50`, own Escape on overlay | 1358 |
| Header `no-print print:hidden` (toolbar lives inside → Tailor button auto-hidden on print) | 1188 |
| Editing toolbar (Undo / Redo / ⌘K group) — tailor button goes here | 1315–1316 |
| `f-summary` textarea | 1561 |
| JD section: `f-jd` **already** `bind:value={resume.jobDescription}`; keyword report; missing chips append to skills | 2240–2322 (bind at 2248) |
| Scoped `<style>` (`print:` ~2767+, `.no-print` 2809) | 2552–2835 |
| Settings hydrate pattern (`settingsHydrated` set true after reads; persist effect bails until then) | 555–576 |
| `notice` / `flash()` for transient messages | ~545+ |

Other facts:

- `docs/` created for this plan (was absent).
- `package.json`: TS project (`svelte-check`, `tsconfig`); `#lib` → `./src/lib/index.js`; `$lib` standard. Deps: `lucide-svelte`, `docx`, `pdfjs-dist` (+ unused SDKs — do not add more).
- `app.css`: Tailwind v4 `@import "tailwindcss"` + `@custom-variant dark`.
- Icons available: `Wand`, `WandSparkles`, `Sparkles`, `Sparkle`, `Target`, `ScanSearch`, `Briefcase*`, `FileText`, `Bot*`, `X`.
- Test baseline: `npm run check` 0 errors; harness `photo.mjs` 27/27; `templates.mjs` 21/21; `regress.mjs` 13/13; e2e `resume.spec.ts` 5 tests (build + preview on :4173).
- Harnesses in `/tmp/opencode/diag/` (chromium `/home/user/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`).
- **Vite watcher quirk:** CSS-only edits can appear stale → `touch src/routes/+page.svelte`.

---

## 5. Architecture

### 5.1 File map

```
src/lib/stores/tailor.svelte.ts          # NEW — tailor store ($state, localStorage)
src/lib/ai/openrouter.ts                 # NEW — chat-completions client + tool loop
src/lib/ai/resumeTools.ts                # NEW — 3 tool schemas + createApplyTool()
src/lib/keywords.ts                      # NEW — pure move of keywords() + STOPWORDS (optional, preferred)
src/lib/components/tailor/
  TailorPanel.svelte                     # NEW — slide-over shell (backdrop, header, sections)
  TailorControls.svelte                  # NEW — model/key inputs, run button, status/errors
  JdHighlighter.svelte                   # NEW — escaped JD→resume highlighting
  MasterBank.svelte                      # NEW — reusable phrase bank UI
src/routes/+page.svelte                  # EDIT — toolbar button, Escape wiring, handleTailor,
                                          #        history coalescing, panel mount (~50–100 lines)
e2e/tailor.spec.ts                       # NEW — mocked OpenRouter e2e
docs/tailor-plan.md                      # THIS FILE
README.md, PRODUCT.md                    # EDIT — feature bullet + capabilities (last step)
```

`+page.svelte` delta budget: **~50–100 lines**. Everything else lives in `src/lib`.

**Keywords:** prefer extracting `keywords()` + `STOPWORDS` to `src/lib/keywords.ts` as a **pure move** (no behavior change) so `keywordReport` and the highlighter cannot drift. Fallback: duplicate a small local copy with a “keep in sync” comment — do not refactor the report’s call sites beyond the import swap.

### 5.2 Data flow

```
┌──────────────────────────── +page.svelte ────────────────────────────┐
│  toolbar [Tailor] ──► tailor.panelOpen = true                        │
│  handleTailor():                                                      │
│    1. pre = JSON.stringify(resume)          (rollback snapshot)       │
│    2. isTailoring = true                  (history effect coalesces) │
│    3. runTailorLoop({ …, createApplyTool(resume, onApply) })         │
│         ↳ tools mutate `resume` in place (tools are the only writer) │
│    4. success → push ONE history snapshot; changeLog = applied+final │
│       failure → resume = normalize(JSON.parse(pre)); error message   │
│    5. isTailoring = false                                            │
│  jobDescription / resume ──plain props──► TailorPanel                │
│                                   └──► JdHighlighter (read-only)     │
└──────────────────────────────────────────────────────────────────────┘
```

**Ownership:** during a run, **tools** (invoked from `handleTailor`) are the only writers of `resume`. The user may still edit concurrently (v1: acceptable; footer says avoid it). JD is **never** written by tailor components (read-only props; no `$bindable` until panel JD editing exists).

### 5.3 Svelte 5 notes (only what this feature needs)

1. **No `$bindable` in v1** — JD and `resume` are read-only props into the panel. Add a bindable chain only if panel JD editing ships later (`ownership_invalid_mutation` only fires on child mutation).
2. **Module `$state` in `.svelte.ts`** may be mutated from any component — fine for the tailor store. Export a `const` object only (modules can’t re-export reassigned bindings).
3. **`$effect.root`** at module scope for the persist effect — legal. **No microtask hydration guard:** `load()` already runs in the `$state` initializer, so the first persist equals storage (no clobber). Persist unconditionally inside the effect (try/catch).
4. **Events:** `onclick` / `onkeydown` (runes style).
5. **`{@html}`** only in the highlighter, and only after `escapeHtml` (§7.3). Change log and errors use text interpolation (`{}`) — never `{@html}`.
6. **Panel mount:** `{#if tailor.panelOpen}` + `transition:fly={{ x: 40, duration: 200 }}` from `svelte/transition` (DOM removed when closed; matches palette approach). Do **not** also animate with CSS `data-open` — pick one.
7. **Escape** — single branch in `handleKeydown`, **before** `if (!mod) return`:

```ts
if (event.key === 'Escape') {
  if (showPalette) return; // palette overlay (1358) owns its own Escape
  if (tailor.panelOpen) {
    event.preventDefault();
    closeTailorPanel(); // panelOpen=false; tailorButtonEl.focus()
    return;
  }
}
const mod = event.metaKey || event.ctrlKey;
if (!mod) return;
// …existing mod+z / mod+p / mod+k…
```

Precedence: **palette first** (it’s z-50 / topmost), then tailor. Panel does not add its own Escape listener (avoid double-handling).

---

## 6. Tailor store — `src/lib/stores/tailor.svelte.ts`

```ts
import { browser } from '$app/environment';

const KEY = 'frb_tailor_state_v1';

type Persisted = {
  apiKey: string;
  model: string;          // default 'google/gemini-2.5-flash'
  masterBank: string[];   // user's reusable phrases
};

const defaults: Persisted = {
  apiKey: '',
  model: 'google/gemini-2.5-flash',
  masterBank: [],
};

function load(): Persisted {
  if (!browser) return { ...defaults };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' && parsed.model ? parsed.model : defaults.model,
      masterBank: Array.isArray(parsed.masterBank)
        ? parsed.masterBank.filter((x): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    return { ...defaults };
  }
}

export const tailor = $state({
  ...load(),
  isTailoring: false,
  tailorError: '',
  changeLog: [] as string[],
  panelOpen: false,
});

// No hydration microtask — load() already ran; first write is a no-op vs storage.
if (browser) {
  $effect.root(() => {
    $effect(() => {
      const { apiKey, model, masterBank } = tailor;
      try {
        localStorage.setItem(KEY, JSON.stringify({ apiKey, model, masterBank }));
      } catch { /* quota / private mode — ignore */ }
    });
  });
}
```

**Persisted:** `apiKey`, `model`, `masterBank` only. **Never persist** `isTailoring`, `tailorError`, `changeLog`, `panelOpen`.

---

## 7. OpenRouter integration

### 7.1 Client — `src/lib/ai/openrouter.ts`

```ts
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const MAX_ROUNDS = 10; // summary + skills + N experience entries + final message

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string }; // JSON *string*
};

export type ToolDef = { /* OpenAI function tool shape */ };

export type LoopResult = {
  rounds: number;
  finished: boolean;       // got a no-tool final message
  finalContent: string;    // assistant text (changelog prose), '' if none
  applied: string[];       // human-readable lines from successful tool calls
};

export async function chatOnce(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools: ToolDef[];
}): Promise<ChatMessage> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Free Resume Builder', // verify name against quickstart at impl
      // 'HTTP-Referer': … // optional; browser may block setting Referer
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      tools: opts.tools,       // required on EVERY round
      tool_choice: 'auto',
      temperature: 0.3,        // steadier rewrites
    }),
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body?.error?.message ?? body?.message ?? detail;
    } catch { /* keep status */ }
    if (res.status === 401 || res.status === 403) throw new Error('Invalid OpenRouter API key.');
    if (res.status === 429) throw new Error(`Rate limited by OpenRouter: ${detail}`);
    throw new Error(`OpenRouter error: ${detail}`);
  }
  const body = await res.json();
  const msg = body?.choices?.[0]?.message;
  if (!msg) throw new Error('OpenRouter returned an empty response.');
  return msg as ChatMessage;
}

export async function runTailorLoop(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  tools: ToolDef[];
  applyTool: (name: string, args: unknown) => string; // from createApplyTool
}): Promise<LoopResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.user },
  ];
  const applied: string[] = [];
  let finalContent = '';

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const assistant = await chatOnce({
      apiKey: opts.apiKey,
      model: opts.model,
      messages,
      tools: opts.tools,
    });
    messages.push(assistant);
    const calls = assistant.tool_calls ?? [];

    if (calls.length === 0) {
      finalContent = typeof assistant.content === 'string' ? assistant.content : '';
      return { rounds: round + 1, finished: true, finalContent, applied };
    }

    // Model may batch several tool_calls in one message — apply all, then continue.
    for (const call of calls) {
      let result: string;
      try {
        const args = JSON.parse(call.function.arguments);
        result = opts.applyTool(call.function.name, args);
        // createApplyTool pushes a readable line into `applied` on success
      } catch (err) {
        result = JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        });
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: result });
    }
  }
  return { rounds: MAX_ROUNDS, finished: false, finalContent, applied };
}
```

Notes:

- Invalid tool JSON / validation failures → `{ error }` result back to the model, never a silent success.
- HTTP/network failures **throw** → `handleTailor` catch → rollback + `tailorError`.
- Refusal / empty content with no tools → `finished: true`, `finalContent: ''` → change log falls back to `applied` lines (or “No changes.”).
- No streaming (out of scope).

### 7.2 Tools — `src/lib/ai/resumeTools.ts`

| Tool | Args | Effect on `resume` |
|------|------|--------------------|
| `update_summary` | `{ summary: string }` | `resume.personal.summary = summary` |
| `update_skills` | `{ skills: string[] }` | `resume.skills = skills` (replace whole list) |
| `update_experience_bullets` | `{ experience_index: number, bullets: string[] }` | `resume.experience[i].bullets = bullets.join('\n')` ⚠️ |

```ts
export const TOOLS: ToolDef[] = [ /* three function tools as in prior draft;
  descriptions state: no invented employers/titles/dates/metrics;
  bullets = full replacement list, not a diff; skills ordered JD-first */ ];

/**
 * Factory: closes over resume (the $state proxy) so the loop signature stays
 * (name, args) => string. `onApply` feeds tailor.changeLog.
 */
export function createApplyTool(
  resume: Resume,
  onApply: (line: string) => void,
): (name: string, args: unknown) => string {
  return (name, args) => {
    if (name === 'update_summary') {
      const a = args as { summary?: unknown };
      if (typeof a.summary !== 'string' || !a.summary.trim()) {
        throw new Error('summary must be a non-empty string');
      }
      resume.personal.summary = a.summary;
      onApply('Updated summary');
      return JSON.stringify({ ok: true });
    }
    if (name === 'update_skills') {
      const a = args as { skills?: unknown };
      if (!Array.isArray(a.skills) || !a.skills.every((s) => typeof s === 'string')) {
        throw new Error('skills must be an array of strings');
      }
      resume.skills = a.skills as string[];
      onApply(`Updated skills (${resume.skills.length})`);
      return JSON.stringify({ ok: true });
    }
    if (name === 'update_experience_bullets') {
      const a = args as { experience_index?: unknown; bullets?: unknown };
      const i = a.experience_index;
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= resume.experience.length) {
        throw new Error('experience_index out of range');
      }
      if (!Array.isArray(a.bullets) || !a.bullets.every((b) => typeof b === 'string')) {
        throw new Error('bullets must be an array of strings');
      }
      const text = (a.bullets as string[]).join('\n');
      resume.experience[i].bullets = text;
      const first = (a.bullets as string[])[0] ?? '';
      onApply(`Rewrote bullets for experience #${i} — “${first.slice(0, 60)}”`);
      return JSON.stringify({ ok: true });
    }
    throw new Error(`Unknown tool: ${name}`);
  };
}
```

**System prompt** (in `resumeTools.ts`):

> You tailor an existing resume to a job description using only the provided tools.  
> **In scope:** professional summary, skills, experience bullets only. Do not try to change headline, education, projects, certifications, dates, employers, or contact info — you have no tools for them.  
> Rules: never invent employers, titles, dates, locations, degrees, or metrics; every claim must be defensible from the original resume; prefer JD keywords only where the candidate genuinely has the skill; concise resume style (no first person, no emojis, no markdown); batch multiple tool calls in one response when possible; call `update_summary` / `update_skills` when it improves JD alignment; call `update_experience_bullets` for each experience entry whose bullets should change; when done, reply with a short plain-text changelog and make no further tool calls.

**User message** (built in `handleTailor`):

1. Compact resume projection (§7.2.1 below) as JSON.  
2. Full JD text.  
3. Master-bank phrases under `## Reusable phrases (optional)`.

#### 7.2.1 Prompt projection (required)

```ts
function resumeProjection(resume: Resume) {
  return {
    personal: {
      name: resume.personal.name,
      headline: resume.personal.headline,
      location: resume.personal.location,
      summary: resume.personal.summary,
      // NO photo — never send base64 to OpenRouter
    },
    experience: resume.experience,   // role, company, dates, bullets
    education: resume.education,
    projects: resume.projects,
    certifications: resume.certifications,
    customSections: resume.customSections,
    skills: resume.skills,
    // NO jobDescription (already sent separately), fontFamily, fontSize,
    // sectionOrder, hiddenSections, skillStyle, photo
  };
}
```

**Change log composition** (in `handleTailor` after loop):

1. Seed from `result.applied` (deterministic tool lines).  
2. If `result.finalContent`, append its non-empty lines.  
3. If `!result.finished`, append `Stopped after ${rounds} rounds (limit).`  
4. If still empty → `No changes.`  
Assign to `tailor.changeLog` (already cleared at run start).

### 7.3 JD Highlighter — `src/lib/components/tailor/JdHighlighter.svelte`

**Purpose:** read-only JD view with two highlight classes: terms **present** in the resume vs **missing** JD keywords. Legend + missing count only.  
*(The existing JD section at 2240–2322 keeps its clickable missing-chips → skills behavior; the panel does not duplicate it.)*

**Algorithm (safe `@html`):**

```ts
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function highlight(jd: string, resumeText: string): string {
  const esc = escapeHtml(jd);            // escape FIRST
  const present = new Set(tokenize(resumeText)); // keywords() from src/lib/keywords.ts
  // Build case-insensitive word-boundary regexes from tokens (escaped for regex),
  // replace matches inside `esc` only → <mark class="…">…</mark>
  return esc;
}
```

- Tokenizer/stopwords: **shared** `src/lib/keywords.ts` (preferred) or synced copy.  
- `$derived` on `(jd, resume)` — JDs are small (≤ ~10KB).  
- Typography parity with preview body (same font stack/size classes).  
- Scroll: `max-h` + `overflow-y-auto` in the panel (~420–480px wide).  
- Marks: present `bg-emerald-200/70 dark:bg-emerald-900/60`; missing `bg-amber-200/70 dark:bg-amber-900/60`.

### 7.4 Master Bank — `MasterBank.svelte`

- `tailor.masterBank`: add / remove / persisted.  
- Rows: text + delete. (“Add current summary line” out of scope.)  
- Injected into the user message under `## Reusable phrases (optional)`.

### 7.5 Panel — `TailorPanel.svelte` + `TailorControls.svelte`

**Props (all read-only except callbacks):**

```ts
let {
  resume,                 // read-only — highlighter text source
  jobDescription,         // plain string prop (NOT $bindable in v1)
  onTailor,               // () => void  → handleTailor
  close,                  // () => void  → closeTailorPanel
  focusReturn,            // () => void  → focus toolbar button (or use bind from page)
} = $props();
```

**Placement** (fixed right slide-over):

```svelte
{#if tailor.panelOpen}
  <div
    class="fixed inset-0 z-30 bg-black/30 print:hidden"
    onclick={close}
    role="presentation"
  ></div>
  <div
    class="fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col
           print:hidden shadow-2xl bg-white dark:bg-slate-900"
    transition:fly={{ x: 40, duration: 200 }}
    role="dialog"
    aria-modal="false"
    aria-label="AI Tailor"
  >
    …
  </div>
{/if}
```

- **z-index:** backdrop `z-30`, panel `z-40`, palette `z-50` (1358) — ⌘K always wins.  
- **Print:** `print:hidden` on backdrop **and** panel (scoped `.no-print` won’t match child DOM). Toolbar/header already hidden (1188) — **do not** add extra rules for the Tailor button.  
- **Not** `aria-modal` (page stays interactive).  
- Close: ✕ (`X` icon) + Escape (via `handleKeydown`) + backdrop click → `close()` → `tailorButtonEl.focus()`.  
- One decision only: `{#if}` + `transition:fly` (no CSS `data-open` dual mechanism).

**Sections top→bottom:**

1. **Header:** “AI Tailor” (`WandSparkles`) + close.  
2. **JD highlighter** + legend (present / missing) + missing-count.  
3. **Controls (`TailorControls`):**
   - API key: `type="password"`, placeholder `sk-or-…`, persisted; reuse `cls.input`.  
   - Model: text input + `<datalist>` of **current tool-capable examples** (keep 2–3; verify against `openrouter.ai/models?supported_parameters=tools` at impl — do not hardcode stale IDs).  
   - Master bank (`<details>` or compact list).  
   - **Tailor Resume** button: `disabled={isTailoring || !apiKey || !jobDescription.trim()}`.  
   - States: idle → `Tailoring…` (spin icon, disabled) → success line → error block (`role="alert"`, red) with retry.  
4. **Change log:** `<ul aria-live="polite">` of `tailor.changeLog`; empty state “No changes yet.”  
5. **Footer:**  
   - “Changes are local. One ⌘Z undoes the whole run.”  
   - “Your resume text and job description are sent to OpenRouter only when you press Tailor. Your API key stays in this browser’s localStorage.”  
   - “Avoid editing the resume while tailoring.”

---

## 8. `+page.svelte` wiring (~50–100 lines)

1. **Imports:** `TailorPanel`, `runTailorLoop`, `TOOLS`, `createApplyTool`, `resumeProjection`/`buildUserMessage`, `tailor`, `WandSparkles`.  
2. **Toolbar button** (after Redo, ~1315), class `cls.btnSecondary` (or `iconBtn`):

```svelte
<button
  type="button"
  class={cls.btnSecondary}
  aria-label="Open AI Tailor"
  bind:this={tailorButtonEl}
  onclick={() => (tailor.panelOpen = true)}
>
  <WandSparkles size={14} /> Tailor
</button>
```

3. **Escape branch** at top of `handleKeydown` — see §5.3.7 (palette first, then tailor; before `if (!mod) return`).  
4. **JD binding:** nothing to add — `f-jd` already binds `resume.jobDescription` (2248). Pass `jobDescription={resume.jobDescription}` into the panel as a plain prop.  
5. **History coalescing:** extend the history effect guard (524):

```ts
if (!isUndoing && !tailor.isTailoring) {
  // existing push logic unchanged
}
```

After a **successful** run (and after any **failed** run that left edits — only if you choose partial-apply instead of rollback), push exactly one snapshot:

```ts
function pushHistorySnapshot() {
  const snap = JSON.stringify(resume);
  if (history[historyIndex] === snap) return;
  const next = history.slice(0, historyIndex + 1);
  next.push(snap);
  if (next.length > 200) next.shift();
  history = next;
  historyIndex = next.length - 1;
}
```

6. **`handleTailor` (atomic-ish run):**

```ts
async function handleTailor() {
  if (tailor.isTailoring) return;
  tailor.tailorError = '';
  tailor.changeLog = [];
  const pre = JSON.stringify(resume);

  tailor.isTailoring = true; // freezes history pushes
  try {
    const result = await runTailorLoop({
      apiKey: tailor.apiKey,
      model: tailor.model,
      system: SYSTEM_PROMPT,
      user: buildUserMessage(resumeProjection(resume), resume.jobDescription, tailor.masterBank),
      tools: TOOLS,
      applyTool: createApplyTool(resume, (line) => tailor.changeLog.push(line)),
    });
    // compose change log from result (§7.2) — applied[] already pushed live;
    // append finalContent lines + rounds warning here
    if (result.finalContent) { /* append non-empty lines */ }
    if (!result.finished) tailor.changeLog.push(`Stopped after ${result.rounds} rounds (limit).`);
    if (tailor.changeLog.length === 0) tailor.changeLog.push('No changes.');
    pushHistorySnapshot(); // ONE undo step
  } catch (err) {
    // Atomic failure: discard partial tool mutations
    try {
      resume = normalize(JSON.parse(pre));
    } catch { /* keep whatever we have */ }
    tailor.tailorError =
      err instanceof Error ? err.message : String(err);
    tailor.changeLog = [];
  } finally {
    tailor.isTailoring = false;
  }
}
```

**No `saveVersion` call.** Named versions stay user-initiated only.

7. **Mount** near the palette overlay (outside the print sheet):

```svelte
<TailorPanel
  {resume}
  jobDescription={resume.jobDescription}
  onTailor={handleTailor}
  close={closeTailorPanel}
/>
```

`closeTailorPanel`: `tailor.panelOpen = false; tailorButtonEl?.focus();`

---

## 9. Implementation order (each step leaves `npm run check` green)

| # | Step | Acceptance |
|---|------|------------|
| 1 | ~~Create plan file~~ | **Done** (this document) |
| 2 | `src/lib/keywords.ts` (pure move) + import swap in `+page` | `keywordReport` behavior unchanged; check clean |
| 3 | `src/lib/stores/tailor.svelte.ts` | Loads/saves without clobber; no microtask guard |
| 4 | `src/lib/ai/openrouter.ts` (client + loop) | Returns `LoopResult`; MAX_ROUNDS=10; bad tool JSON → error result; multi `tool_calls` applied |
| 5 | `src/lib/ai/resumeTools.ts` (`TOOLS` + `createApplyTool`) | `bullets.join('\n')`; integer index check; `onApply` lines; projection strips photo/JD |
| 6 | `TailorPanel` shell + Escape + focus return + `print:hidden` + z-40 | Open/close; palette still wins; print hides panel+backdrop only |
| 7 | `JdHighlighter` with escaping | XSS payload renders as text |
| 8 | `MasterBank` | Add/remove survives reload |
| 9 | `TailorControls` (key/model/button states) | Disabled logic; `role="alert"` |
| 10 | `handleTailor` + history coalescing + rollback + mount | One ⌘Z undoes run; failed run leaves resume unchanged |
| 11 | Change log (`aria-live`) + rounds messaging | Non-empty after mock run |
| 12 | `e2e/tailor.spec.ts` (§10.3) | All cases pass |
| 13 | Harness re-runs + `npm run check` | 27 + 21 + 13, 0 errors |
| 14 | README.md + PRODUCT.md | Docs match shipped behavior |
| 15 | **Stop — commit only when user asks** | §15 |

---

## 10. Testing plan

### 10.1 Static

- `npm run check` → 0 errors after every step.

### 10.2 Existing harnesses (dev :5173)

```
node /tmp/opencode/diag/regress.mjs     # 13/13
node /tmp/opencode/diag/templates.mjs   # 21/21
node /tmp/opencode/diag/photo.mjs       # 27/27
```

`touch src/routes/+page.svelte` after CSS-only edits (Vite watcher quirk).

### 10.3 New Playwright e2e — `e2e/tailor.spec.ts`

Config already builds + previews on :4173. Mock with `page.route('**/api/v1/chat/completions', …)`.

1. **Happy path:** round 1 → assistant with `tool_calls` (`update_summary`); round 2 → plain content `"Updated summary"`. Assert: panel opens; button Tailoring… → idle; change log non-empty; `#f-summary` equals payload; **exactly one** undo restores pre-run summary (press Undo / ⌘Z once).  
2. **Missing key** → Tailor disabled.  
3. **HTTP 401** → `role="alert"` “Invalid OpenRouter API key.”  
4. **XSS in highlighter:** JD `<img src=x onerror="window.__xss=1"> senior engineer` → `window.__xss` undefined; literal text shown.  
5. **Print hidden:** `emulateMedia({ media: 'print' })` → panel + backdrop hidden; `.resume-page` visible.  
6. **Escape closes** panel; focus returns to Tailor button. **Also:** open palette over panel → Escape closes **palette only** (panel stays).  
7. **Invalid tool JSON:** `arguments = '{oops'` → second request has `role:'tool'` with `error`; run completes; no uncaught exception.  
8. **No photo in payload:** set a `data:image/…` photo; capture mock request body; assert `!body.includes('data:image')` and `!body.includes(jobDescription text)`.  
9. **Rollback on failure:** round 1 applies `update_summary`, round 2 → network/500 → resume summary **unchanged** from pre-run; error alert shown; change log cleared.  
10. **429:** status 429 → message contains “Rate limited”.

### 10.4 Manual checklist (before commit)

- [ ] Dark mode: marks + panel legible.  
- [ ] Narrow viewport: panel full-width; page usable behind.  
- [ ] localStorage: key/model/bank survive reload; log does not.  
- [ ] One ⌘Z after a successful run restores pre-tailor content (including skills + bullets).  
- [ ] ⌘K over open panel: palette on top; Escape closes palette first.  
- [ ] Print → PDF: no panel, no backdrop (toolbar already hidden).  
- [ ] Dev console: **zero** `ownership_invalid_mutation` warnings.  
- [ ] Failed run (unplug / bad key mid-way): document identical to pre-run.

---

## 11. Edge cases & error handling

| Case | Behavior |
|------|----------|
| Empty JD or empty API key | Tailor disabled |
| Network offline / fetch throws | Rollback; `Network error — check your connection.` |
| 401 / 403 | Rollback; `Invalid OpenRouter API key.` |
| **429** | Rollback; `Rate limited by OpenRouter: …` (no auto-retry) |
| Other 4xx/5xx | Rollback; `OpenRouter error: <message>` |
| Refusal / empty content, no tools | `finished: true`, `finalContent: ''` → log from `applied` or `No changes.` |
| Model doesn’t support tools | Surfaces as API error above |
| No `tool_calls` on round 1 | Final text = changelog; finished |
| Model always returns `tool_calls` | Stop at 10; “Stopped after 10 rounds (limit).”; keep applied changes; one history push |
| Multiple `tool_calls` one message | Apply all in order; one `role:tool` each; next round |
| Invalid arguments JSON | `{ error }` to model; loop continues |
| `experience_index` non-integer / OOB | Throw → error result to model |
| `bullets` not `string[]` | Throw → error result to model |
| `bullets.join('\n')` | **Required** — field is one string |
| Empty `experience[]` | Summary/skills tools only — valid |
| **Mid-run failure** | **Auto-rollback** to `pre`; change log cleared; error shown |
| User closes panel mid-run | Run continues; results still apply (or roll back on error); no cancel in v1 |
| User edits resume mid-run | Last-writer-wins; footer warns; v1 acceptable |
| Double-click Tailor | Guarded by `isTailoring` |
| localStorage disabled | try/catch; in-memory only |
| Huge payload | Soft: skip photo/JD already; optional warn if projection > ~50KB (v1: note only) |
| Change-log HTML | Text nodes only — never `{@html}` |
| Highlighter perf | `$derived`; JDs small |
| Two tabs | Last write wins (out of scope) |

---

## 12. Out of scope (v1)

- Streaming / token UI.  
- Cancel / abort (`AbortController`) — follow-up.  
- Separate `/tailor` route; store/preview extraction.  
- Tailoring headline / education / projects / certifications (no tools; system prompt says so).  
- Cover letters, multi-resume profiles, remote sync.  
- Server-side key handling (BYO key, localStorage — document in footer).  
- Editing JD **inside the panel** (stays in JD section; plain prop until then).  
- Using unused `openai` / `@anthropic-ai/sdk` / adding `@openrouter/*` SDKs.  
- Auto-applying master-bank phrases without the model.  
- Retry/backoff on 429.  
- Token/cost estimates.

---

## 13. Docs touch-ups (step 14)

- **README.md:** Features → “AI Tailor (bring your own OpenRouter key)”; one line: paste JD → Tailor → one ⌘Z undoes the run.  
- **PRODUCT.md:** capability + privacy (resume text + JD go to OpenRouter only on button press; key stays local; photo never sent).

---

## 14. References

| Resource | URL |
|----------|-----|
| Svelte docs (LLM index) | https://svelte.dev/docs/llms.txt |
| Svelte full / medium / small | https://svelte.dev/docs/llms-full.txt · `/llms-medium.txt` · `/llms-small.txt` |
| SvelteKit LLM index | https://svelte.dev/docs/kit/llms.txt |
| OpenRouter docs index | https://openrouter.ai/docs/llms.txt |
| Tool calling (chat-completions shape, loop, tools every request) | https://openrouter.ai/docs/guides/features/tool-calling |
| Quickstart (**verify `X-Title` header name**) | https://openrouter.ai/docs/quickstart |
| Models with `tools` | https://openrouter.ai/models?supported_parameters=tools |
| Repo at plan time | `main` @ `6a61912` |

---

## 15. Approval gate

~~Implementation starts only after you approve this document.~~ **Approved.** Commit/push only when explicitly asked.
