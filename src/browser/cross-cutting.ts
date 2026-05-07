import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Browser, Page } from "puppeteer-core";
import type { ResolvedFanqieBrowserOptions } from "./browser-options";

const DAILY_LIMIT_RE = /已到达当日发布字数上限|当日发布字数上限/;

/** 多次 Escape，并尝试点击常见遮罩/向导按钮（参考 fanqie_auto_publish 思路）。 */
export async function dismissOverlays(
	page: Page,
	actionTimeout: number,
): Promise<void> {
	const deadline = Date.now() + Math.min(actionTimeout, 8000);
	while (Date.now() < deadline) {
		await page.keyboard.press("Escape").catch(() => {});
		const clicked = await page
			.evaluate(() => {
				const labels = [
					"下一步",
					"完成",
					"我知道了",
					"跳过",
					"关闭",
					"放弃",
					"取消",
				];
				const candidates = [
					...document.querySelectorAll("button"),
					...document.querySelectorAll('[role="button"]'),
					...document.querySelectorAll("a"),
				] as HTMLElement[];
				for (const el of candidates) {
					const t = (el.textContent ?? "").trim();
					if (!t) continue;
					if (!labels.some((l) => t.includes(l))) continue;
					const r = el.getBoundingClientRect();
					if (r.width === 0 || r.height === 0) continue;
					if (r.y < 100 && (t.includes("下一步") || t === "下一步")) continue;
					el.click();
					return true;
				}
				return false;
			})
			.catch(() => false);
		if (!clicked) break;
		await new Promise((r) => setTimeout(r, 200));
	}
}

export async function assertDailyLimitNotShown(page: Page): Promise<void> {
	const body = await page.evaluate(() => document.body?.innerText ?? "");
	if (DAILY_LIMIT_RE.test(body)) {
		throw new Error("DailyLimitReached: 已到达当日发布字数上限");
	}
}

/** 等待正文编辑器与标题区就绪（宽松选择器）。 */
export async function waitForEditorReady(
	page: Page,
	actionTimeout: number,
): Promise<void> {
	await page.waitForFunction(
		() => {
			const pm = document.querySelector(".ProseMirror, .ql-editor");
			const inputs = [...document.querySelectorAll("input")].filter(
				(i) => (i as HTMLInputElement).type === "text",
			);
			return pm !== null && inputs.length > 0;
		},
		{ timeout: actionTimeout },
	);
}

/** 切换到浏览器最后一个页面（常见于「章节管理」新开标签）。 */
export async function switchToLatestEditorTab(
	browser: Browser,
	page: Page,
): Promise<Page> {
	const pages = await browser.pages();
	if (pages.length <= 1) return page;
	const latest = pages[pages.length - 1];
	if (latest && latest !== page) {
		await latest.bringToFront();
		return latest;
	}
	return page;
}

export async function captureStepFailure(
	opts: ResolvedFanqieBrowserOptions,
	step: string,
	page: Page,
	error: unknown,
): Promise<void> {
	if (opts.onBrowserError) {
		await opts.onBrowserError({ step, error, page });
	}
	if (opts.screenshotDir) {
		await mkdir(opts.screenshotDir, { recursive: true }).catch(() => {});
		const safe = step.replace(/[^\w.-]+/g, "_");
		const file = join(opts.screenshotDir, `fanqie-${safe}-${Date.now()}.png`);
		await page.screenshot({ path: file, fullPage: true }).catch(() => {});
		await writeFile(
			`${file}.txt`,
			`${String(error)}\n${error instanceof Error ? (error.stack ?? "") : ""}`,
			"utf8",
		).catch(() => {});
	}
}
