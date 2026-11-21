export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const MAX_ROUNDS = 10;

export type ToolCall = {
	id: string;
	type: 'function';
	function: { name: string; arguments: string };
};

export type ChatMessage =
	| { role: 'system' | 'user'; content: string }
	| { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
	| { role: 'tool'; tool_call_id: string; content: string };

export type ToolDef = {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: {
			type: 'object';
			properties: Record<string, unknown>;
			required?: string[];
		};
	};
};

export type LoopResult = {
	rounds: number;
	finished: boolean;
	finalContent: string;
};

export async function chatOnce(opts: {
	apiKey: string;
	model: string;
	messages: ChatMessage[];
	tools: ToolDef[];
}): Promise<ChatMessage> {
	let res: Response;
	try {
		res = await fetch(OPENROUTER_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${opts.apiKey}`,
				'Content-Type': 'application/json',
				'X-Title': 'Free Resume Builder',
			},
			body: JSON.stringify({
				model: opts.model,
				messages: opts.messages,
				tools: opts.tools,
				tool_choice: 'auto',
				temperature: 0.3,
			}),
		});
	} catch {
		throw new Error('Network error — check your connection.');
	}
	if (!res.ok) {
		let detail = `${res.status}`;
		try {
			const body = await res.json();
			detail = body?.error?.message ?? body?.message ?? detail;
		} catch {
			/* keep status */
		}
		if (res.status === 401 || res.status === 403) {
			throw new Error('Invalid OpenRouter API key.');
		}
		if (res.status === 429) {
			throw new Error(`Rate limited by OpenRouter: ${detail}`);
		}
		throw new Error(`OpenRouter error: ${detail}`);
	}
	const body = await res.json();
	const msg = body?.choices?.[0]?.message;
	if (!msg) throw new Error('OpenRouter returned an empty response.');
	return msg as ChatMessage;
}

/**
 * Agentic tool loop. Successful tool applications are reported through
 * `applyTool`'s side channel (createApplyTool → onApply → tailor.changeLog);
 * this function only returns loop metadata + final assistant prose.
 */
export async function runTailorLoop(opts: {
	apiKey: string;
	model: string;
	system: string;
	user: string;
	tools: ToolDef[];
	applyTool: (name: string, args: unknown) => string;
}): Promise<LoopResult> {
	const messages: ChatMessage[] = [
		{ role: 'system', content: opts.system },
		{ role: 'user', content: opts.user },
	];

	for (let round = 0; round < MAX_ROUNDS; round++) {
		const assistant = await chatOnce({
			apiKey: opts.apiKey,
			model: opts.model,
			messages,
			tools: opts.tools,
		});
		messages.push(assistant);
		const calls =
			assistant.role === 'assistant' && Array.isArray(assistant.tool_calls)
				? assistant.tool_calls
				: [];

		if (calls.length === 0) {
			const finalContent = typeof assistant.content === 'string' ? assistant.content : '';
			return { rounds: round + 1, finished: true, finalContent };
		}

		for (const call of calls) {
			let result: string;
			try {
				const args = JSON.parse(call.function.arguments);
				result = opts.applyTool(call.function.name, args);
			} catch (err) {
				result = JSON.stringify({
					error: err instanceof Error ? err.message : String(err),
				});
			}
			messages.push({ role: 'tool', tool_call_id: call.id, content: result });
		}
	}
	return { rounds: MAX_ROUNDS, finished: false, finalContent: '' };
}
