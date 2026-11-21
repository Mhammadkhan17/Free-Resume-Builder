import { browser } from '$app/env';

const KEY = 'frb_tailor_state_v1';

type Persisted = {
	apiKey: string;
	model: string;
	masterBank: string[];
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
				? parsed.masterBank.filter((x: unknown): x is string => typeof x === 'string')
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

if (browser) {
	$effect.root(() => {
		$effect(() => {
			const { apiKey, model, masterBank } = tailor;
			try {
				localStorage.setItem(KEY, JSON.stringify({ apiKey, model, masterBank }));
			} catch {
				/* quota / private mode — ignore */
			}
		});
	});
}
