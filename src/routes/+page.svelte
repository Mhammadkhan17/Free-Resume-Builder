<script>
	import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
	import { dndzone } from 'svelte-dnd-action';
	import * as pdfjsLib from 'pdfjs-dist';
	import { ArrowUp, ArrowDown, X } from 'lucide-svelte';
	pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
	/**
	 * Local-first Resume Builder
	 * Single-file Svelte 5 component. Zero external runtime dependencies.
	 * State lives in memory, mirrors to localStorage on every mutation,
	 * and exports a print-accurate PDF via native CSS @media print rules.
	 */

	/**
	 * @typedef {Object} PersonalInfo
	 * @property {string} name
	 * @property {string} headline
	 * @property {string} location
	 * @property {string} email
	 * @property {string} phone
	 * @property {string} website
	 * @property {string} linkedin
	 * @property {string} summary
	 * @property {string} photo
	 */

	/**
	 * @typedef {Object} ExperienceEntry
	 * @property {string} id
	 * @property {string} company
	 * @property {string} role
	 * @property {string} startDate
	 * @property {string} endDate
	 * @property {string} bullets
	 */

	/**
	 * @typedef {Object} EducationEntry
	 * @property {string} id
	 * @property {string} institution
	 * @property {string} degree
	 * @property {string} graduationYear
	 */

	/**
	 * @typedef {Object} ProjectEntry
	 * @property {string} id
	 * @property {string} name
	 * @property {string} link
	 * @property {string} bullets
	 */

	/**
	 * @typedef {Object} CertificationEntry
	 * @property {string} id
	 * @property {string} name
	 * @property {string} issuer
	 * @property {string} year
	 */

	/**
	 * @typedef {Object} CustomSection
	 * @property {string} id
	 * @property {string} title
	 * @property {string} body
	 */

	/**
	 * @typedef {Object} Resume
	 * @property {PersonalInfo} personal
	 * @property {ExperienceEntry[]} experience
	 * @property {EducationEntry[]} education
	 * @property {ProjectEntry[]} projects
	 * @property {CertificationEntry[]} certifications
	 * @property {CustomSection[]} customSections
	 * @property {string[]} skills
	 * @property {'line' | 'bullets'} skillStyle
	 * @property {string[]} sectionOrder
	 * @property {string[]} hiddenSections
	 * @property {string} jobDescription
	 * @property {string} fontFamily
	 * @property {number} fontSize
	 */

	/**
	 * @typedef {'a4' | 'letter'} PaperSize
	 */

	/**
	 * @typedef {'line' | 'bullets'} SkillStyle
	 */

	const STORAGE_KEY = 'resume-builder:v1';

	/** Display order of optional body sections (header/summary always render first when present). */
	const SECTION_IDS = /** @type {const} */ ([
		'summary',
		'experience',
		'education',
		'projects',
		'certifications',
		'custom',
		'skills'
	]);

	/** @type {Record<string, string>} */
	const SECTION_LABELS = {
		summary: 'Summary',
		experience: 'Experience',
		education: 'Education',
		projects: 'Projects',
		certifications: 'Certifications',
		custom: 'Custom',
		skills: 'Skills'
	};

	/** @type {Record<PaperSize, { label: string; width: string; height: string; size: string }>} */
	const PAPER = {
		a4: { label: 'A4', width: '210mm', height: '297mm', size: 'A4' },
		letter: { label: 'Letter', width: '215.9mm', height: '279.4mm', size: 'Letter' }
	};

	/** Web-safe / system font stacks — no external font downloads (local-first). */
	const FONTS = /** @type {Record<string, { label: string; stack: string }>} */ ({
		system: {
			label: 'System Sans',
			stack: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
		},
		georgia: { label: 'Georgia', stack: "Georgia, 'Times New Roman', Times, serif" },
		times: { label: 'Times New Roman', stack: "'Times New Roman', Times, serif" },
		arial: { label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
		verdana: { label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
		trebuchet: { label: 'Trebuchet MS', stack: "'Trebuchet MS', Tahoma, sans-serif" },
		palatino: {
			label: 'Palatino',
			stack: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif"
		},
		courier: { label: 'Courier New', stack: "'Courier New', Courier, monospace" }
	});

	const FONT_SIZE_MIN = 9;
	const FONT_SIZE_MAX = 18;
	const FONT_SIZE_DEFAULT = 12;

	const BULLET_PLACEHOLDER = 'Led platform migration, cut p95 latency 40%\nMentored 4 engineers across 2 squads';

	/** Keyboard-command palette entries (⌘K). Each runs an existing action. */
	const commands = [
		{ key: '⌘P', label: 'Print / Save PDF', desc: 'Open print dialog', action: printResume },
		{ key: '⌘Z', label: 'Undo', desc: 'Revert the last change', action: undo },
		{ key: '⌘Y', label: 'Redo', desc: 'Reapply the last undone change', action: redo },
		{ key: '⌘K', label: 'Close palette', desc: 'Dismiss this menu', action: () => { showPalette = false; } },
		{ key: '', label: 'Export JSON', desc: 'Download the resume as JSON', action: exportJSON },
		{ key: '', label: 'Export Markdown', desc: 'Download the resume as Markdown', action: exportMarkdown },
		{ key: '', label: 'Export DOCX', desc: 'Download the resume as a Word document', action: exportDOCX },
		{ key: '', label: 'Import JSON', desc: 'Load a resume from a JSON file', action: () => { fileInput?.click(); } },
		{ key: '', label: 'New example', desc: 'Load the example resume', action: loadExample },
		{ key: '', label: 'Reset', desc: 'Clear all data and start over', action: resetResume },
		{ key: '', label: 'Toggle dark mode', desc: 'Switch between light and dark editor', action: () => { darkMode = !darkMode; } },
	];

	const cls = {
		label:
			'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400',
		input:
			'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5 text-slate-900 placeholder:text-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400',
		textarea:
			'w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5 text-slate-900 placeholder:text-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400',
		btnSecondary:
			'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
		btnPrimary:
			'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-1 dark:focus:ring-offset-slate-900',
		btnGhost:
			'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300',
		btnAdd:
			'inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400',
		iconBtn:
			'inline-flex h-6 w-6 items-center justify-center rounded-md text-[13px] leading-none text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:pointer-events-none disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
		card: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900',
		sectionTitle:
			'mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
		fieldGroup: 'space-y-3',
		grid2: 'grid grid-cols-1 gap-2.5 sm:grid-cols-2'
	};

	let seq = 0;
	/** @param {string} prefix */
	function uid(prefix) {
		seq += 1;
		return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${Math.random()
			.toString(36)
			.slice(2, 8)}`;
	}

	/** @param {unknown} value @returns {string} */
	function asText(value) {
		if (typeof value === 'string') return value;
		if (value == null) return '';
		return String(value);
	}

	/** @returns {Resume} */
	function defaultResume() {
		return {
			personal: {
				name: '',
				headline: '',
				location: '',
				email: '',
				phone: '',
				website: '',
				linkedin: '',
				summary: '',
				photo: ''
			},
			experience: [],
			education: [],
			projects: [],
			certifications: [],
			customSections: [],
			skills: [],
			skillStyle: 'line',
			sectionOrder: [...SECTION_IDS],
			hiddenSections: [],
			jobDescription: '',
			fontFamily: 'system',
			fontSize: FONT_SIZE_DEFAULT
		};
	}

	/**
	 * Coerce arbitrary imported JSON into the strict resume schema.
	 * @param {unknown} data
	 * @returns {Resume}
	 */
	function normalize(data) {
		const base = defaultResume();
		if (!data || typeof data !== 'object' || Array.isArray(data)) return base;

		const source = /** @type {Record<string, unknown>} */ (data);
		const p =
			typeof source.personal === 'object' && source.personal !== null
				? /** @type {Record<string, unknown>} */ (source.personal)
				: {};
		base.personal = {
			name: asText(p.name),
			headline: asText(p.headline),
			location: asText(p.location),
			email: asText(p.email),
			phone: asText(p.phone),
			website: asText(p.website),
			linkedin: asText(p.linkedin),
			summary: asText(p.summary),
			photo: asText(p.photo).startsWith('data:image/') ? asText(p.photo) : ''
		};

		if (Array.isArray(source.experience)) {
			base.experience = source.experience
				.filter((e) => !!e && typeof e === 'object')
				.map((e) => {
					const x = /** @type {Record<string, unknown>} */ (e);
					return {
						id: asText(x.id) || uid('exp'),
						company: asText(x.company),
						role: asText(x.role),
						startDate: asText(x.startDate),
						endDate: asText(x.endDate),
						bullets: asText(x.bullets)
					};
				});
		}

		if (Array.isArray(source.education)) {
			base.education = source.education
				.filter((e) => !!e && typeof e === 'object')
				.map((e) => {
					const x = /** @type {Record<string, unknown>} */ (e);
					return {
						id: asText(x.id) || uid('edu'),
						institution: asText(x.institution),
						degree: asText(x.degree),
						graduationYear: asText(x.graduationYear)
					};
				});
		}

		if (Array.isArray(source.projects)) {
			base.projects = source.projects
				.filter((e) => !!e && typeof e === 'object')
				.map((e) => {
					const x = /** @type {Record<string, unknown>} */ (e);
					return {
						id: asText(x.id) || uid('proj'),
						name: asText(x.name),
						link: asText(x.link),
						bullets: asText(x.bullets)
					};
				});
		}

		if (Array.isArray(source.certifications)) {
			base.certifications = source.certifications
				.filter((e) => !!e && typeof e === 'object')
				.map((e) => {
					const x = /** @type {Record<string, unknown>} */ (e);
					return {
						id: asText(x.id) || uid('cert'),
						name: asText(x.name),
						issuer: asText(x.issuer),
						year: asText(x.year)
					};
				});
		}

		if (Array.isArray(source.customSections)) {
			base.customSections = source.customSections
				.filter((e) => !!e && typeof e === 'object')
				.map((e) => {
					const x = /** @type {Record<string, unknown>} */ (e);
					return {
						id: asText(x.id) || uid('custom'),
						title: asText(x.title),
						body: asText(x.body)
					};
				});
		}

		if (Array.isArray(source.skills)) {
			base.skills = source.skills
				.map((s) => asText(s).trim())
				.filter((s) => s.length > 0)
				.filter((s, i, arr) => arr.indexOf(s) === i);
		}

		base.skillStyle = source.skillStyle === 'bullets' ? 'bullets' : 'line';

		// Section order: keep known ids in saved order, append any new ones.
		const savedOrder = Array.isArray(source.sectionOrder)
			? source.sectionOrder
					.map((s) => asText(s))
					.filter((s) => SECTION_IDS.includes(/** @type {never} */ (s)))
			: [];
		base.sectionOrder = [
			...savedOrder,
			...SECTION_IDS.filter((id) => !savedOrder.includes(id))
		];

		base.hiddenSections = Array.isArray(source.hiddenSections)
			? source.hiddenSections
					.map((s) => asText(s))
					.filter((s) => SECTION_IDS.includes(/** @type {never} */ (s)))
			: [];

		base.jobDescription = asText(source.jobDescription);

		const fontKey = asText(source.fontFamily);
		base.fontFamily = fontKey in FONTS ? fontKey : 'system';

		const size = Number(source.fontSize);
		base.fontSize = Number.isFinite(size)
			? Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size))
			: FONT_SIZE_DEFAULT;

		return base;
	}

	/** @returns {Resume} */
	function exampleResume() {
		return {
			personal: {
				name: 'Ada Lovelace',
				headline: 'Senior Software Engineer',
				location: 'London, UK',
				email: 'ada@example.com',
				phone: '+44 20 7946 0018',
				website: 'https://ada.dev',
				linkedin: 'linkedin.com/in/ada',
				summary:
					'Software engineer with 8+ years building reliable distributed systems. Comfortable owning services end to end — from design review through on-call — and mentoring engineers to do the same.',
				photo: ''
			},
			experience: [
				{
					id: uid('exp'),
					company: 'Analytical Engines Ltd',
					role: 'Senior Software Engineer',
					startDate: 'Mar 2021',
					endDate: 'Present',
					bullets:
						'Led migration of the billing platform to event-driven architecture, cutting p95 latency 40%\nMentored 4 engineers across 2 squads; all promoted within 18 months\nDrove incident-response process that reduced mean time to recovery from 45 to 12 minutes'
				},
				{
					id: uid('exp'),
					company: 'Difference Engine Co',
					role: 'Software Engineer',
					startDate: 'Jun 2017',
					endDate: 'Feb 2021',
					bullets:
						'Built the internal feature-flag service now used by 30+ teams\nCut CI pipeline duration from 22 to 8 minutes by parallelising test suites'
				}
			],
			education: [
				{
					id: uid('edu'),
					institution: 'University of Cambridge',
					degree: 'B.A. Mathematics',
					graduationYear: '2015'
				}
			],
			projects: [
				{
					id: uid('proj'),
					name: 'OpenTelemetry exporter for edge runtimes',
					link: 'github.com/ada/otel-edge',
					bullets:
						'Maintainer of a 1.2k-star library used to trace serverless workloads\nPublished v2 with backward-compatible API after community RFC'
				}
			],
			certifications: [
				{
					id: uid('cert'),
					name: 'AWS Certified Solutions Architect – Associate',
					issuer: 'Amazon Web Services',
					year: '2023'
				}
			],
			customSections: [
				{
					id: uid('custom'),
					title: 'Awards',
					body: 'Grace Hopper Award for Outstanding Engineering, 2022\nOpen Source Contributor Award, 2020'
				},
				{
					id: uid('custom'),
					title: 'Languages',
					body: 'English — native\nFrench — professional working proficiency'
				}
			],
			skills: [
				'TypeScript',
				'Go',
				'Svelte',
				'PostgreSQL',
				'Kubernetes',
				'Distributed systems',
				'Mentoring'
			],
			skillStyle: 'line',
			sectionOrder: [...SECTION_IDS],
			hiddenSections: [],
			jobDescription: '',
			fontFamily: 'system',
			fontSize: FONT_SIZE_DEFAULT
		};
	}

	function loadStored() {
		if (typeof localStorage === 'undefined') return null;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			return normalize(JSON.parse(raw));
		} catch {
			return null;
		}
	}

	let resume = $state(defaultResume());
	/** @type {PaperSize} */
	let paper = $state('a4');
	/** @type {'classic' | 'sidebar' | 'modern' | 'minimal' | 'elegant' | 'bold' | 'mono' | 'photo' | 'executive' | 'ats'} */
	let template = $state('classic');
	let accent = $state('#1e293b');
	let margin = $state('14');
	let density = $state('normal');
	let darkMode = $state(false);
	/** @type {'circle' | 'square'} */
	let photoShape = $state('circle');
	let expItems = $state(/** @type {any[]} */ ([]));
	$effect(() => { expItems = [...resume.experience]; });
	let skillDraft = $state('');
	let history = $state(/** @type {string[]} */ ([]));
	let historyIndex = $state(-1);
	let isUndoing = false;
	let versions = $state(/** @type {{name:string,data:string,date:string}[]} */ ([]));
	let versionPick = $state('');
	let showPalette = $state(false);
	let showMore = $state(false);
	let notice = $state(/** @type {{ text: string; tone: 'ok' | 'bad' }} */ ({ text: '', tone: 'ok' }));
	/** @type {ReturnType<typeof setTimeout> | null} */
	let noticeTimer = null;
	let fileInput = $state(/** @type {HTMLInputElement | null} */ (null));

	/** @param {number} next */
	function setFontSize(next) {
		resume.fontSize = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, next));
	}

	// Hydration-safe autosave: first pass rehydrates from localStorage without
	// writing; every subsequent mutation serializes the whole document.
	let started = false;
	$effect(() => {
		const payload = JSON.stringify(resume);
		if (!started) {
			started = true;
			const stored = loadStored();
			if (stored) resume = stored;
			const snap = JSON.stringify(resume);
			history = [snap];
			historyIndex = 0;
			try {
				const v = JSON.parse(localStorage.getItem('resume-builder:versions') || '[]');
				if (Array.isArray(v)) {
					const seen = new Set();
					versions = v.filter((x) => {
						if (!x || typeof x.name !== 'string' || seen.has(x.name)) return false;
						seen.add(x.name);
						return true;
					});
				}
			} catch {}
			return;
		}
		if (!isUndoing) {
			const snap = JSON.stringify(resume);
			if (history[historyIndex] !== snap) {
				const next = history.slice(0, historyIndex + 1);
				next.push(snap);
				if (next.length > 200) next.shift();
				history = next;
				historyIndex = next.length - 1;
			}
		}
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, payload);
		} catch {
			// Quota exceeded or storage blocked — keep running in-memory.
		}
	});

	// Keep the native @page rule in sync with the on-screen paper size.
	$effect(() => {
		if (typeof document === 'undefined') return;
		const id = 'resume-builder-page-rule';
		let el = document.getElementById(id);
		if (!el) {
			el = document.createElement('style');
			el.id = id;
			document.head.appendChild(el);
		}
		el.textContent = `@media print { @page { size: ${PAPER[paper].size}; margin: ${margin}mm; } }`;
	});

	let settingsHydrated = $state(false);
	$effect(() => {
		if (typeof localStorage === 'undefined' || !settingsHydrated) return;
		try { localStorage.setItem('resume-builder:template', template); localStorage.setItem('resume-builder:accent', accent); localStorage.setItem('resume-builder:margin', margin); localStorage.setItem('resume-builder:density', density); localStorage.setItem('resume-builder:dark', darkMode ? '1' : '0'); localStorage.setItem('resume-builder:photoShape', photoShape); } catch {}
	});

	$effect(() => {
		if (typeof document === 'undefined') return;
		document.documentElement.classList.toggle('dark', darkMode);
	});

	// hydrate template
	$effect(() => {
		if (typeof localStorage === 'undefined') return;
		try { const a = localStorage.getItem('resume-builder:accent'); if (a) accent = a; } catch {}
		try { const m = localStorage.getItem('resume-builder:margin'); if (m) margin = m; } catch {}
		try { const d = localStorage.getItem('resume-builder:density'); if (d) density = d; } catch {}
		try { const dm = localStorage.getItem('resume-builder:dark'); if (dm) darkMode = dm === '1'; } catch {}
		try { const ps = localStorage.getItem('resume-builder:photoShape'); if (ps === 'circle' || ps === 'square') photoShape = ps; } catch {}
		const t = localStorage.getItem('resume-builder:template');
		if (t === 'classic' || t === 'sidebar' || t === 'modern' || t === 'minimal' || t === 'elegant' || t === 'bold' || t === 'mono' || t === 'photo' || t === 'executive' || t === 'ats') template = t;
		settingsHydrated = true;
	});

	const contacts = $derived(
		[
			resume.personal.location,
			resume.personal.email,
			resume.personal.phone,
			resume.personal.website,
			resume.personal.linkedin
		]
			.map((v) => asText(v).trim())
			.filter(Boolean)
	);

	// Photo shows only in the Photo template and only when one is set.
	function templateShowsPhoto(/** @type {string} */ t) {
		return t === 'photo';
	}
	const showPhoto = $derived(templateShowsPhoto(template) && !!resume.personal.photo);

	// ── Page-count / overflow detection ──────────────────────────────────
	// Measures rendered height against one physical page so users learn about
	// overflow before printing (print CSS lets content spill silently).
	let pageEl = $state(/** @type {HTMLDivElement | null} */ (null));
	let pageCount = $state(1);
	const MM_TO_PX = 96 / 25.4;

	$effect(() => {
		// Re-run whenever content or paper size changes.
		void JSON.stringify(resume);
		void paper;
		void margin;
		if (!pageEl) {
			pageCount = 1;
			return;
		}
		const pageHeightPx = (paper === 'a4' ? 297 : 279.4) * MM_TO_PX;
		const paddingPx = 2 * Number(margin) * MM_TO_PX;
		const contentPx = pageEl.scrollHeight - paddingPx;
		const usablePx = pageHeightPx - paddingPx;
		const next = Math.max(1, Math.ceil(contentPx / usablePx - 0.05));
		if (next !== pageCount) pageCount = next;
	});

	// ── Completeness gauge ───────────────────────────────────────────────
	const completeness = $derived.by(() => {
		const p = resume.personal;
		const checks = [
			{ label: 'Name', done: !!p.name.trim() },
			{ label: 'Contact', done: !!(p.email.trim() || p.phone.trim()) },
			{ label: 'Summary', done: !!p.summary.trim() },
			{
				label: 'Experience',
				done: resume.experience.length > 0 && resume.experience.some((e) => lines(e.bullets).length > 0)
			},
			{ label: 'Education', done: resume.education.length > 0 },
			{ label: 'Skills (3+)', done: resume.skills.length >= 3 }
		];
		const done = checks.filter((c) => c.done).length;
		return { checks, done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
	});

	// ── Job-description keyword check (gap 8) ────────────────────────────
	const STOPWORDS = new Set([
		'the','and','for','are','but','not','you','all','any','can','has','had','his','her',
		'its','our','out','who','get','how','why','when','what','where','will','would','could',
		'should','may','might','this','that','these','those','with','from','into','than','then',
		'they','them','their','been','were','also','more','most','such','only','other','some',
		'able','using','used','use','well','like','just','over','under','about','after','before',
		'between','during','through','above','below','each','every','both','few','many','much',
		'per','via','etc','include','includes','including','required','require','requirements',
		'preferred','plus','across','within','without','youll','weve','youre','looking','join',
		'work','working','works','role','roles','job','jobs','position','candidate','team',
		'company','experience','years','year','strong','good','new','great','help','ensure'
	]);

	/** @param {string} text @returns {Set<string>} */
	function keywords(text) {
		return new Set(
			asText(text)
				.toLowerCase()
				.split(/[^a-z0-9+#.]+/)
				.map((w) => w.replace(/^[.+#]+|[.+#]+$/g, ''))
				.filter((w) => w.length >= 3 && !STOPWORDS.has(w))
		);
	}

	const keywordReport = $derived.by(() => {
		const jd = keywords(resume.jobDescription);
		if (jd.size === 0) return null;
		const hay = keywords(
			[
				resume.personal.name,
				resume.personal.headline,
				resume.personal.summary,
				...resume.experience.map((e) => `${e.role} ${e.company} ${e.bullets}`),
				...resume.education.map((e) => `${e.degree} ${e.institution}`),
				...resume.projects.map((p) => `${p.name} ${p.link} ${p.bullets}`),
				...resume.certifications.map((c) => `${c.name} ${c.issuer}`),
				...resume.customSections.map((c) => `${c.title} ${c.body}`),
				resume.skills.join(' ')
			].join(' ')
		);
		const matched = [];
		const missing = [];
		for (const word of jd) {
			if (hay.has(word)) matched.push(word);
			else missing.push(word);
		}
		return {
			matched,
			missing,
			total: jd.size,
			pct: Math.round((matched.length / jd.size) * 100)
		};
	});

	/**
	 * @param {string} id
	 * @returns {boolean}
	 */
	function sectionVisible(id) {
		return !resume.hiddenSections.includes(id);
	}

	/** @param {string} id */
	function toggleSection(id) {
		if (resume.hiddenSections.includes(id)) {
			resume.hiddenSections = resume.hiddenSections.filter((s) => s !== id);
		} else {
			resume.hiddenSections = [...resume.hiddenSections, id];
		}
	}

	/** @param {number} index @param {number} direction */
	function moveSection(index, direction) {
		const target = index + direction;
		if (target < 0 || target >= resume.sectionOrder.length) return;
		const list = [...resume.sectionOrder];
		const swap = list[index];
		list[index] = list[target];
		list[target] = swap;
		resume.sectionOrder = list;
	}

	/**
	 * @param {string} message
	 * @param {'ok' | 'bad'} [tone]
	 * @param {number} [duration]
	 */
	function flash(message, tone = 'ok', duration = 3200) {
		notice = { text: message, tone };
		if (noticeTimer) clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => {
			notice = { text: '', tone: 'ok' };
		}, duration);
	}

	/** @param {string} text @returns {string[]} */
	function lines(text) {
		return asText(text)
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
	}

	/**
	 * @param {string} start
	 * @param {string} end
	 * @returns {string}
	 */
	function dateRange(start, end) {
		const s = asText(start).trim();
		const e = asText(end).trim();
		if (s && e) return `${s} – ${e}`;
		return s || e;
	}

	// ── Collection operations ─────────────────────────────────────────────

	/**
	 * @param {{ id: string }[]} list
	 * @param {string} id
	 * @param {number} direction
	 */
	function moveItem(list, id, direction) {
		const index = list.findIndex((item) => item.id === id);
		const target = index + direction;
		if (index < 0 || target < 0 || target >= list.length) return;
		const swap = list[index];
		list[index] = list[target];
		list[target] = swap;
	}

	function addExperience() {
		resume.experience.push({
			id: uid('exp'),
			company: '',
			role: '',
			startDate: '',
			endDate: '',
			bullets: ''
		});
	}

	/** @param {string} id */
	function removeExperience(id) {
		resume.experience = resume.experience.filter((item) => item.id !== id);
	}

	function addEducation() {
		resume.education.push({
			id: uid('edu'),
			institution: '',
			degree: '',
			graduationYear: ''
		});
	}

	/** @param {string} id */
	function removeEducation(id) {
		resume.education = resume.education.filter((item) => item.id !== id);
	}

	function addProject() {
		resume.projects.push({ id: uid('proj'), name: '', link: '', bullets: '' });
	}

	/** @param {string} id */
	function removeProject(id) {
		resume.projects = resume.projects.filter((item) => item.id !== id);
	}

	function addCertification() {
		resume.certifications.push({ id: uid('cert'), name: '', issuer: '', year: '' });
	}

	/** @param {string} id */
	function removeCertification(id) {
		resume.certifications = resume.certifications.filter((item) => item.id !== id);
	}

	function addCustomSection() {
		resume.customSections.push({ id: uid('custom'), title: '', body: '' });
	}

	/** @param {string} id */
	function removeCustomSection(id) {
		resume.customSections = resume.customSections.filter((item) => item.id !== id);
	}

	function commitSkills() {
		const parts = skillDraft
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean);
		for (const part of parts) {
			if (!resume.skills.includes(part)) resume.skills.push(part);
		}
		skillDraft = '';
	}

	/** @param {number} index */
	function removeSkill(index) {
		resume.skills = resume.skills.filter((_, i) => i !== index);
	}

	/** @param {KeyboardEvent} event */
	function handleSkillKey(event) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			commitSkills();
		} else if (event.key === 'Backspace' && !skillDraft && resume.skills.length > 0) {
			resume.skills.pop();
		}
	}

	// ── Persistence helpers ───────────────────────────────────────────────

	/** @param {string} value */
	function slugify(value) {
		return (
			asText(value)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '') || 'resume'
		);
	}

	function exportMarkdown() {
		const lines = [];
		const p = resume.personal;
		if (p.name) lines.push(`# ${p.name}`);
		if (p.headline) lines.push(`_${p.headline}_`);
		const contacts = [p.location, p.email, p.phone, p.website, p.linkedin].filter(Boolean);
		if (contacts.length) lines.push(contacts.join(' · '));
		if (p.summary) { lines.push(''); lines.push('## Summary'); lines.push(p.summary); }
		for (const id of resume.sectionOrder) {
			if (!sectionVisible(id)) continue;
			if (id === 'experience' && resume.experience.length) {
				lines.push(''); lines.push('## Experience');
				for (const e of resume.experience) {
					lines.push(`### ${e.role || 'Role'} — ${e.company || ''}`);
					if (e.startDate || e.endDate) lines.push(`*${dateRange(e.startDate,e.endDate)}*`);
					for (const b of lines_of(e.bullets)) lines.push(`- ${b}`);
				}
			} else if (id === 'education' && resume.education.length) {
				lines.push(''); lines.push('## Education');
				for (const e of resume.education) lines.push(`- **${e.degree}** — ${e.institution} ${e.graduationYear}`.trim());
			} else if (id === 'projects' && resume.projects.length) {
				lines.push(''); lines.push('## Projects');
				for (const pr of resume.projects) { lines.push(`### ${pr.name}`); if (pr.link) lines.push(pr.link); for (const b of lines_of(pr.bullets)) lines.push(`- ${b}`); }
			} else if (id === 'certifications' && resume.certifications.length) {
				lines.push(''); lines.push('## Certifications');
				for (const c of resume.certifications) lines.push(`- ${c.name} — ${c.issuer} ${c.year}`.trim());
			} else if (id === 'custom' && resume.customSections.length) {
				for (const c of resume.customSections) { lines.push(''); lines.push(`## ${c.title}`); lines.push(c.body); }
			} else if (id === 'skills' && resume.skills.length) {
				lines.push(''); lines.push('## Skills'); lines.push(resume.skills.join(', '));
			}
		}
		try {
			const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url; a.download = `${slugify(resume.personal.name)}-resume.md`;
			document.body.appendChild(a); a.click(); a.remove();
			URL.revokeObjectURL(url);
			flash('Resume exported as Markdown.');
		} catch { flash('Export failed.', 'bad'); }
	}
	function lines_of(/** @type {string} */ text) { return asText(text).split('\n').map((l) => l.trim()).filter(Boolean); }

	function exportJSON() {
		try {
			const blob = new Blob([JSON.stringify(resume, null, 2)], {
				type: 'application/json'
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = `${slugify(resume.personal.name)}-resume.json`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			flash('Resume exported as JSON.');
		} catch {
			flash('Export failed in this browser.', 'bad');
		}
	}

	/** @param {Event} event */
	async function handleImport(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const file = input.files && input.files[0];
		if (!file) return;
		try {
			if (/\.pdf$/i.test(file.name)) {
				const buf = await file.arrayBuffer();
				const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
				let out = '';
				for (let i = 1; i <= pdf.numPages; i++) {
					const page = await pdf.getPage(i);
					const content = await page.getTextContent();
					out += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
				}
				resume.customSections = [...resume.customSections, { id: uid('custom'), title: `Imported from ${file.name}`, body: out.trim() }];
				flash('PDF text imported into a custom section.');
				input.value = '';
				return;
			}
			const text = await file.text();
			const data = JSON.parse(text);
			if (!data || typeof data !== 'object' || Array.isArray(data)) {
				throw new Error('invalid-shape');
			}
			// Support JSON Resume format (basics/work/education/skills)
			let mapped = data;
			if (data.basics && !data.personal) {
				mapped = {
					personal: {
						name: data.basics.name || '',
						headline: data.basics.label || '',
						location: data.basics.location?.city || '',
						email: data.basics.email || '',
						phone: data.basics.phone || '',
						website: data.basics.url || '',
						linkedin: (data.basics.profiles || []).find((/** @type {any} */ p) => /linkedin/i.test(p.network))?.url || '',
						summary: data.basics.summary || '',
						photo: ''
					},
					experience: (data.work || []).map((/** @type {any} */ w) => ({
						id: uid('exp'),
						company: w.name || '',
						role: w.position || '',
						startDate: w.startDate || '',
						endDate: w.endDate || '',
						bullets: (w.highlights || []).join('\n')
					})),
					education: (data.education || []).map((/** @type {any} */ e) => ({
						id: uid('edu'),
						institution: e.institution || '',
						degree: e.studyType ? `${e.studyType} ${e.area || ''}`.trim() : (e.area || ''),
						graduationYear: e.endDate || ''
					})),
					projects: (data.projects || []).map((/** @type {any} */ p) => ({
						id: uid('proj'),
						name: p.name || '',
						link: p.url || '',
						bullets: (p.highlights || []).join('\n') || (p.description || '')
					})),
					certifications: (data.certificates || []).map((/** @type {any} */ c) => ({
						id: uid('cert'),
						name: c.name || '',
						issuer: c.issuer || '',
						year: c.date || ''
					})),
					customSections: [],
					skills: (data.skills || []).map((/** @type {any} */ s) => s.name).filter(Boolean),
					skillStyle: 'line',
					sectionOrder: [...SECTION_IDS],
					hiddenSections: [],
					jobDescription: '',
					fontFamily: 'system',
					fontSize: FONT_SIZE_DEFAULT
				};
			}
			resume = normalize(mapped);
			flash('Resume imported successfully.');
		} catch {
			flash('Import failed — that file is not valid resume JSON.', 'bad');
		} finally {
			input.value = '';
		}
	}

	function resetResume() {
		if (!confirm('Clear this resume and start over? This cannot be undone.')) return;
		resume = defaultResume();
		skillDraft = '';
		flash('Resume cleared.');
	}

	function loadExample() {
		const isEmpty =
			!resume.personal.name.trim() &&
			resume.experience.length === 0 &&
			resume.education.length === 0 &&
			resume.projects.length === 0 &&
			resume.certifications.length === 0 &&
			resume.customSections.length === 0 &&
			resume.skills.length === 0;
		if (!isEmpty && !confirm('Replace your current resume with the example?')) return;
		resume = exampleResume();
		skillDraft = '';
		flash('Example resume loaded — edit it or Reset to start fresh.');
	}

	function undo() {
		if (historyIndex <= 0) return;
		isUndoing = true;
		historyIndex -= 1;
		resume = normalize(JSON.parse(history[historyIndex]));
		isUndoing = false;
	}
	function redo() {
		if (historyIndex >= history.length - 1) return;
		isUndoing = true;
		historyIndex += 1;
		resume = normalize(JSON.parse(history[historyIndex]));
		isUndoing = false;
	}

	function handleKeydown(/** @type {KeyboardEvent} */ event) {
		const mod = event.metaKey || event.ctrlKey;
		if (!mod) return;
		if (event.key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
		else if ((event.key === 'z' && event.shiftKey) || event.key === 'y') { event.preventDefault(); redo(); }
		else if (event.key === 'p') { event.preventDefault(); printResume(); }
		else if (event.key === 'k') { event.preventDefault(); showPalette = !showPalette; }
	}

	function saveVersion() {
		const name = (prompt('Version name:') || '').trim();
		if (!name) return;
		const entry = { name, data: JSON.stringify(resume), date: new Date().toISOString().slice(0,10) };
		const existing = versions.findIndex((v) => v.name === name);
		versions = existing >= 0
			? versions.map((v, i) => (i === existing ? entry : v))
			: [...versions, entry];
		try { localStorage.setItem('resume-builder:versions', JSON.stringify(versions)); } catch {}
		flash(existing >= 0 ? `Updated version “${name}”.` : `Saved version “${name}”.`);
	}
	function restoreVersion() {
		const v = versions.find((x) => x.name === versionPick);
		if (!v) return;
		if (!confirm(`Restore version “${v.name}”? Current edits will be replaced.`)) return;
		resume = normalize(JSON.parse(v.data));
		flash(`Restored “${v.name}”.`);
	}

	async function copyText() {
		const lines = [resume.personal.name, resume.personal.headline, ...resume.personal.summary ? [resume.personal.summary] : [], ...resume.experience.map(e => `${e.role} at ${e.company}\n${e.bullets}`), ...resume.skills].filter(Boolean);
		try { await navigator.clipboard.writeText(lines.join('\n\n')); flash('Copied resume text.'); } catch { flash('Clipboard unavailable.', 'bad'); }
	}

	async function exportDOCX() {
		const children = [];
		const p = resume.personal;
		children.push(new Paragraph({ text: p.name || 'Your Name', heading: HeadingLevel.TITLE }));
		if (p.headline) children.push(new Paragraph({ text: p.headline }));
		const contacts = [p.location, p.email, p.phone, p.website, p.linkedin].filter(Boolean);
		if (contacts.length) children.push(new Paragraph({ text: contacts.join(' · ') }));
		if (p.summary) { children.push(new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_2 })); children.push(new Paragraph({ text: p.summary })); }
		for (const id of resume.sectionOrder) {
			if (!sectionVisible(id)) continue;
			if (id === 'experience' && resume.experience.length) {
				children.push(new Paragraph({ text: 'Experience', heading: HeadingLevel.HEADING_2 }));
				for (const e of resume.experience) {
					children.push(new Paragraph({ text: `${e.role} — ${e.company}`, heading: HeadingLevel.HEADING_3 }));
					if (e.startDate || e.endDate) children.push(new Paragraph({ text: dateRange(e.startDate, e.endDate), style: 'IntenseQuote' }));
					for (const b of lines(e.bullets)) children.push(new Paragraph({ text: b, bullet: { level: 0 } }));
				}
			} else if (id === 'education' && resume.education.length) {
				children.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2 }));
				for (const e of resume.education) children.push(new Paragraph({ text: `${e.degree} — ${e.institution} ${e.graduationYear}`.trim() }));
			} else if (id === 'projects' && resume.projects.length) {
				children.push(new Paragraph({ text: 'Projects', heading: HeadingLevel.HEADING_2 }));
				for (const pr of resume.projects) { children.push(new Paragraph({ text: pr.name, heading: HeadingLevel.HEADING_3 })); for (const b of lines(pr.bullets)) children.push(new Paragraph({ text: b, bullet: { level: 0 } })); }
			} else if (id === 'certifications' && resume.certifications.length) {
				children.push(new Paragraph({ text: 'Certifications', heading: HeadingLevel.HEADING_2 }));
				for (const c of resume.certifications) children.push(new Paragraph({ text: `${c.name} — ${c.issuer} ${c.year}`.trim() }));
			} else if (id === 'custom' && resume.customSections.length) {
				for (const c of resume.customSections) { children.push(new Paragraph({ text: c.title, heading: HeadingLevel.HEADING_2 })); children.push(new Paragraph({ text: c.body })); }
			} else if (id === 'skills' && resume.skills.length) {
				children.push(new Paragraph({ text: 'Skills', heading: HeadingLevel.HEADING_2 }));
				children.push(new Paragraph({ text: resume.skills.join(', ') }));
			}
		}
		const doc = new Document({ sections: [{ children }] });
		const blob = await Packer.toBlob(doc);
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = `${slugify(resume.personal.name)}-resume.docx`;
		document.body.appendChild(a); a.click(); a.remove();
		URL.revokeObjectURL(url);
		flash('Resume exported as DOCX.');
	}

	function handleExpConsider(/** @type {any} */ e) { expItems = e.detail.items; }
	function handleExpFinalize(/** @type {any} */ e) { expItems = e.detail.items; resume.experience = expItems; }

	// Center-crop to a square and downscale so localStorage stays small (~30-50 KB).
	function handlePhoto(/** @type {Event} */ e) {
		const input = /** @type {HTMLInputElement} */ (e.currentTarget);
		const file = input.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			flash('Choose an image file (PNG or JPG).', 'bad');
			input.value = '';
			return;
		}
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			const side = Math.min(img.naturalWidth, img.naturalHeight);
			const size = Math.max(1, Math.min(400, side));
			const c = document.createElement('canvas');
			c.width = size;
			c.height = size;
			const ctx = c.getContext('2d');
			if (!ctx) return;
			ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
			try {
				resume.personal.photo = c.toDataURL('image/jpeg', 0.85);
				flash('Photo added — it never leaves your browser.');
			} catch {
				flash('Could not process that image.', 'bad');
			}
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			flash('Could not read that image.', 'bad');
		};
		img.src = url;
		input.value = '';
	}

	function removePhoto() {
		resume.personal.photo = '';
		flash('Photo removed.');
	}

	function printResume() {
		window.print();
	}
