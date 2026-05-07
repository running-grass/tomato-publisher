import type { Page } from "puppeteer-core";

/** 浏览器错误回调：由宿主决定日志/告警；可配合 `screenshotDir` 落盘。 */
export type FanqieBrowserErrorHandler = (ctx: {
	step: string;
	error: unknown;
	page: Page;
}) => void | Promise<void>;

export interface FanqieBrowserOptions {
	userDataDir: string;
	executablePath?: string;
	headless?: boolean | "shell";
	/**
	 * 首次启动后导航，用于同源 Cookie（默认番茄首页）。
	 * 登录态须事先通过有头浏览器扫码写入 `userDataDir`。
	 */
	initialUrl?: string;
	/**
	 * 作家工作台入口（**页面** URL，非 REST）。在此壳下 SPA 会拉取作品列表等。
	 * 默认：`https://fanqienovel.com/main/writer`
	 */
	writerShellUrl?: string;
	/**
	 * 作家登录页（**页面** URL）。无头扫码前会 `goto` 此地址并切换到「扫码登录」Tab。
	 * 默认：`https://fanqienovel.com/main/writer/login`
	 */
	writerLoginUrl?: string;
	/**
	 * 作品管理页 URL 模板，`{bookId}` 会被替换（**页面** URL）。
	 * 默认：`https://fanqienovel.com/main/writer/book/{bookId}`
	 */
	bookManageUrlTemplate?: string;
	/**
	 * 章节列表 / 编辑入口所在 **页面** URL 模板（`{bookId}`）。
	 * 默认：`https://fanqienovel.com/main/writer/book/{bookId}/chapter`
	 */
	bookChapterShellUrlTemplate?: string;
	navigationTimeout?: number;
	actionTimeout?: number;
	maxRetries?: number;
	screenshotDir?: string;
	onBrowserError?: FanqieBrowserErrorHandler;
	declareAiAssist?: "none" | "no" | "yes";
}

export interface ResolvedFanqieBrowserOptions {
	userDataDir: string;
	executablePath?: string;
	headless: boolean | "shell";
	initialUrl: string;
	writerShellUrl: string;
	writerLoginUrl: string;
	bookManageUrlTemplate: string;
	bookChapterShellUrlTemplate: string;
	navigationTimeout: number;
	actionTimeout: number;
	maxRetries: number;
	screenshotDir?: string;
	onBrowserError?: FanqieBrowserErrorHandler;
	declareAiAssist: "none" | "no" | "yes";
}

export function resolveFanqieBrowserOptions(
	opts: FanqieBrowserOptions,
): ResolvedFanqieBrowserOptions {
	if (!opts.userDataDir) {
		throw new Error("FanqieBrowser 需要 userDataDir");
	}
	return {
		userDataDir: opts.userDataDir,
		executablePath: opts.executablePath,
		headless: opts.headless ?? true,
		initialUrl: opts.initialUrl ?? "https://fanqienovel.com/",
		writerShellUrl:
			opts.writerShellUrl ?? "https://fanqienovel.com/main/writer",
		writerLoginUrl:
			opts.writerLoginUrl ?? "https://fanqienovel.com/main/writer/login",
		bookManageUrlTemplate:
			opts.bookManageUrlTemplate ??
			"https://fanqienovel.com/main/writer/book/{bookId}",
		bookChapterShellUrlTemplate:
			opts.bookChapterShellUrlTemplate ??
			"https://fanqienovel.com/main/writer/book/{bookId}/chapter",
		navigationTimeout: opts.navigationTimeout ?? 90_000,
		actionTimeout: opts.actionTimeout ?? 45_000,
		maxRetries: opts.maxRetries ?? 2,
		screenshotDir: opts.screenshotDir,
		onBrowserError: opts.onBrowserError,
		declareAiAssist: opts.declareAiAssist ?? "none",
	};
}

export function formatBookManageUrl(template: string, bookId: string): string {
	return template.replaceAll("{bookId}", bookId);
}

export function formatChapterShellUrl(
	template: string,
	bookId: string,
): string {
	return template.replaceAll("{bookId}", bookId);
}
