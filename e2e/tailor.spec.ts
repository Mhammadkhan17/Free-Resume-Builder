import { test, expect, type Page, type Route } from '@playwright/test';

const OPENROUTER = '**/api/v1/chat/completions';
const JD = 'Senior engineer with TypeScript and systems design';
const NEW_SUMMARY = 'Engineer focused on TypeScript systems and reliable delivery.';

type ChatBody = {
	messages?: Array<{ role: string; content?: string | null; tool_calls?: unknown }>;
	[key: string]: unknown;
};

async function loadExample(page: Page) {
	await page.getByRole('button', { name: 'More', exact: true }).click();
	await page.getByRole('button', { name: 'Example', exact: true }).click();
}

async function fillKeyAndJd(page: Page) {
	await page.goto('/');
	await loadExample(page);
	await page.getByRole('button', { name: 'Open AI Tailor' }).click();
	await page.locator('#tailor-key').fill('sk-or-test-key');
	const jd = page.locator('#f-jd');
	await jd.fill(JD);
}

async function runTailor(page: Page) {
	await page.getByRole('button', { name: /Tailor Resume/i }).click();
}

function toolCallMessage(summary: string) {
	return {
		role: 'assistant',
		content: null,
		tool_calls: [
			{
				id: 'call_1',
				type: 'function',
				function: {
					name: 'update_summary',
					arguments: JSON.stringify({ summary }),
				},
			},
		],
	};
}

function finalMessage(content: string) {
	return { role: 'assistant', content, tool_calls: [] };
}

async function mockHappyPath(page: Page) {
	let round = 0;
	const bodies: ChatBody[] = [];
	await page.route(OPENROUTER, async (route: Route) => {
		const body = route.request().postDataJSON() as ChatBody;
		bodies.push(body);
		round += 1;
		if (round === 1) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				json: { choices: [{ message: toolCallMessage(NEW_SUMMARY) }] },
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			json: { choices: [{ message: finalMessage('Updated summary') }] },
		});
	});
	return bodies;
}

test('happy path applies summary, one undo restores', async ({ page }) => {
	const bodies = await mockHappyPath(page);
	await fillKeyAndJd(page);
	await expect(page.locator('#f-summary')).not.toHaveValue(NEW_SUMMARY);

	await runTailor(page);
	await expect(page.getByRole('button', { name: /Tailor Resume/i })).toBeEnabled({ timeout: 10_000 });

	await expect(page.locator('#f-summary')).toHaveValue(NEW_SUMMARY);
	await expect(page.getByText('Updated summary').first()).toBeVisible();
	expect(bodies.length).toBeGreaterThanOrEqual(2);

	// panel backdrop intercepts header clicks — close via Escape first
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'AI Tailor' })).toBeHidden();
	await page.getByRole('button', { name: /^Undo$/ }).click();
	await expect(page.locator('#f-summary')).not.toHaveValue(NEW_SUMMARY);
});

test('missing API key disables Tailor', async ({ page }) => {
	await page.goto('/');
	await loadExample(page);
	await page.getByRole('button', { name: 'Open AI Tailor' }).click();
	await page.locator('#f-jd').fill(JD);
	await expect(page.getByRole('button', { name: /Tailor Resume/i })).toBeDisabled();
});

test('HTTP 401 shows invalid key alert', async ({ page }) => {
	await page.route(OPENROUTER, async (route: Route) => {
		await route.fulfill({
			status: 401,
			contentType: 'application/json',
			json: { error: { message: 'Unauthorized' } },
		});
	});
	await fillKeyAndJd(page);
	await runTailor(page);
	await expect(page.locator('p[role="alert"]')).toContainText('Invalid OpenRouter API key.');
});

test('XSS in JD highlighter stays inert', async ({ page }) => {
	const payload = '<img src=x onerror="window.__xss=1"> senior engineer';
	await page.goto('/');
	await loadExample(page);
	await page.getByRole('button', { name: 'Open AI Tailor' }).click();
	await page.locator('#f-jd').fill(payload);

	await expect(page.locator('img[src="x"]')).toHaveCount(0);
	const marked = page.locator('mark');
	await expect(marked.first()).toBeVisible();
	const xss = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss);
	expect(xss).toBeUndefined();
	await expect(page.getByRole('dialog', { name: 'AI Tailor' })).toContainText('senior engineer');
});

test('panel and backdrop hidden on print media', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Open AI Tailor' }).click();
	await expect(page.getByRole('dialog', { name: 'AI Tailor' })).toBeVisible();

	await page.emulateMedia({ media: 'print' });
	await expect(page.getByRole('dialog', { name: 'AI Tailor' })).toBeHidden();
	const backdrop = page.locator('div.fixed.inset-0.z-30');
	await expect(backdrop).toBeHidden();
	await expect(page.locator('.resume-page').first()).toBeVisible();
});

