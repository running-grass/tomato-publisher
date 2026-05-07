import type { Page } from "puppeteer-core";

/**
 * 作家后台登录页默认展示「账号登录」等，需点到「扫码登录」才会渲染二维码。
 */
export async function switchWriterLoginToQrTab(
	page: Page,
	actionTimeout: number,
): Promise<boolean> {
	const deadline = Date.now() + actionTimeout;
	while (Date.now() < deadline) {
		const clicked = await page.evaluate(() => {
			const needles = ["扫码登录", "手机扫码", "扫码"];
			const nodes = [
				...document.querySelectorAll(
					'[role="tab"], button, a, [role="button"], .arco-tabs-header-title, .semi-tabs-tab, [class*="tab"]',
				),
				...document.querySelectorAll("span, div, li"),
			] as HTMLElement[];
			for (const el of nodes) {
				const t = (el.textContent ?? "").replace(/\s+/g, "").trim();
				if (!t) continue;
				if (needles.some((n) => t === n || t.includes(n))) {
					el.click();
					return true;
				}
			}
			return false;
		});
		if (clicked) {
			await new Promise((r) => setTimeout(r, 600));
			return true;
		}
		await new Promise((r) => setTimeout(r, 400));
	}
	return false;
}