</script>

<svelte:window onkeydown={handleKeydown} onclick={(e) => { if (showMore && !e.composedPath().some((el) => el instanceof Element && (el.classList.contains('overflow-menu') || el.classList.contains('more-wrapper')))) showMore = false; }} />

<svelte:head>
	<title>Resume Builder</title>
	<meta name="description" content="Local-first resume builder with live preview and print-to-PDF." />
</svelte:head>

<div
	class="app-shell flex min-h-screen flex-col bg-slate-100 text-slate-900 antialiased lg:h-screen lg:min-h-0 lg:overflow-hidden dark:bg-slate-950 dark:text-slate-100"
>
	<!-- ── Toolbar ─────────────────────────────────────────────────────── -->
	<header class="no-print border-b border-slate-200 bg-white print:hidden dark:border-slate-800 dark:bg-slate-900">
		<div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
			<div class="flex items-baseline gap-2.5 shrink-0">
				<h1 class="text-sm font-semibold tracking-tight text-slate-900">Resume Builder</h1>
				<span class="hidden text-[11px] text-slate-500 sm:inline">local-first · autosaved</span>
			</div>

			{#if notice.text}
				<span
					class="text-[11px] font-medium {notice.tone === 'bad'
						? 'text-rose-600'
						: 'text-emerald-600'}"
					role="status"
					aria-live="polite"
				>
					{notice.text}
				</span>
			{/if}

			<!-- Document definition (set once per resume) -->
			<div class="flex items-center gap-2">
				<label class="sr-only" for="toolbar-template">Template</label>
				<select
					id="toolbar-template"
					class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					bind:value={template}
				>
					<option value="classic">Classic</option>
					<option value="sidebar">Sidebar</option>
					<option value="modern">Modern</option>
					<option value="minimal">Minimal</option>
					<option value="elegant">Elegant</option>
					<option value="bold">Bold</option>
					<option value="mono">Mono</option>
					<option value="photo">Photo</option>
					<option value="executive">Executive</option>
					<option value="ats">ATS-safe</option>
				</select>
				<div
					class="flex rounded-lg border border-slate-200 p-0.5"
					role="group"
					aria-label="Paper size"
				>
					<button
						type="button"
						class="rounded-md px-2.5 py-1 text-[11px] font-semibold transition {paper === 'a4'
							? 'bg-slate-900 text-white'
							: 'text-slate-500 hover:text-slate-800'}"
						aria-pressed={paper === 'a4'}
						onclick={() => (paper = 'a4')}
					>
						A4
					</button>
					<button
						type="button"
						class="rounded-md px-2.5 py-1 text-[11px] font-semibold transition {paper ===
						'letter'
							? 'bg-slate-900 text-white'
							: 'text-slate-500 hover:text-slate-800'}"
						aria-pressed={paper === 'letter'}
						onclick={() => (paper = 'letter')}
					>
						Letter
					</button>
				</div>
			</div>

			<!-- Appearance tuning (occasional) -->
			<div class="flex items-center gap-2">
				<label class="sr-only" for="toolbar-accent">Accent</label>
				<input id="toolbar-accent" type="color" class="h-8 w-8 cursor-pointer rounded border border-slate-200" bind:value={accent} />
				<label class="sr-only" for="toolbar-margin">Margin</label>
				<select id="toolbar-margin" class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700" bind:value={margin}>
					<option value="10">Narrow</option>
					<option value="14">Normal</option>
					<option value="20">Wide</option>
				</select>
				<label class="sr-only" for="toolbar-density">Density</label>
				<select id="toolbar-density" class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700" bind:value={density}>
					<option value="compact">Compact</option>
					<option value="normal">Normal</option>
					<option value="relaxed">Relaxed</option>
				</select>
				<label class="sr-only" for="toolbar-font">Font</label>
				<select
					id="toolbar-font"
					class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					bind:value={resume.fontFamily}
				>
					{#each Object.entries(FONTS) as [key, font] (key)}
						<option value={key}>{font.label}</option>
					{/each}
				</select>
				<div
					class="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5"
					role="group"
					aria-label="Font size"
				>
					<button
						type="button"
						class="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:pointer-events-none disabled:opacity-30"
						aria-label="Decrease font size"
						disabled={resume.fontSize <= FONT_SIZE_MIN}
						onclick={() => setFontSize(resume.fontSize - 1)}
					>
						A−
					</button>
					<span
						class="min-w-[2.75rem] text-center text-[11px] font-semibold tabular-nums text-slate-700"
						aria-live="polite"
					>
						{resume.fontSize}px
					</span>
					<button
						type="button"
						class="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:pointer-events-none disabled:opacity-30"
						aria-label="Increase font size"
						disabled={resume.fontSize >= FONT_SIZE_MAX}
						onclick={() => setFontSize(resume.fontSize + 1)}
					>
						A+
					</button>
				</div>
			</div>

			<!-- Editing controls (high frequency) -->
			<div class="flex items-center gap-2">
				<button type="button" class={cls.btnSecondary} onclick={undo} disabled={historyIndex <= 0}>Undo</button>
				<button type="button" class={cls.btnSecondary} onclick={redo} disabled={historyIndex >= history.length - 1}>Redo</button>
				<button type="button" class={cls.btnGhost} onclick={() => (showPalette = true)}>⌘K</button>
				<button type="button" class={cls.btnGhost} onclick={() => (darkMode = !darkMode)}>{darkMode ? "Light" : "Dark"}</button>
			</div>

			<!-- Overflow: infrequent file-level actions -->
			<div class="relative more-wrapper ml-auto">
				<button type="button" class={cls.btnSecondary} onclick={() => (showMore = !showMore)}>More</button>
				{#if showMore}
					<div class="overflow-menu absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-xl z-50">
						<button type="button" class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50" onclick={() => { loadExample(); showMore = false; }}>Example</button>
						<button type="button" class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50" onclick={() => { fileInput?.click(); showMore = false; }}>Import JSON</button>
						<button type="button" class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50" onclick={() => { exportJSON(); showMore = false; }}>Export JSON</button>
						<button type="button" class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50" onclick={() => { exportMarkdown(); showMore = false; }}>Export Markdown</button>
						<button type="button" class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50" onclick={() => { exportDOCX(); showMore = false; }}>Export DOCX</button>
						<button type="button" class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50" onclick={() => { while (pageCount > 1 && resume.fontSize > FONT_SIZE_MIN) setFontSize(resume.fontSize - 1); flash('Fitted to one page.'); showMore = false; }}>Fit 1 page</button>
						<button type="button" class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50" onclick={() => { copyText(); showMore = false; }}>Copy text</button>
						<button type="button" class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 text-rose-600" onclick={() => { resetResume(); showMore = false; }}>Reset</button>
						<button type="button" class={cls.btnSecondary} onclick={() => { saveVersion(); showMore = false; }}>Save version</button>
						{#if versions.length}
							<select class="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 mt-1 mb-1" bind:value={versionPick}>
								<option value="">Restore version…</option>
								{#each versions as v, i (i)}<option value={v.name}>{v.name} ({v.date})</option>{/each}
							</select>
							<button type="button" class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50" onclick={() => { restoreVersion(); showMore = false; }} disabled={!versionPick}>Restore</button>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Primary action -->
			<button
				type="button"
				class={cls.btnPrimary}
				onclick={printResume}
			>
				Print / Save PDF
			</button>
		</div>
	</header>

	{#if showPalette}
		<div class="no-print fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-24" onclick={(e) => { if (e.target === e.currentTarget) showPalette = false; }} onkeydown={(e) => e.key === "Escape" && (showPalette = false)} role="dialog" aria-modal="true" tabindex="-1">
			<div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
				<p class="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Command palette</p>
				<div class="divide-y divide-slate-100">
					{#each commands as cmd (cmd.label)}
						<button
							type="button"
							class="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							onclick={cmd.action}
						>
							{#if cmd.key}
								<kbd class="shrink-0 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
									{cmd.key}
								</kbd>
							{:else}
								<span class="shrink-0 w-6" aria-hidden="true"> </span>
							{/if}
							<span class="flex-1 truncate">{cmd.label}</span>
							<span class="text-[11px] text-slate-500">{cmd.desc}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- ── Split pane ──────────────────────────────────────────────────── -->
	<div class="main-shell flex flex-1 flex-col lg:min-h-0 lg:flex-row">
		<!-- Editor -->
		<aside
			class="no-print w-full shrink-0 border-b border-slate-200 bg-white lg:w-[440px] lg:overflow-y-auto lg:border-b-0 lg:border-r print:hidden dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="space-y-5 p-4 sm:p-6">
				<!-- Completeness gauge (gap 5) -->
				<section class={cls.card}>
					<div class="mb-2 flex items-center justify-between">
						<h2 class="mb-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
							Completeness
						</h2>
						<span class="text-[11px] font-semibold tabular-nums text-slate-500">
							{completeness.done}/{completeness.total}
						</span>
					</div>
					<div
						class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
						role="progressbar"
						aria-valuenow={completeness.pct}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-label="Resume completeness"
					>
						<div
							class="h-full rounded-full transition-all duration-300 {completeness.pct === 100
								? 'bg-emerald-500'
								: 'bg-blue-500'}"
							style="width: {completeness.pct}%"
						></div>
					</div>
					<ul class="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
						{#each completeness.checks as check (check.label)}
							<li
								class="text-[11px] {check.done ? 'text-emerald-600' : 'text-slate-400'}"
							>
								{check.done ? '✓' : '○'}
								{check.label}
							</li>
						{/each}
					</ul>
				</section>

				<!-- Personal -->
				<section class={cls.card}>
					<h2 class={cls.sectionTitle}>Personal</h2>
					<div class={cls.fieldGroup}>
						<div>
							<label class={cls.label} for="f-name">Name</label>
							<input
								id="f-name"
								type="text"
								class={cls.input}
								autocomplete="name"
								placeholder="Ada Lovelace"
								bind:value={resume.personal.name}
							/>
						</div>
						<div>
							<label class={cls.label} for="f-headline">Headline</label>
							<input
								id="f-headline"
								type="text"
								class={cls.input}
								placeholder="Senior Software Engineer"
								bind:value={resume.personal.headline}
							/>
						</div>
						<div class={cls.grid2}>
							<div>
								<label class={cls.label} for="f-location">Location</label>
								<input
									id="f-location"
									type="text"
									class={cls.input}
									autocomplete="address-level2"
									placeholder="Berlin, Germany"
									bind:value={resume.personal.location}
								/>
							</div>
							<div>
								<label class={cls.label} for="f-phone">Phone</label>
								<input
									id="f-phone"
									type="tel"
									class={cls.input}
									autocomplete="tel"
									placeholder="+1 (555) 000-0000"
									bind:value={resume.personal.phone}
								/>
							</div>
						</div>
						<div class={cls.grid2}>
							<div>
								<label class={cls.label} for="f-email">Email</label>
								<input
									id="f-email"
									type="email"
									class={cls.input}
									autocomplete="email"
									placeholder="ada@example.com"
									bind:value={resume.personal.email}
								/>
							</div>
							<div>
								<label class={cls.label} for="f-website">Website</label>
								<input
									id="f-website"
									type="url"
									class={cls.input}
									placeholder="https://ada.dev"
									bind:value={resume.personal.website}
								/>
							</div>
						</div>
						<div>
							<label class={cls.label} for="f-linkedin">LinkedIn</label>
							<input
								id="f-linkedin"
								type="text"
								class={cls.input}
								placeholder="linkedin.com/in/ada"
								bind:value={resume.personal.linkedin}
							/>
						</div>
						<div>
							<label class={cls.label} for="f-photo">Photo</label>
							<div class="flex flex-wrap items-center gap-2">
								<label
									class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
								>
									{resume.personal.photo ? 'Replace photo' : 'Choose image'}
									<input
										id="f-photo"
										type="file"
										accept="image/*"
										class="sr-only"
										onchange={handlePhoto}
									/>
								</label>
								{#if resume.personal.photo}
									<button type="button" class={cls.btnGhost} onclick={removePhoto}>Remove</button>
								{/if}
								<div class="flex items-center gap-1" role="group" aria-label="Photo shape">
									<button
										type="button"
										class="rounded-md px-2.5 py-1 text-[11px] font-semibold transition {photoShape ===
										'circle'
											? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
											: 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}"
										aria-pressed={photoShape === 'circle'}
										onclick={() => (photoShape = 'circle')}
									>
										Circle
									</button>
									<button
										type="button"
										class="rounded-md px-2.5 py-1 text-[11px] font-semibold transition {photoShape ===
										'square'
											? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
											: 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}"
										aria-pressed={photoShape === 'square'}
										onclick={() => (photoShape = 'square')}
									>
										Square
									</button>
								</div>
							</div>
							<p class="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
								Click “Add photo” in the preview, or choose a file here. Shown only in the Photo
								template; stored in your browser.
							</p>
						</div>
						<div>
							<label class={cls.label} for="f-summary">Summary</label>
							<textarea
								id="f-summary"
								rows="4"
								class={cls.textarea}
								placeholder="Engineer with 8+ years building reliable distributed systems…"
								bind:value={resume.personal.summary}
							></textarea>
						</div>
					</div>
				</section>

				<!-- Section visibility -->
				<section class={cls.card}>
					<h2 class={cls.sectionTitle}>Sections</h2>
					<div class="space-y-1.5">
						{#each resume.sectionOrder as id, i (id)}
							<div class="flex items-center gap-2">
								<button type="button" class="rounded px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move {SECTION_LABELS[id]} up" disabled={i===0} onclick={() => moveSection(i,-1)}><ArrowUp size={14} /></button>
								<button type="button" class="rounded px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move {SECTION_LABELS[id]} down" disabled={i===resume.sectionOrder.length-1} onclick={() => moveSection(i,1)}><ArrowDown size={14} /></button>
								<button
									type="button"
									class="rounded-md border px-2.5 py-1 text-[11px] font-medium transition {sectionVisible(id) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-500'}"
									onclick={() => toggleSection(id)}
								>
									{SECTION_LABELS[id]}
								</button>
							</div>
						{/each}
					</div>
				</section>

				<!-- Work Experience -->
				<section class={cls.card}>
					<div class="mb-3 flex items-center justify-between">
						<h2 class="mb-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
							Work Experience
						</h2>
						<span class="text-[11px] tabular-nums text-slate-400">
							{resume.experience.length}
							{resume.experience.length === 1 ? 'entry' : 'entries'}
						</span>
					</div>

					{#if resume.experience.length === 0}
						<p class="mb-3 text-xs text-slate-500">No entries yet.</p>
					{:else}
						<div class="mb-3 space-y-3" use:dndzone={{items: expItems}} onconsider={handleExpConsider} onfinalize={handleExpFinalize}>
							{#each expItems as item, i (item.id)}
								<div class="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
									<div class="mb-2.5 flex items-center justify-between gap-2">
										<span
											class="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
										>
											Role {i + 1}
										</span>
										<div class="flex items-center gap-0.5">
											<button
												type="button"
												class={cls.iconBtn}
												title="Move up"
												aria-label="Move role {i + 1} up"
												disabled={i === 0}
												onclick={() => moveItem(resume.experience, item.id, -1)}
											>
												<ArrowUp size={14} />
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Move down"
												aria-label="Move role {i + 1} down"
												disabled={i === resume.experience.length - 1}
												onclick={() => moveItem(resume.experience, item.id, 1)}
											>
												<ArrowDown size={14} />
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Remove"
												aria-label="Remove role {i + 1}"
												onclick={() => removeExperience(item.id)}
											>
												<X size={14} />
											</button>
										</div>
									</div>

									<div class="space-y-2.5">
										<div class={cls.grid2}>
											<div>
												<label class={cls.label} for="exp-{item.id}-role">Role</label>
												<input
													id="exp-{item.id}-role"
													type="text"
													class={cls.input}
													placeholder="Software Engineer"
													bind:value={item.role}
												/>
											</div>
											<div>
												<label class={cls.label} for="exp-{item.id}-company">Company</label>
												<input
													id="exp-{item.id}-company"
													type="text"
													class={cls.input}
													placeholder="Acme Corp"
													bind:value={item.company}
												/>
											</div>
										</div>
										<div class={cls.grid2}>
											<div>
												<label class={cls.label} for="exp-{item.id}-start">Start Date</label>
												<input
													id="exp-{item.id}-start"
													type="text"
													class={cls.input}
													placeholder="Mar 2021"
													bind:value={item.startDate}
												/>
											</div>
											<div>
												<label class={cls.label} for="exp-{item.id}-end">End Date</label>
												<input
													id="exp-{item.id}-end"
													type="text"
													class={cls.input}
													placeholder="Present"
													bind:value={item.endDate}
												/>
											</div>
										</div>
										<div>
											<label class={cls.label} for="exp-{item.id}-bullets">
												Bullet Points <span class="normal-case text-slate-300">(one per line)</span>
											</label>
											<textarea
												id="exp-{item.id}-bullets"
												rows="4"
												class={cls.textarea}
												placeholder={BULLET_PLACEHOLDER}
												bind:value={item.bullets}
											></textarea>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<button type="button" class={cls.btnAdd} onclick={addExperience}>
						+ Add experience
					</button>
				</section>

				<!-- Education -->
				<section class={cls.card}>
					<div class="mb-3 flex items-center justify-between">
						<h2 class="mb-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
							Education
						</h2>
						<span class="text-[11px] tabular-nums text-slate-400">
							{resume.education.length}
							{resume.education.length === 1 ? 'entry' : 'entries'}
						</span>
					</div>

					{#if resume.education.length === 0}
						<p class="mb-3 text-xs text-slate-500">No entries yet.</p>
					{:else}
						<div class="mb-3 space-y-3">
							{#each resume.education as item, i (item.id)}
								<div class="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
									<div class="mb-2.5 flex items-center justify-between gap-2">
										<span
											class="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
										>
											School {i + 1}
										</span>
										<div class="flex items-center gap-0.5">
											<button
												type="button"
												class={cls.iconBtn}
												title="Move up"
												aria-label="Move school {i + 1} up"
												disabled={i === 0}
												onclick={() => moveItem(resume.education, item.id, -1)}
											>
												<ArrowUp size={14} />
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Move down"
												aria-label="Move school {i + 1} down"
												disabled={i === resume.education.length - 1}
												onclick={() => moveItem(resume.education, item.id, 1)}
											>
												<ArrowDown size={14} />
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Remove"
												aria-label="Remove school {i + 1}"
												onclick={() => removeEducation(item.id)}
											>
												<X size={14} />
											</button>
										</div>
									</div>

									<div class="space-y-2.5">
										<div>
											<label class={cls.label} for="edu-{item.id}-institution">Institution</label>
											<input
												id="edu-{item.id}-institution"
												type="text"
												class={cls.input}
												placeholder="University of Cambridge"
												bind:value={item.institution}
											/>
										</div>
										<div class={cls.grid2}>
											<div>
												<label class={cls.label} for="edu-{item.id}-degree">Degree</label>
												<input
													id="edu-{item.id}-degree"
													type="text"
													class={cls.input}
													placeholder="B.A. Mathematics"
													bind:value={item.degree}
												/>
											</div>
											<div>
												<label class={cls.label} for="edu-{item.id}-year">Graduation Year</label>
												<input
													id="edu-{item.id}-year"
													type="text"
													class={cls.input}
													placeholder="2015"
													bind:value={item.graduationYear}
												/>
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<button type="button" class={cls.btnAdd} onclick={addEducation}>
						+ Add education
					</button>
				</section>

				<!-- Projects (gap 6) -->
				<section class={cls.card}>
					<div class="mb-3 flex items-center justify-between">
						<h2 class="mb-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
							Projects
						</h2>
						<span class="text-[11px] tabular-nums text-slate-400">
							{resume.projects.length}
							{resume.projects.length === 1 ? 'entry' : 'entries'}
						</span>
					</div>

					{#if resume.projects.length === 0}
						<p class="mb-3 text-xs text-slate-500">No entries yet.</p>
					{:else}
						<div class="mb-3 space-y-3">
							{#each resume.projects as item, i (item.id)}
								<div class="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
									<div class="mb-2.5 flex items-center justify-between gap-2">
										<span
											class="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
										>
											Project {i + 1}
										</span>
										<div class="flex items-center gap-0.5">
											<button
												type="button"
												class={cls.iconBtn}
												title="Move up"
												aria-label="Move project {i + 1} up"
												disabled={i === 0}
												onclick={() => moveItem(resume.projects, item.id, -1)}
											>
												<ArrowUp size={14} />
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Move down"
												aria-label="Move project {i + 1} down"
												disabled={i === resume.projects.length - 1}
												onclick={() => moveItem(resume.projects, item.id, 1)}
											>
												<ArrowDown size={14} />
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Remove"
												aria-label="Remove project {i + 1}"
												onclick={() => removeProject(item.id)}
											>
												<X size={14} />
											</button>
										</div>
									</div>

									<div class="space-y-2.5">
										<div class={cls.grid2}>
											<div>
												<label class={cls.label} for="proj-{item.id}-name">Name</label>
												<input
													id="proj-{item.id}-name"
													type="text"
													class={cls.input}
													placeholder="Open-source CLI tool"
													bind:value={item.name}
												/>
											</div>
											<div>
												<label class={cls.label} for="proj-{item.id}-link">Link</label>
												<input
													id="proj-{item.id}-link"
													type="text"
													class={cls.input}
													placeholder="github.com/you/repo"
													bind:value={item.link}
												/>
											</div>
										</div>
										<div>
											<label class={cls.label} for="proj-{item.id}-bullets">
												Bullet Points <span class="normal-case text-slate-300">(one per line)</span>
											</label>
											<textarea
												id="proj-{item.id}-bullets"
												rows="3"
												class={cls.textarea}
												placeholder="Built X used by Y; reduced Z by 40%"
												bind:value={item.bullets}
											></textarea>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<button type="button" class={cls.btnAdd} onclick={addProject}>
						+ Add project
					</button>
				</section>

				<!-- Certifications (gap 6) -->
				<section class={cls.card}>
					<div class="mb-3 flex items-center justify-between">
						<h2 class="mb-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
							Certifications
						</h2>
						<span class="text-[11px] tabular-nums text-slate-400">
							{resume.certifications.length}
							{resume.certifications.length === 1 ? 'entry' : 'entries'}
						</span>
					</div>

					{#if resume.certifications.length === 0}
						<p class="mb-3 text-xs text-slate-500">No entries yet.</p>
					{:else}
						<div class="mb-3 space-y-3">
							{#each resume.certifications as item, i (item.id)}
								<div class="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
									<div class="mb-2.5 flex items-center justify-between gap-2">
										<span
											class="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
										>
											Cert {i + 1}
										</span>
										<div class="flex items-center gap-0.5">
											<button
												type="button"
												class={cls.iconBtn}
												title="Move up"
												aria-label="Move certification {i + 1} up"
												disabled={i === 0}
												onclick={() => moveItem(resume.certifications, item.id, -1)}
											>
												<ArrowUp size={14} />
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Move down"
												aria-label="Move certification {i + 1} down"
												disabled={i === resume.certifications.length - 1}
												onclick={() => moveItem(resume.certifications, item.id, 1)}
											>
												<ArrowDown size={14} />
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Remove"
												aria-label="Remove certification {i + 1}"
												onclick={() => removeCertification(item.id)}
											>
												<X size={14} />
											</button>
										</div>
									</div>

									<div class="space-y-2.5">
										<div>
											<label class={cls.label} for="cert-{item.id}-name">Name</label>
											<input
												id="cert-{item.id}-name"
												type="text"
												class={cls.input}
												placeholder="AWS Solutions Architect"
												bind:value={item.name}
											/>
										</div>
										<div class={cls.grid2}>
											<div>
												<label class={cls.label} for="cert-{item.id}-issuer">Issuer</label>
												<input
													id="cert-{item.id}-issuer"
													type="text"
													class={cls.input}
													placeholder="Amazon Web Services"
													bind:value={item.issuer}
												/>
											</div>
											<div>
												<label class={cls.label} for="cert-{item.id}-year">Year</label>
												<input
													id="cert-{item.id}-year"
													type="text"
													class={cls.input}
													placeholder="2024"
													bind:value={item.year}
												/>
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<button type="button" class={cls.btnAdd} onclick={addCertification}>
						+ Add certification
					</button>
				</section>

				<!-- Custom sections -->
				<section class={cls.card}>
					<div class="mb-3 flex items-center justify-between">
						<h2 class="mb-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
							Custom sections
						</h2>
						<span class="text-[11px] tabular-nums text-slate-400">
							{resume.customSections.length}
							{resume.customSections.length === 1 ? 'entry' : 'entries'}
						</span>
					</div>
					<p class="mb-3 text-[11px] leading-4 text-slate-500">
						Free-form sections for awards, languages, publications — anything else.
						Line breaks in the body are preserved on the resume.
					</p>

					{#if resume.customSections.length === 0}
						<p class="mb-3 text-xs text-slate-500">No entries yet.</p>
					{:else}
						<div class="mb-3 space-y-3">
							{#each resume.customSections as item, i (item.id)}
								<div class="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
									<div class="mb-2.5 flex items-center justify-between gap-2">
										<span
											class="text-[11px] font-semibold uppercase tracking-wide text-slate-400"
										>
											Section {i + 1}
										</span>
										<div class="flex items-center gap-0.5">
											<button
												type="button"
												class={cls.iconBtn}
												title="Move up"
												aria-label="Move custom section {i + 1} up"
												disabled={i === 0}
												onclick={() => moveItem(resume.customSections, item.id, -1)}
											>
												<ArrowUp size={14} />
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Move down"
												aria-label="Move custom section {i + 1} down"
												disabled={i === resume.customSections.length - 1}
												onclick={() => moveItem(resume.customSections, item.id, 1)}
											>
												<ArrowDown size={14} />
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Remove"
												aria-label="Remove custom section {i + 1}"
												onclick={() => removeCustomSection(item.id)}
											>
												<X size={14} />
											</button>
										</div>
									</div>

									<div class="space-y-2.5">
										<div>
											<label class={cls.label} for="custom-{item.id}-title">Title</label>
											<input
												id="custom-{item.id}-title"
												type="text"
												class={cls.input}
												placeholder="Awards, Languages, Publications…"
												bind:value={item.title}
											/>
										</div>
										<div>
											<label class={cls.label} for="custom-{item.id}-body">Body</label>
											<textarea
												id="custom-{item.id}-body"
												rows="4"
												class={cls.textarea}
												placeholder={'Grace Hopper Award, 2022\nOpen Source Contributor Award, 2020'}
												bind:value={item.body}
											></textarea>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<button type="button" class={cls.btnAdd} onclick={addCustomSection}>
						+ Add custom section
					</button>
				</section>

				<!-- Skills -->
				<section class={cls.card}>
					<div class="mb-3 flex items-center justify-between gap-2">
						<h2 class="mb-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
							Skills
						</h2>
						<div
							class="flex rounded-lg border border-slate-200 p-0.5"
							role="group"
							aria-label="Skills display style"
						>
							<button
								type="button"
								class="rounded-md px-2.5 py-1 text-[11px] font-semibold transition {resume.skillStyle ===
								'line'
									? 'bg-slate-900 text-white'
									: 'text-slate-500 hover:text-slate-800'}"
								aria-pressed={resume.skillStyle === 'line'}
								onclick={() => (resume.skillStyle = 'line')}
							>
								Line
							</button>
							<button
								type="button"
								class="rounded-md px-2.5 py-1 text-[11px] font-semibold transition {resume.skillStyle ===
								'bullets'
									? 'bg-slate-900 text-white'
									: 'text-slate-500 hover:text-slate-800'}"
								aria-pressed={resume.skillStyle === 'bullets'}
								onclick={() => (resume.skillStyle = 'bullets')}
							>
								Bullets
							</button>
						</div>
					</div>
					<div
						class="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-2 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
					>
						{#each resume.skills as skill, i (skill)}
							<span
								class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
							>
								{skill}
								<button
									type="button"
									class="text-slate-400 transition hover:text-rose-600 focus:outline-none"
									aria-label="Remove skill {skill}"
									onclick={() => removeSkill(i)}
								>
									<X size={14} />
								</button>
							</span>
						{/each}
						<input
							type="text"
							class="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-[13px] text-slate-900 placeholder:text-slate-500 focus:outline-none"
							placeholder={resume.skills.length === 0
								? 'Type a skill, press Enter'
								: 'Add another…'}
							bind:value={skillDraft}
							onkeydown={handleSkillKey}
							onblur={commitSkills}
						/>
					</div>
					<p class="mt-2 text-[11px] text-slate-500">
						Press Enter or comma to add. Backspace on empty removes the last tag.
					</p>
				</section>

				<!-- Section order & visibility (gap 7) -->
				<section class={cls.card}>
					<h2 class={cls.sectionTitle}>Sections</h2>
					<p class="mb-2.5 text-[11px] leading-4 text-slate-500">
						Reorder how sections appear on the resume, or hide ones you don’t need.
						Hidden sections keep their data.
					</p>
					<div class="space-y-1.5">
						{#each resume.sectionOrder as id, i (id)}
							<div
								class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5"
							>
								<span
									class="flex-1 truncate text-[12px] font-medium {sectionVisible(id)
										? 'text-slate-700'
										: 'text-slate-400 line-through'}"
								>
									{SECTION_LABELS[id] ?? id}
								</span>
								<button
									type="button"
									class={cls.iconBtn}
									title="Move {SECTION_LABELS[id] ?? id} up"
									aria-label="Move {SECTION_LABELS[id] ?? id} up"
									disabled={i === 0}
									onclick={() => moveSection(i, -1)}
								>
									<ArrowUp size={14} />
								</button>
								<button
									type="button"
									class={cls.iconBtn}
									title="Move {SECTION_LABELS[id] ?? id} down"
									aria-label="Move {SECTION_LABELS[id] ?? id} down"
									disabled={i === resume.sectionOrder.length - 1}
									onclick={() => moveSection(i, 1)}
								>
									<ArrowDown size={14} />
								</button>
								<button
									type="button"
									class="rounded-md px-2 py-1 text-[11px] font-medium transition {sectionVisible(
										id
									)
										? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
										: 'bg-blue-50 text-blue-700 hover:bg-blue-100'}"
									aria-pressed={!sectionVisible(id)}
									onclick={() => toggleSection(id)}
								>
									{sectionVisible(id) ? 'Hide' : 'Show'}
								</button>
							</div>
						{/each}
					</div>
				</section>

				<!-- Job-description keyword check (gap 8) -->
				<section class={cls.card}>
					<h2 class={cls.sectionTitle}>Job description match</h2>
					<label class={cls.label} for="f-jd">Paste a job posting</label>
					<textarea
						id="f-jd"
						rows="5"
						class={cls.textarea}
						placeholder="Paste the job ad here to see which keywords your resume is missing…"
						bind:value={resume.jobDescription}
					></textarea>
					{#if keywordReport}
						<div class="mt-2.5">
							<div class="mb-1.5 flex items-center justify-between">
								<span class="text-[11px] font-medium text-slate-500">
									{keywordReport.matched.length}/{keywordReport.total} keywords matched
								</span>
								<span
									class="text-[11px] font-semibold tabular-nums {keywordReport.pct >= 70
										? 'text-emerald-600'
										: keywordReport.pct >= 40
											? 'text-amber-600'
											: 'text-rose-600'}"
								>
									{keywordReport.pct}%
								</span>
							</div>
							<div
								class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
								role="progressbar"
								aria-valuenow={keywordReport.pct}
								aria-valuemin="0"
								aria-valuemax="100"
								aria-label="Keyword match"
							>
								<div
									class="h-full rounded-full transition-all duration-300 {keywordReport.pct >=
									70
										? 'bg-emerald-500'
										: keywordReport.pct >= 40
											? 'bg-amber-500'
											: 'bg-rose-500'}"
									style="width: {keywordReport.pct}%"
								></div>
							</div>
							{#if keywordReport.missing.length > 0}
								<p class="mt-2.5 text-[11px] font-medium text-slate-500">
									Missing from your resume:
								</p>
								<div class="mt-1.5 flex flex-wrap gap-1.5">
									{#each keywordReport.missing as word (word)}
										<button
											type="button"
											class="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 transition hover:bg-amber-100"
											title="Add “{word}” to your skills"
											onclick={() => {
												const w = word.trim();
												if (w && !resume.skills.includes(w)) resume.skills.push(w);
											}}
										>
											+ {word}
										</button>
									{/each}
								</div>
								<p class="mt-1.5 text-[10.5px] leading-4 text-slate-500">
									Click a keyword to add it to Skills — only if it honestly applies.
								</p>
							{:else}
								<p class="mt-2 text-[11px] text-emerald-600">
									All job-description keywords appear in your resume.
								</p>
							{/if}
						</div>
					{:else if resume.jobDescription.trim().length > 0}
						<p class="mt-2 text-[11px] text-slate-500">
							Keep pasting — need a few meaningful words to compare.
						</p>
					{:else}
					<p class="mt-2 text-[11px] text-slate-500">
						Compares the posting against your summary, experience, skills, and more.
						Client-side only — nothing leaves your browser.
					</p>
					{/if}
				</section>

				<p class="pb-2 text-center text-[11px] text-slate-500">
					Everything stays in your browser — nothing is uploaded.
				</p>
			</div>
		</aside>

		<!-- Preview -->
		<section class="preview-pane flex-1 overflow-auto bg-slate-200/80 p-4 sm:p-8 lg:min-h-0 dark:bg-slate-950">
			<!-- Page-count badge (gap 2) -->
			<div class="no-print mx-auto mb-3 w-fit print:hidden">
				{#if pageCount > 1}
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800"
						role="status"
					>
						<strong class="font-bold">!</strong>
						Content fills {pageCount} pages — trim to fit one page
					</span>
				{:else}
					<span
						class="inline-flex items-center rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-500"
						role="status"
					>
						1 page
					</span>
				{/if}
			</div>
			<div class="mx-auto w-fit">
				<div
					bind:this={pageEl}
					class="resume-page template-{template}"
					style:--paper-w={PAPER[paper].width}
					style:--paper-h={PAPER[paper].height}
					style:--resume-font={FONTS[resume.fontFamily]?.stack ?? FONTS.system.stack}
					style:--resume-size="{resume.fontSize}px"
					style:--resume-margin="{margin}mm"
				style:--accent={accent}
				style:--lh={density === "compact" ? "1.3" : density === "relaxed" ? "1.6" : "1.45"}
				>
					<!-- Header -->
					<header class="border-b-2 border-slate-800 pb-3" class:photo-layout={templateShowsPhoto(template)}>
						{#if showPhoto}
							<img class="resume-photo photo-{photoShape}" src={resume.personal.photo} alt="" />
						{:else if templateShowsPhoto(template)}
							<label class="photo-placeholder photo-{photoShape}" for="f-photo">Add photo</label>
						{/if}
						<div class="photo-meta">
							<h1 class="resume-name">{resume.personal.name.trim() || 'Your Name'}</h1>
							{#if resume.personal.headline.trim()}
								<p
									class="mt-1 text-center text-[0.958em] font-semibold uppercase tracking-[0.12em] text-slate-600"
								>
									{resume.personal.headline}
								</p>
							{/if}
							{#if contacts.length}
								<p
									class="mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center text-[0.875em] leading-[1.35] text-slate-600"
								>
									{#each contacts as contact, i (i)}
										{#if i > 0}
											<span aria-hidden="true" class="text-slate-400">•</span>
										{/if}
										<span class="break-words">{contact}</span>
									{/each}
								</p>
							{/if}
						</div>
					</header>

					<!-- Body sections in user-defined order (gaps 6 + 7) -->
					{#each resume.sectionOrder as id (id)}
						{#if sectionVisible(id)}
							{#if id === 'summary' && resume.personal.summary.trim()}
								<section class="mt-4">
									<h2 class="resume-heading">Summary</h2>
									<p class="whitespace-pre-line text-[1em] leading-[1.55] text-slate-700">
										{resume.personal.summary}
									</p>
								</section>
							{:else if id === 'experience' && resume.experience.length}
								<section class="mt-4">
									<h2 class="resume-heading">Experience</h2>
									<div class="space-y-3">
										{#each resume.experience as job (job.id)}
											<article>
												<div class="flex items-baseline justify-between gap-3">
													<h3 class="text-[1.083em] font-semibold leading-[1.35] text-slate-900">
														{job.role.trim() || 'Role'}
														{#if job.company.trim()}
															<span class="font-normal text-slate-500"> · </span>
															<span class="font-medium text-slate-700">{job.company}</span>
														{/if}
													</h3>
													{#if dateRange(job.startDate, job.endDate)}
														<span
															class="shrink-0 text-[0.875em] tabular-nums text-slate-500"
														>
															{dateRange(job.startDate, job.endDate)}
														</span>
													{/if}
												</div>
												{#if lines(job.bullets).length}
													<ul class="resume-bullets mt-1">
														{#each lines(job.bullets) as bullet (bullet)}
															<li>{bullet}</li>
														{/each}
													</ul>
												{/if}
											</article>
										{/each}
									</div>
								</section>
							{:else if id === 'education' && resume.education.length}
								<section class="mt-4">
									<h2 class="resume-heading">Education</h2>
									<div class="space-y-2">
										{#each resume.education as entry (entry.id)}
											<article class="flex items-baseline justify-between gap-3">
												<div>
													<h3 class="text-[1.083em] font-semibold leading-[1.35] text-slate-900">
														{entry.degree.trim() || 'Degree'}
													</h3>
													{#if entry.institution.trim()}
														<p class="text-[1em] leading-[1.35] text-slate-600">
															{entry.institution}
														</p>
													{/if}
												</div>
												{#if entry.graduationYear.trim()}
													<span class="shrink-0 text-[0.875em] tabular-nums text-slate-500">
														{entry.graduationYear}
													</span>
												{/if}
											</article>
										{/each}
									</div>
								</section>
							{:else if id === 'projects' && resume.projects.length}
								<section class="mt-4">
									<h2 class="resume-heading">Projects</h2>
									<div class="space-y-2.5">
										{#each resume.projects as project (project.id)}
											<article>
												<div class="flex items-baseline justify-between gap-3">
													<h3 class="text-[1.083em] font-semibold leading-[1.35] text-slate-900">
														{project.name.trim() || 'Project'}
														{#if project.link.trim()}
															<span class="font-normal text-slate-500"> · </span>
															<span class="font-medium text-slate-700">{project.link}</span>
														{/if}
													</h3>
												</div>
												{#if lines(project.bullets).length}
													<ul class="resume-bullets mt-1">
														{#each lines(project.bullets) as bullet (bullet)}
															<li>{bullet}</li>
														{/each}
													</ul>
												{/if}
											</article>
										{/each}
									</div>
								</section>
							{:else if id === 'certifications' && resume.certifications.length}
								<section class="mt-4">
									<h2 class="resume-heading">Certifications</h2>
									<div class="space-y-1.5">
										{#each resume.certifications as cert (cert.id)}
											<article class="flex items-baseline justify-between gap-3">
												<div>
													<h3 class="text-[1.042em] font-semibold leading-[1.35] text-slate-900">
														{cert.name.trim() || 'Certification'}
													</h3>
													{#if cert.issuer.trim()}
														<p class="text-[0.958em] leading-[1.35] text-slate-600">
															{cert.issuer}
														</p>
													{/if}
												</div>
												{#if cert.year.trim()}
													<span class="shrink-0 text-[0.875em] tabular-nums text-slate-500">
														{cert.year}
													</span>
												{/if}
											</article>
										{/each}
									</div>
								</section>
							{:else if id === 'custom' && resume.customSections.some((c) => c.title.trim() || c.body.trim())}
								{#each resume.customSections as custom (custom.id)}
									{#if custom.title.trim() || custom.body.trim()}
										<section class="mt-4">
											<h2 class="resume-heading">
												{custom.title.trim() || 'Custom'}
											</h2>
											{#if custom.body.trim()}
												<p class="whitespace-pre-line text-[1em] leading-[1.55] text-slate-700">
													{custom.body}
												</p>
											{/if}
										</section>
									{/if}
								{/each}
							{:else if id === 'skills' && resume.skills.length}
								<section class="mt-4">
									<h2 class="resume-heading">Skills</h2>
									{#if resume.skillStyle === 'bullets'}
										<ul class="resume-bullets">
											{#each resume.skills as skill (skill)}
												<li>{skill}</li>
											{/each}
										</ul>
									{:else}
										<p class="text-[1em] leading-[1.55] text-slate-700">
											{resume.skills.join(' · ')}
										</p>
									{/if}
								</section>
							{/if}
						{/if}
					{/each}
				</div>
			</div>
		</section>
	</div>
</div>

<style>
	/* ── Screen: document chrome ─────────────────────────────────────── */

	/* Template variants */
	.resume-page.template-ats .resume-heading { border-bottom: 1px solid #cbd5e1; color: #0f172a; }
	.resume-page.template-ats header { border-bottom: 1px solid #000; }
	.resume-page.template-sidebar { border-left: 6px solid var(--accent, #1e293b); }
	.resume-page.template-sidebar header {
		background: color-mix(in srgb, var(--accent, #1e293b) 8%, transparent);
		border-bottom-width: 1px;
	}
	.resume-page.template-modern header {
		text-align: left;
		border-bottom: 3px solid var(--accent, #1e293b);
	}
	.resume-page.template-modern .resume-name {
		text-align: left;
		text-transform: none;
		letter-spacing: 0.01em;
		font-size: 2.3em;
		color: var(--accent, #1e293b);
	}
	.resume-page.template-modern header p {
		text-align: left;
		justify-content: flex-start;
		color: #475569;
	}
	.resume-page.template-modern .resume-heading {
		border-bottom: none;
		border-left: 3px solid var(--accent, #1e293b);
		margin-left: -11px;
		padding-left: 8px;
		padding-bottom: 0;
		color: var(--accent, #1e293b);
	}
	.resume-page.template-minimal header { border-bottom: 1px solid #e2e8f0; }
	.resume-page.template-minimal .resume-name {
		text-transform: none;
		font-weight: 600;
		letter-spacing: -0.01em;
		font-size: 1.9em;
		color: #0f172a;
	}
	.resume-page.template-minimal .resume-heading {
		border-bottom: none;
		padding-bottom: 0;
		font-size: 0.8em;
		font-weight: 600;
		letter-spacing: 0.14em;
		color: #475569;
	}
	.resume-page.template-elegant header { border-bottom: 1px solid #94a3b8; }
	.resume-page.template-elegant .resume-name {
		font-family: Georgia, 'Times New Roman', Times, serif;
		text-transform: none;
		font-weight: 600;
		letter-spacing: 0.04em;
		font-size: 2.2em;
		color: #0f172a;
	}
	.resume-page.template-elegant .resume-heading {
		font-family: Georgia, 'Times New Roman', Times, serif;
		text-transform: none;
		font-weight: 600;
		font-size: 1.05em;
		letter-spacing: 0.06em;
		border-bottom: 1px solid #cbd5e1;
		color: var(--accent, #1e293b);
	}
	.resume-page.template-bold header { border-bottom: 4px solid var(--accent, #1e293b); }
	.resume-page.template-bold .resume-name {
		font-weight: 800;
		letter-spacing: 0.02em;
		font-size: 2.4em;
		color: #0f172a;
	}
	.resume-page.template-bold .resume-heading {
		font-weight: 800;
		font-size: 1.02em;
		letter-spacing: 0.1em;
		border-bottom: 3px solid var(--accent, #1e293b);
		color: #0f172a;
	}
	.resume-page.template-mono header {
		text-align: left;
		border-bottom: 1px dashed #94a3b8;
	}
	.resume-page.template-mono .resume-name {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
		text-transform: none;
		letter-spacing: -0.02em;
		font-size: 1.9em;
		color: #0f172a;
		text-align: left;
	}
	.resume-page.template-mono header p {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
		text-align: left;
		justify-content: flex-start;
	}
	.resume-page.template-mono .resume-heading {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
		border-bottom: none;
		padding-bottom: 0;
		font-size: 0.85em;
		letter-spacing: 0.05em;
		color: #0f172a;
	}
	.resume-page.template-mono .resume-heading::before {
		content: '# ';
		color: var(--accent, #1e293b);
	}
	.resume-page.template-photo header.photo-layout {
		display: flex;
		align-items: center;
		gap: 14px;
		text-align: left;
		border-bottom: 3px solid var(--accent, #1e293b);
	}
	.resume-page.template-photo .resume-photo {
		width: 96px;
		height: 96px;
		flex-shrink: 0;
		object-fit: cover;
		border: 3px solid var(--accent, #1e293b);
	}
	.resume-page.template-photo .resume-photo.photo-circle { border-radius: 50%; }
	.resume-page.template-photo .resume-photo.photo-square { border-radius: 0; }
	.resume-page.template-photo .photo-placeholder {
		width: 96px;
		height: 96px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px dashed var(--accent, #1e293b);
		color: #64748b;
		font-size: 11px;
		font-weight: 600;
		line-height: 1.25;
		text-align: center;
		cursor: pointer;
		user-select: none;
	}
	.resume-page.template-photo .photo-placeholder.photo-circle { border-radius: 50%; }
	.resume-page.template-photo .photo-placeholder.photo-square { border-radius: 0; }
	.resume-page.template-photo header.photo-layout .resume-name {
		text-align: left;
		text-transform: none;
		letter-spacing: 0.01em;
		color: #0f172a;
	}
	.resume-page.template-photo header.photo-layout p {
		text-align: left;
		justify-content: flex-start;
	}
	.resume-page.template-executive header { border-bottom: 3px double #0f172a; }
	.resume-page.template-executive .resume-name {
		letter-spacing: 0.14em;
		color: #0f172a;
	}
	.resume-page.template-executive .resume-heading {
		border-bottom: 2px solid #0f172a;
		color: #0f172a;
	}
	.resume-page .resume-heading { color: var(--accent, #1e293b); border-bottom-color: var(--accent, #1e293b); }
	.resume-page header { border-bottom-color: var(--accent, #1e293b); }
	.resume-page {
		box-sizing: border-box;
		width: var(--paper-w, 210mm);
		min-height: var(--paper-h, 297mm);
		margin: 0 auto;
		padding: var(--resume-margin, 14mm);
		background: #ffffff;
		color: #1e293b;
		font-family: var(--resume-font, 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif);
		font-size: var(--resume-size, 12px);
		line-height: var(--lh, 1.45);
		box-shadow:
			0 1px 2px rgb(15 23 42 / 0.06),
			0 12px 32px rgb(15 23 42 / 0.14);
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	.resume-name {
		margin: 0;
		font-family: inherit;
		font-size: 2.083em;
		font-weight: 700;
		letter-spacing: 0.06em;
		line-height: 1.15;
		text-align: center;
		text-transform: uppercase;
		color: #0f172a;
		overflow-wrap: anywhere;
	}

	.resume-heading {
		margin: 0 0 6px;
		padding-bottom: 2px;
		border-bottom: 1px solid #cbd5e1;
		font-family: inherit;
		font-size: 0.958em;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #0f172a;
	}

	.resume-bullets {
		margin: 0;
		padding-left: 16px;
		list-style: disc;
		color: #334155;
		font-size: 0.958em;
		line-height: 1.5;
	}

	.resume-bullets :global(li) {
		margin: 0;
		padding-left: 1px;
		overflow-wrap: anywhere;
	}

	.resume-bullets :global(li + li) {
		margin-top: 1px;
	}

	/* ── Print: hard-lock to the page box ────────────────────────────── */

	@page {
		size: A4;
		margin: 14mm;
	}

	@media print {
		:global(html),
		:global(body) {
			height: auto !important;
			min-height: 0 !important;
			margin: 0 !important;
			padding: 0 !important;
			overflow: visible !important;
			background: #ffffff !important;
		}

		.app-shell,
		.main-shell {
			display: block !important;
			height: auto !important;
			min-height: 0 !important;
			max-height: none !important;
			overflow: visible !important;
			background: #ffffff !important;
		}

		.no-print {
			display: none !important;
		}

		.photo-placeholder {
			display: none !important;
		}

		.preview-pane {
			display: block !important;
			overflow: visible !important;
			margin: 0 !important;
			padding: 0 !important;
			background: #ffffff !important;
		}

		.resume-page {
			width: auto !important;
			min-height: 0 !important;
			margin: 0 !important;
			padding: 0 !important;
			box-shadow: none !important;
			border: none !important;
			background: #ffffff !important;
		}
	}
</style>
