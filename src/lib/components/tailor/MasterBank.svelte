<script lang="ts">
	import { tailor } from '#lib/stores/tailor.svelte';
	import { X, Plus } from 'lucide-svelte';

	let draft = $state('');

	function add() {
		const t = draft.trim();
		if (!t) return;
		if (!tailor.masterBank.includes(t)) {
			tailor.masterBank = [...tailor.masterBank, t];
		}
		draft = '';
	}

	function remove(phrase: string) {
		tailor.masterBank = tailor.masterBank.filter((p: string) => p !== phrase);
	}
</script>

<details class="group">
	<summary class="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
		Master bank ({tailor.masterBank.length})
	</summary>
	<div class="mt-2 space-y-2">
		<form
			class="flex gap-1.5"
			onsubmit={(e) => {
				e.preventDefault();
				add();
			}}
		>
			<input
				type="text"
				class="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
				placeholder="Reusable phrase…"
				bind:value={draft}
				aria-label="Add master bank phrase"
			/>
			<button
				type="submit"
				class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
				aria-label="Add phrase"
			>
				<Plus size={14} />
			</button>
		</form>
		{#if tailor.masterBank.length === 0}
			<p class="text-[11px] text-slate-400">Phrases the model may reuse when tailoring.</p>
		{:else}
			<ul class="space-y-1">
				{#each tailor.masterBank as phrase (phrase)}
					<li class="flex items-start gap-1.5 rounded-md bg-slate-50 px-2 py-1.5 dark:bg-slate-800/60">
						<span class="flex-1 text-xs leading-4 text-slate-700 dark:text-slate-300">{phrase}</span>
						<button
							type="button"
							class="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
							aria-label="Remove phrase"
							onclick={() => remove(phrase)}
						>
							<X size={12} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</details>
