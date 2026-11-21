import type { ChatMessage, ToolDef } from './openrouter';

/** Minimal structural types — +page.svelte owns the full Resume JSDoc. */
type ResumeLike = {
	personal: {
		name: string;
		headline: string;
		location: string;
		summary: string;
		photo?: string;
	};
	experience: Array<{ bullets: string; [k: string]: unknown }>;
	education: unknown[];
	projects: unknown[];
	certifications: unknown[];
	customSections: unknown[];
	skills: string[];
	jobDescription?: string;
	fontFamily?: string;
	fontSize?: number;
	sectionOrder?: string[];
	hiddenSections?: string[];
	skillStyle?: string;
};

export const TOOLS: ToolDef[] = [
	{
		type: 'function',
		function: {
			name: 'update_summary',
			description:
				'Replace the professional summary with a version tailored to the job description.',
			parameters: {
				type: 'object',
				properties: {
					summary: {
						type: 'string',
						description:
							'New summary, 2–4 sentences, resume style, no first person, no emojis, no markdown.',
					},
				},
				required: ['summary'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'update_skills',
			description:
				'Replace the skills list with one prioritized for the job description. Keep truthful skills only.',
			parameters: {
				type: 'object',
				properties: {
					skills: {
						type: 'array',
						items: { type: 'string' },
						description: 'Ordered skills; JD-relevant ones first.',
					},
				},
				required: ['skills'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'update_experience_bullets',
			description:
				'Rewrite the bullets of one experience entry to emphasize JD-relevant achievements. Preserve truth: no invented employers, titles, dates, or metrics.',
			parameters: {
				type: 'object',
				properties: {
					experience_index: {
						type: 'integer',
						minimum: 0,
						description: '0-based index into experience[]',
					},
					bullets: {
						type: 'array',
						items: { type: 'string' },
						description: 'Full replacement bullet list (not a diff).',
					},
				},
				required: ['experience_index', 'bullets'],
			},
		},
	},
];

export const SYSTEM_PROMPT = `You tailor an existing resume to a job description using only the provided tools.
In scope: professional summary, skills, experience bullets only. Do not try to change headline, education, projects, certifications, dates, employers, or contact info — you have no tools for them.
Rules: never invent employers, titles, dates, locations, degrees, or metrics; every claim must be defensible from the original resume; prefer JD keywords only where the candidate genuinely has the skill; concise resume style (no first person, no emojis, no markdown); batch multiple tool calls in one response when possible; call update_summary / update_skills when it improves JD alignment; call update_experience_bullets for each experience entry whose bullets should change; when done, reply with a short plain-text changelog and make no further tool calls.`;

/** Compact prompt payload — never send photo base64, JD, or style fields. */
export function resumeProjection(resume: ResumeLike) {
	return {
		personal: {
			name: resume.personal.name,
			headline: resume.personal.headline,
			location: resume.personal.location,
			summary: resume.personal.summary,
		},
		experience: resume.experience,
		education: resume.education,
		projects: resume.projects,
		certifications: resume.certifications,
		customSections: resume.customSections,
		skills: resume.skills,
	};
}

export function buildUserMessage(
	projection: unknown,
	jobDescription: string,
	masterBank: string[],
): string {
	const parts = [
		'## Current resume (JSON)',
		JSON.stringify(projection, null, 2),
		'## Job description',
		jobDescription.trim(),
	];
	if (masterBank.length > 0) {
		parts.push('## Reusable phrases (optional)', masterBank.map((p) => `- ${p}`).join('\n'));
	}
	parts.push('Tailor the resume to the job description using the provided tools.');
	return parts.join('\n\n');
}

/**
 * Factory: closes over resume so the loop signature stays (name, args) => string.
 * `onApply` feeds tailor.changeLog (and thus LoopResult.applied via handleTailor).
 */
export function createApplyTool(
	resume: ResumeLike,
	onApply: (line: string) => void,
): (name: string, args: unknown) => string {
	return (name: string, args: unknown) => {
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
			if (
				typeof i !== 'number' ||
				!Number.isInteger(i) ||
				i < 0 ||
				i >= resume.experience.length
			) {
				throw new Error('experience_index out of range');
			}
			if (!Array.isArray(a.bullets) || !a.bullets.every((b) => typeof b === 'string')) {
				throw new Error('bullets must be an array of strings');
			}
			const list = a.bullets as string[];
			resume.experience[i].bullets = list.join('\n');
			const first = list[0] ?? '';
			onApply(`Rewrote bullets for experience #${i} — “${first.slice(0, 60)}”`);
			return JSON.stringify({ ok: true });
		}
		throw new Error(`Unknown tool: ${name}`);
	};
}

/** Merge loop results into display lines (already-applied lines live in changeLog). */
export function composeChangeLog(
	existing: string[],
	result: { finished: boolean; rounds: number; finalContent: string },
): string[] {
	const lines = [...existing];
	if (result.finalContent.trim()) {
		for (const raw of result.finalContent.split('\n')) {
			const line = raw.trim();
			if (line) lines.push(line);
		}
	}
	if (!result.finished) {
		lines.push(`Stopped after ${result.rounds} rounds (limit).`);
	}
	if (lines.length === 0) lines.push('No changes.');
	return lines;
}

// Re-export for callers that only need the type alongside tools.
export type { ChatMessage };
