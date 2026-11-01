<script>
	/**
	 * Local-first Resume Builder
	 * Single-file Svelte 5 component. Zero external runtime dependencies.
	 * State lives in memory, mirrors to localStorage on every mutation,
	 * and exports a print-accurate PDF via native CSS @media print rules.
	 */

	/**
	 * @typedef {Object} PersonalInfo
	 * @property {string} name
	 * @property {string} email
	 * @property {string} phone
	 * @property {string} website
	 * @property {string} linkedin
	 * @property {string} summary
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
	 * @typedef {Object} Resume
	 * @property {PersonalInfo} personal
	 * @property {ExperienceEntry[]} experience
	 * @property {EducationEntry[]} education
	 * @property {string[]} skills
	 */

	/**
	 * @typedef {'a4' | 'letter'} PaperSize
	 */

	const STORAGE_KEY = 'resume-builder:v1';

	/** @type {Record<PaperSize, { label: string; width: string; height: string; size: string }>} */
	const PAPER = {
		a4: { label: 'A4', width: '210mm', height: '297mm', size: 'A4' },
		letter: { label: 'Letter', width: '215.9mm', height: '279.4mm', size: 'Letter' }
	};

	const BULLET_PLACEHOLDER = 'Led platform migration, cut p95 latency 40%\nMentored 4 engineers across 2 squads';

	const cls = {
		label:
			'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500',
		input:
			'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5 text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
		textarea:
			'w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5 text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
		btnSecondary:
			'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30',
		btnPrimary:
			'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-1',
		btnGhost:
			'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30',
		btnAdd:
			'inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30',
		iconBtn:
			'inline-flex h-6 w-6 items-center justify-center rounded-md text-[13px] leading-none text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:pointer-events-none disabled:opacity-30',
		card: 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
		sectionTitle:
			'mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400',
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
			personal: { name: '', email: '', phone: '', website: '', linkedin: '', summary: '' },
			experience: [],
			education: [],
			skills: []
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
			email: asText(p.email),
			phone: asText(p.phone),
			website: asText(p.website),
			linkedin: asText(p.linkedin),
			summary: asText(p.summary)
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

		if (Array.isArray(source.skills)) {
			base.skills = source.skills
				.map((s) => asText(s).trim())
				.filter((s) => s.length > 0)
				.filter((s, i, arr) => arr.indexOf(s) === i);
		}

		return base;
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
	let skillDraft = $state('');
	let notice = $state(/** @type {{ text: string; tone: 'ok' | 'bad' }} */ ({ text: '', tone: 'ok' }));
	/** @type {ReturnType<typeof setTimeout> | null} */
	let noticeTimer = null;
	let fileInput = $state(/** @type {HTMLInputElement | null} */ (null));

	// Hydration-safe autosave: first pass rehydrates from localStorage without
	// writing; every subsequent mutation serializes the whole document.
	let started = false;
	$effect(() => {
		const payload = JSON.stringify(resume);
		if (!started) {
			started = true;
			const stored = loadStored();
			if (stored) resume = stored;
			return;
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
		el.textContent = `@media print { @page { size: ${PAPER[paper].size}; margin: 14mm; } }`;
	});

	const contacts = $derived(
		[
			resume.personal.email,
			resume.personal.phone,
			resume.personal.website,
			resume.personal.linkedin
		]
			.map((v) => asText(v).trim())
			.filter(Boolean)
	);

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
			const text = await file.text();
			const data = JSON.parse(text);
			if (!data || typeof data !== 'object' || Array.isArray(data)) {
				throw new Error('invalid-shape');
			}
			resume = normalize(data);
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

	function printResume() {
		const onAfterPrint = () => {
			window.removeEventListener('afterprint', onAfterPrint);
			flash(
				'Clean PDF: in the print dialog open “More settings” and uncheck “Headers and footers” (Chrome remembers).',
				'ok',
				7000
			);
		};
		window.addEventListener('afterprint', onAfterPrint);
		window.print();
	}
</script>

<svelte:head>
	<title>Resume Builder</title>
	<meta name="description" content="Local-first resume builder with live preview and print-to-PDF." />
</svelte:head>

<div
	class="app-shell flex min-h-screen flex-col bg-slate-100 text-slate-900 antialiased lg:h-screen lg:min-h-0 lg:overflow-hidden"
>
	<!-- ── Toolbar ─────────────────────────────────────────────────────── -->
	<header class="no-print border-b border-slate-200 bg-white print:hidden">
		<div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
			<div class="mr-auto flex items-baseline gap-2.5">
				<h1 class="text-sm font-semibold tracking-tight text-slate-900">Resume Builder</h1>
				<span class="hidden text-[11px] text-slate-400 sm:inline">local-first · autosaved</span>
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

			<input
				bind:this={fileInput}
				type="file"
				accept="application/json,.json"
				class="hidden"
				onchange={handleImport}
			/>
			<button type="button" class={cls.btnSecondary} onclick={() => fileInput?.click()}>
				Import JSON
			</button>
			<button type="button" class={cls.btnSecondary} onclick={exportJSON}>Export JSON</button>
			<button type="button" class={cls.btnGhost} onclick={resetResume}>Reset</button>
			<button
				type="button"
				class={cls.btnPrimary}
				onclick={printResume}
				title="For a clean PDF: uncheck “Headers and footers” under More settings in the print dialog"
			>
				Print / Save PDF
			</button>
		</div>
	</header>

	<!-- ── Split pane ──────────────────────────────────────────────────── -->
	<div class="main-shell flex flex-1 flex-col lg:min-h-0 lg:flex-row">
		<!-- Editor -->
		<aside
			class="no-print w-full shrink-0 border-b border-slate-200 bg-white lg:w-[440px] lg:overflow-y-auto lg:border-b-0 lg:border-r print:hidden"
		>
			<div class="space-y-5 p-4 sm:p-6">
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
								<label class={cls.label} for="f-website">Website</label>
								<input
									id="f-website"
									type="url"
									class={cls.input}
									placeholder="https://ada.dev"
									bind:value={resume.personal.website}
								/>
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
						<p class="mb-3 text-xs text-slate-400">No entries yet.</p>
					{:else}
						<div class="mb-3 space-y-3">
							{#each resume.experience as item, i (item.id)}
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
												↑
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Move down"
												aria-label="Move role {i + 1} down"
												disabled={i === resume.experience.length - 1}
												onclick={() => moveItem(resume.experience, item.id, 1)}
											>
												↓
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Remove"
												aria-label="Remove role {i + 1}"
												onclick={() => removeExperience(item.id)}
											>
												✕
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
						<p class="mb-3 text-xs text-slate-400">No entries yet.</p>
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
												↑
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Move down"
												aria-label="Move school {i + 1} down"
												disabled={i === resume.education.length - 1}
												onclick={() => moveItem(resume.education, item.id, 1)}
											>
												↓
											</button>
											<button
												type="button"
												class={cls.iconBtn}
												title="Remove"
												aria-label="Remove school {i + 1}"
												onclick={() => removeEducation(item.id)}
											>
												✕
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

				<!-- Skills -->
				<section class={cls.card}>
					<h2 class={cls.sectionTitle}>Skills</h2>
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
									✕
								</button>
							</span>
						{/each}
						<input
							type="text"
							class="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
							placeholder={resume.skills.length === 0
								? 'Type a skill, press Enter'
								: 'Add another…'}
							bind:value={skillDraft}
							onkeydown={handleSkillKey}
							onblur={commitSkills}
						/>
					</div>
					<p class="mt-2 text-[11px] text-slate-400">
						Press Enter or comma to add. Backspace on empty removes the last tag.
					</p>
				</section>

				<p class="pb-2 text-center text-[11px] text-slate-400">
					Everything stays in your browser — nothing is uploaded.<br />
					For a clean PDF (Chrome/Edge): uncheck “Headers and footers” under More settings in
					the print dialog.
				</p>
			</div>
		</aside>

		<!-- Preview -->
		<section class="preview-pane flex-1 overflow-auto bg-slate-200/80 p-4 sm:p-8 lg:min-h-0">
			<div class="mx-auto w-fit">
				<div
					class="resume-page"
					style:--paper-w={PAPER[paper].width}
					style:--paper-h={PAPER[paper].height}
				>
					<!-- Header -->
					<header class="border-b-2 border-slate-800 pb-3">
						<h1 class="resume-name">{resume.personal.name.trim() || 'Your Name'}</h1>
						{#if contacts.length}
							<p
								class="mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center text-[10.5px] leading-4 text-slate-600"
							>
								{#each contacts as contact, i (i)}
									{#if i > 0}
										<span aria-hidden="true" class="text-slate-400">•</span>
									{/if}
									<span class="break-words">{contact}</span>
								{/each}
							</p>
						{/if}
					</header>

					<!-- Summary -->
					{#if resume.personal.summary.trim()}
						<section class="mt-4">
							<h2 class="resume-heading">Summary</h2>
							<p class="whitespace-pre-line text-[12px] leading-[1.55] text-slate-700">
								{resume.personal.summary}
							</p>
						</section>
					{/if}

					<!-- Experience -->
					{#if resume.experience.length}
						<section class="mt-4">
							<h2 class="resume-heading">Experience</h2>
							<div class="space-y-3">
								{#each resume.experience as job (job.id)}
									<article>
										<div class="flex items-baseline justify-between gap-3">
											<h3 class="text-[13px] font-semibold leading-4 text-slate-900">
												{job.role.trim() || 'Role'}
												{#if job.company.trim()}
													<span class="font-normal text-slate-500"> · </span>
													<span class="font-medium text-slate-700">{job.company}</span>
												{/if}
											</h3>
											{#if dateRange(job.startDate, job.endDate)}
												<span
													class="shrink-0 text-[10.5px] tabular-nums text-slate-500"
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
					{/if}

					<!-- Education -->
					{#if resume.education.length}
						<section class="mt-4">
							<h2 class="resume-heading">Education</h2>
							<div class="space-y-2">
								{#each resume.education as entry (entry.id)}
									<article class="flex items-baseline justify-between gap-3">
										<div>
											<h3 class="text-[13px] font-semibold leading-4 text-slate-900">
												{entry.degree.trim() || 'Degree'}
											</h3>
											{#if entry.institution.trim()}
												<p class="text-[12px] leading-4 text-slate-600">
													{entry.institution}
												</p>
											{/if}
										</div>
										{#if entry.graduationYear.trim()}
											<span class="shrink-0 text-[10.5px] tabular-nums text-slate-500">
												{entry.graduationYear}
											</span>
										{/if}
									</article>
								{/each}
							</div>
						</section>
					{/if}

					<!-- Skills -->
					{#if resume.skills.length}
						<section class="mt-4">
							<h2 class="resume-heading">Skills</h2>
							<p class="text-[12px] leading-[1.55] text-slate-700">
								{resume.skills.join(' · ')}
							</p>
						</section>
					{/if}
				</div>
			</div>
		</section>
	</div>
</div>

<style>
	/* ── Screen: document chrome ─────────────────────────────────────── */

	.resume-page {
		box-sizing: border-box;
		width: var(--paper-w, 210mm);
		min-height: var(--paper-h, 297mm);
		margin: 0 auto;
		padding: 14mm;
		background: #ffffff;
		color: #1e293b;
		font-family:
			'Inter',
			ui-sans-serif,
			system-ui,
			-apple-system,
			'Segoe UI',
			Roboto,
			'Helvetica Neue',
			Arial,
			sans-serif;
		font-size: 12px;
		line-height: 1.45;
		box-shadow:
			0 1px 2px rgb(15 23 42 / 0.06),
			0 12px 32px rgb(15 23 42 / 0.14);
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	.resume-name {
		margin: 0;
		font-family: Georgia, 'Times New Roman', Times, serif;
		font-size: 25px;
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
		font-family: Georgia, 'Times New Roman', Times, serif;
		font-size: 11.5px;
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
		font-size: 11.5px;
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
