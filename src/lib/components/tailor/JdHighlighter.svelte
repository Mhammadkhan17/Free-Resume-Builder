<script lang="ts">
	import { keywords } from '#lib/keywords';

	let {
		jobDescription = '',
		resumeText = '',
	}: {
		jobDescription?: string;
		resumeText?: string;
	} = $props();

	function escapeHtml(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function escapeRegExp(s: string): string {
		return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	const report = $derived.by(() => {
		const jdTokens = keywords(jobDescription);
		const hay = keywords(resumeText);
		if (jdTokens.size === 0 || !jobDescription.trim()) {
			return { html: escapeHtml(jobDescription), present: 0, missing: 0, total: 0 };
		}

		const present = [...jdTokens].filter((t) => hay.has(t)).length;
		const missing = [...jdTokens].filter((t) => !hay.has(t)).length;

		// Rebuild from original text: escape every slice, wrap token matches.
		const tokenList = [...jdTokens].sort((a, b) => b.length - a.length);
		const globalRe = new RegExp(
			`(?<![a-z0-9+#.])(${tokenList.map(escapeRegExp).join('|')})(?![a-z0-9+#.])`,
			'gi',
		);
		let out = '';
		let last = 0;
		let m: RegExpExecArray | null;
		while ((m = globalRe.exec(jobDescription)) !== null) {
			out += escapeHtml(jobDescription.slice(last, m.index));
			const isPresent = hay.has(m[0].toLowerCase());
			const cls = isPresent ? 'tailor-mark-present' : 'tailor-mark-missing';
			out += `<mark class="${cls}">${escapeHtml(m[0])}</mark>`;
			last = m.index + m[0].length;
			if (m[0].length === 0) globalRe.lastIndex++;
		}
		out += escapeHtml(jobDescription.slice(last));

		return { html: out, present, missing, total: jdTokens.size };
	});
</script>

<div class="flex flex-col gap-2">
	<div class="flex flex-wrap items-center gap-2 text-[11px]">
		<span class="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">JD match</span>
		{#if report.total > 0}
			<span class="inline-flex items-center gap-1">
				<span class="inline-block h-2 w-2 rounded-full bg-emerald-500/80"></span>
				{report.present} present
			</span>
			<span class="inline-flex items-center gap-1">
				<span class="inline-block h-2 w-2 rounded-full bg-amber-500/80"></span>
				{report.missing} missing
			</span>
		{:else}
			<span class="text-slate-400">Paste a job description in the JD section</span>
		{/if}
	</div>
	{#if jobDescription.trim()}
		<div
			class="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
		>
			{@html report.html}
		</div>
	{/if}
</div>

<style>
	:global(.tailor-mark-present) {
		background-color: color-mix(in srgb, #34d399 35%, transparent);
		border-radius: 2px;
		padding: 0 1px;
	}
	:global(.tailor-mark-missing) {
		background-color: color-mix(in srgb, #fbbf24 40%, transparent);
		border-radius: 2px;
		padding: 0 1px;
	}
	:global(.dark .tailor-mark-present) {
		background-color: color-mix(in srgb, #059669 45%, transparent);
	}
	:global(.dark .tailor-mark-missing) {
		background-color: color-mix(in srgb, #d97706 45%, transparent);
	}
</style>
