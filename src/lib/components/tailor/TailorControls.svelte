<script lang="ts">
	import { tailor } from '#lib/stores/tailor.svelte';
	import { Loader2, WandSparkles } from 'lucide-svelte';
	import MasterBank from './MasterBank.svelte';

	let {
		jobDescription = '',
		onTailor,
	}: {
		jobDescription?: string;
		onTailor: () => void;
	} = $props();

	const canRun = $derived(
		!tailor.isTailoring && !!tailor.apiKey.trim() && !!jobDescription.trim(),
	);

	const MODEL_HINTS = [
		'google/gemini-2.5-flash',
		'openai/gpt-4o-mini',
		'anthropic/claude-3.5-haiku',
	];
</script>

<div class="space-y-3">
	<div>
		<label class="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400" for="tailor-key">
			OpenRouter API key
		</label>
		<input
			id="tailor-key"
			type="password"
			autocomplete="off"
			spellcheck="false"
			class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
			placeholder="sk-or-…"
			bind:value={tailor.apiKey}
		/>
	</div>

	<div>
		<label class="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400" for="tailor-model">
			Model
		</label>
		<input
			id="tailor-model"
			type="text"
			list="tailor-models"
			class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
			bind:value={tailor.model}
		/>
		<datalist id="tailor-models">
			{#each MODEL_HINTS as m (m)}
				<option value={m}></option>
			{/each}
		</datalist>
	</div>

	<MasterBank />

	<button
		type="button"
		class="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 dark:focus:ring-offset-slate-900"
		disabled={!canRun}
		onclick={onTailor}
	>
		{#if tailor.isTailoring}
			<Loader2 size={14} class="animate-spin" />
			Tailoring…
		{:else}
			<WandSparkles size={14} />
			Tailor Resume
		{/if}
	</button>

	{#if tailor.tailorError}
		<p role="alert" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
			{tailor.tailorError}
		</p>
	{/if}
</div>
