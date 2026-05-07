import type { Page } from "puppeteer-core";

/**
 * 多书场景：在含书名的卡片上 hover 后再点「章节管理」（参考 fanqie_auto_publish）。
 * 若当前页无匹配结构则返回 `false`，由调用方继续其它策略。
 */
export async function openChapterManageFromBookCard(
	page: Page,
	bookTitle: string,
	_actionTimeout: number,
): Promise<boolean> {
	return await page.evaluate((title) => {
		const cards = [
			...document.querySelectorAll("[class*='card']"),
			...document.querySelectorAll("li"),
			...document.querySelectorAll("[class*='book']"),
		] as HTMLElement[];
		for (const c of cards) {
			if (!(c.textContent ?? "").includes(title)) continue;
			c.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
			const links = c.querySelectorAll("a, button, [role='button']");
			for (const l of links) {
				const t = (l.textContent ?? "").trim();
				if (t.includes("章节管理")) {
					(l as HTMLElement).click();
					return true;
				}
			}
		}
		return false;
	}, bookTitle);
}