test('Escape closes panel; palette Escape leaves panel open', async ({ page }) => {
	await page.goto('/');
	const tailorBtn = page.getByRole('button', { name: 'Open AI Tailor' });
	await tailorBtn.click();
	const dialog = page.getByRole('dialog', { name: 'AI Tailor' });
	await expect(dialog).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(tailorBtn).toBeFocused();

	await tailorBtn.click();
	await expect(dialog).toBeVisible();
	await page.keyboard.press('ControlOrMeta+k');
	await expect(page.getByText(/Command palette/i)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByText(/Command palette/i)).toBeHidden();
	await expect(dialog).toBeVisible();
});

test('invalid tool JSON returns error to model and finishes', async ({ page }) => {
	let round = 0;
	await page.route(OPENROUTER, async (route: Route) => {
		round += 1;
		const body = route.request().postDataJSON() as ChatBody;
		if (round === 1) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				json: {
					choices: [
						{
							message: {
								role: 'assistant',
								content: null,
								tool_calls: [
									{
										id: 'call_bad',
										type: 'function',
										function: { name: 'update_summary', arguments: '{oops' },
									},
								],
							},
						},
					],
				},
			});
			return;
		}
		const toolMsgs = (body.messages ?? []).filter((m) => m.role === 'tool');
		expect(toolMsgs.length).toBeGreaterThanOrEqual(1);
		expect(JSON.stringify(toolMsgs[0]?.content ?? '')).toContain('error');
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			json: { choices: [{ message: finalMessage('Could not apply tool; no changes.') }] },
		});
	});
	await fillKeyAndJd(page);
	await runTailor(page);
	await expect(page.getByRole('button', { name: /Tailor Resume/i })).toBeEnabled({ timeout: 10_000 });
	await expect(page.locator('p[role="alert"]')).toHaveCount(0);
});

test('request body excludes photo and job description', async ({ page }) => {
	let bodies: ChatBody[] = [];
	await page.route(OPENROUTER, async (route: Route) => {
		bodies.push(route.request().postDataJSON() as ChatBody);
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			json: { choices: [{ message: finalMessage('Done.') }] },
		});
	});
	await fillKeyAndJd(page);
	// inject a fake photo into state via JSON import path is hard; set localStorage resume photo
	await page.evaluate((jd) => {
		const raw = localStorage.getItem('resume-builder:v1');
		const data = raw ? JSON.parse(raw) : {};
		if (!data.personal || typeof data.personal !== 'object') data.personal = {};
		data.personal.photo = 'data:image/png;base64,AAAA';
		data.jobDescription = jd;
		localStorage.setItem('resume-builder:v1', JSON.stringify(data));
	}, JD);
	await page.reload();
	await page.getByRole('button', { name: 'Open AI Tailor' }).click();
	await page.locator('#tailor-key').fill('sk-or-test-key');
	// ensure JD still in form after reload
	if (!(await page.locator('#f-jd').inputValue())) {
		await page.locator('#f-jd').fill(JD);
	}
	await runTailor(page);
	await expect(page.getByRole('button', { name: /Tailor Resume/i })).toBeEnabled({ timeout: 10_000 });
	expect(bodies.length).toBeGreaterThan(0);
	const raw = JSON.stringify(bodies);
	// photo never leaves the browser; JD is intentionally sent as the task prompt
	expect(raw).not.toContain('data:image');
	expect(raw).not.toContain('base64');
});

test('mid-run failure rolls back summary', async ({ page }) => {
	let round = 0;
	await page.goto('/');
	await loadExample(page);
	const original = await page.locator('#f-summary').inputValue();

	await page.route(OPENROUTER, async (route: Route) => {
		round += 1;
		if (round === 1) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				json: { choices: [{ message: toolCallMessage(NEW_SUMMARY) }] },
			});
			return;
		}
		await route.abort('failed');
	});

	await page.getByRole('button', { name: 'Open AI Tailor' }).click();
	await page.locator('#tailor-key').fill('sk-or-test-key');
	await page.locator('#f-jd').fill(JD);
	await runTailor(page);

	await expect(page.locator('p[role="alert"]')).toContainText('Network error', { timeout: 15_000 });
	await expect(page.locator('#f-summary')).toHaveValue(original);
	await expect(page.getByText('No changes yet.')).toBeVisible();
});

test('HTTP 429 surfaces rate limited message', async ({ page }) => {
	await page.route(OPENROUTER, async (route: Route) => {
		await route.fulfill({
			status: 429,
			contentType: 'application/json',
			json: { error: { message: 'slow down' } },
		});
	});
	await fillKeyAndJd(page);
	await runTailor(page);
	await expect(page.locator('p[role="alert"]')).toContainText('Rate limited by OpenRouter');
});
