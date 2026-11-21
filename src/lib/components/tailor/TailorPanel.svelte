<script lang="ts">
	import { fly } from 'svelte/transition';
	import { X, WandSparkles, CheckCircle2 } from 'lucide-svelte';
	import { tailor } from '#lib/stores/tailor.svelte';
	import JdHighlighter from './JdHighlighter.svelte';
	import TailorControls from './TailorControls.svelte';

	let {
		resume,
		jobDescription = '',
		onTailor,
		close,
	}: {
		resume: Record<string, unknown>;
		jobDescription?: string;
		onTailor: () => void;
		close: () => void;
	} = $props();

	function resumeText(r: Record<string, unknown>): string {
		try {
			const p = (r.personal ?? {}) as Record<string, unknown>;
			const exp = Array.isArray(r.experience) ? r.experience : [];
			const skills = Array.isArray(r.skills) ? r.skills : [];
			const parts = [
				String(p.name ?? ''),
				String(p.headline ?? ''),
				String(p.summary ?? ''),
				exp.map((e) => {
					const x = e as Record<string, unknown>;
					return `${x.role ?? ''} ${x.company ?? ''} ${x.bullets ?? ''}`;
				}).join(' '),
				skills.join(' '),
			];
			return parts.join(' ');
		} catch {
			return '';
		}
	}
</script>

{#if tailor.panelOpen}
	<div
		class="fixed inset-0 z-30 bg-black/30 print:hidden"
		role="presentation"
		onclick={close}
	></div>
	<div
		class="fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-slate-200 bg-white shadow-2xl print:hidden dark:border-slate-800 dark:bg-slate-900"
		transition:fly={{ x: 40, duration: 200 }}
		role="dialog"
		aria-modal="false"
		aria-label="AI Tailor"
	>
		<header class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
			<div class="flex items-center gap-2">
				<WandSparkles size={16} class="text-blue-600 dark:text-blue-400" />
				<h2 class="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Tailor</h2>
			</div>
			<button
				type="button"
				class="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
				aria-label="Close AI Tailor"
				onclick={close}
			>
				<X size={16} />
			</button>
		</header>

		<div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
			<JdHighlighter {jobDescription} resumeText={resumeText(resume)} />

			<TailorControls {jobDescription} {onTailor} />

			<section>
				<h3 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
					Change log
				</h3>
				{#if tailor.changeLog.length === 0}
					<p class="text-xs text-slate-400">No changes yet.</p>
				{:else}
					<ul aria-live="polite" class="space-y-1.5">
						{#each tailor.changeLog as line, i (i)}
							<li class="flex items-start gap-1.5 text-xs leading-4 text-slate-700 dark:text-slate-300">
								<CheckCircle2 size={12} class="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
								<span>{line}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>

		<footer class="space-y-1 border-t border-slate-200 px-4 py-3 text-[11px] leading-4 text-slate-500 dark:border-slate-800 dark:text-slate-400">
			<p>Changes are local. One ⌘Z undoes the whole run.</p>
			<p>Your resume text and job description are sent to OpenRouter only when you press Tailor. Your API key stays in this browser’s localStorage.</p>
			<p>Avoid editing the resume while tailoring.</p>
		</footer>
	</div>
{/if}
