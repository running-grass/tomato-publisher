import puppeteer, {
	type Browser,
	type HTTPResponse,
	type Page,
} from "puppeteer-core";
import type {
	AuthorInfo,
	BaseResponse,
	BookListResponse,
	ChapterListResponse,
	PublishChapterParams,
	PublishChapterResponse,
	VolumeListResponse,
	VolumeModifyData,
} from "../types";
import {
	type FanqieBrowserOptions,
	formatBookManageUrl,
	formatChapterShellUrl,
	type ResolvedFanqieBrowserOptions,
	resolveFanqieBrowserOptions,
} from "./browser-options";
import { openChapterManageFromBookCard } from "./chapter-manage-ui";
import {
	assertDailyLimitNotShown,
	captureStepFailure,
	dismissOverlays,
	switchToLatestEditorTab,
	waitForEditorReady,
} from "./cross-cutting";
import {
	captureLargestCanvasPngFromPage,
	extractQrPayloadFromPage,
} from "./login-qr-terminal";
import { switchWriterLoginToQrTab } from "./writer-login-ui";

/** 仅用于匹配 SPA 产生的 XHR 路径片段，不作为 `goto` 目标。 */
const XHR = {
	userInfo: "user/info",
	bookList: "book_list",
	volumeList: "volume_list",
	chapterList: "chapter_list",
	newArticle: "new_article",
	publishArticle: "publish_article",
	addVolume: "add_volume",
	volumeModify: "volume/modify",
	deleteVolume: "delete_volume",
} as const;

/** 与近期桌面 Chrome 一致，降低被边缘节点直接掐断 TLS 的概率。 */
const DEFAULT_DESKTOP_CHROME_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function readBaseResponseData<T>(res: HTTPResponse): Promise<T> {
	const text = await res.text();
	const json = JSON.parse(text) as BaseResponse<T>;
	if (json.code !== 0) {
		throw new Error(json.message || "接口返回错误");
	}
	return json.data;
}

function getSearchParam(url: string, key: string): string | null {
	try {
		return new URL(url).searchParams.get(key);
	} catch {
		return null;
	}
}

/**
 * 仅通过 Puppeteer 操作作家后台 **页面**（`userDataDir` 内为扫码登录后的会话）；
 * 读写在内部通过「导航 / 点击 / 填表」触发 SPA，再用 `waitForResponse` 解析 JSON，
 * **不对外**提供按 REST URL 调用的 `get`/`postForm`。
 */
export class FanqieBrowser {
	private browser?: Browser;
	private page?: Page;
	private readonly o: ResolvedFanqieBrowserOptions;
	private bootstrapPromise?: Promise<void>;
	private closed = false;
	private queue: Promise<unknown> = Promise.resolve();

	constructor(opts: FanqieBrowserOptions) {
		this.o = resolveFanqieBrowserOptions(opts);
	}

	private resolveExecutable(): string {
		const p = this.o.executablePath ?? process.env.CHROMIUM_PATH;
		if (!p) {
			throw new Error(
				"请设置 FanqieBrowserOptions.executablePath 或环境变量 CHROMIUM_PATH",
			);
		}
		return p;
	}

	private enqueue<T>(fn: () => Promise<T>): Promise<T> {
		const run = this.queue.then(fn, fn);
		this.queue = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	private async withRetry<T>(step: string, fn: () => Promise<T>): Promise<T> {
		let last: unknown;
		for (let i = 0; i <= this.o.maxRetries; i++) {
			try {
				return await fn();
			} catch (e) {
				last = e;
				const page = await this.ensurePage().catch(() => undefined);
				if (page) {
					await captureStepFailure(this.o, `${step}_retry${i}`, page, e);
				}
				if (i === this.o.maxRetries) break;
			}
		}
		throw last instanceof Error ? last : new Error(String(last));
	}

	private async ensurePage(): Promise<Page> {
		if (this.closed) throw new Error("FanqieBrowser 已关闭");
		if (!this.bootstrapPromise) {
			this.bootstrapPromise = this.bootstrap();
		}
		await this.bootstrapPromise;
		const p = this.page;
		if (!p) throw new Error("浏览器初始化失败：未获得 Page");
		return p;
	}

	private async bootstrap(): Promise<void> {
		this.browser = await puppeteer.launch({
			headless: this.o.headless,
			userDataDir: this.o.userDataDir,
			executablePath: this.resolveExecutable(),
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-dev-shm-usage",
				"--disable-gpu",
				"--disable-quic",
				"--lang=zh-CN",
			],
		});
		const pages = await this.browser.pages();
		this.page = pages[0] ?? (await this.browser.newPage());
		await this.page.setUserAgent(DEFAULT_DESKTOP_CHROME_UA);
		/**
		 * 勿在首个 document 请求上附加 `Accept: application/json` 等 API 头：
		 * 部分站点/CDN 会对「看起来像 XHR 的主文档」直接 RST，报 net::ERR_CONNECTION_CLOSED。
		 */
		await this.page.goto(this.o.initialUrl, {
			waitUntil: "domcontentloaded",
			timeout: this.o.navigationTimeout,
		});
		await this.page.setExtraHTTPHeaders({
			Accept: "application/json, text/plain, */*",
			"x-secsdk-csrf-token":
				"00010000000183548efca1f3b1a48ccc5eca4f68bb89add0fcf280751edc08421f178138f749189b24dbb612efb5",
		});
	}

	private async gotoBookManage(bookId: string): Promise<Page> {
		const page = await this.ensurePage();
		const u = formatBookManageUrl(this.o.bookManageUrlTemplate, bookId);
		await page.goto(u, {
			waitUntil: "domcontentloaded",
			timeout: this.o.navigationTimeout,
		});
		await dismissOverlays(page, this.o.actionTimeout);
		await assertDailyLimitNotShown(page);
		return page;
	}

	/**
	 * 单次探测工作台是否已有有效登录（不重试）。
	 * 用于 CLI 无头扫码：失败表示需展示终端二维码。
	 */
	async probeWriterSession(timeoutMs: number): Promise<AuthorInfo | null> {
		return this.enqueue(() => this.probeWriterSessionImpl(timeoutMs));
	}

	private async probeWriterSessionImpl(
		timeoutMs: number,
	): Promise<AuthorInfo | null> {
		try {
			const page = await this.ensurePage();
			const p = page.waitForResponse(
				(r) => r.request().method() === "GET" && r.url().includes(XHR.userInfo),
				{ timeout: timeoutMs },
			);
			await page.goto(this.o.writerShellUrl, {
				waitUntil: "domcontentloaded",
				timeout: this.o.navigationTimeout,
			});
			await dismissOverlays(page, Math.min(this.o.actionTimeout, timeoutMs));
			const res = await p;
			try {
				return await readBaseResponseData<AuthorInfo>(res);
			} catch {
				return null;
			}
		} catch {
			return null;
		}
	}

	/**
	 * 进入作家登录页（`writerLoginUrl`），切换到「扫码登录」Tab 后解码二维码载荷，供终端 `qrcode` 渲染。
	 */
	async extractLoginQrFromCurrentPage(): Promise<string | null> {
		return this.enqueue(async () => {
			const page = await this.ensurePage();
			await page.goto(this.o.writerLoginUrl, {
				waitUntil: "domcontentloaded",
				timeout: this.o.navigationTimeout,
			});
			await dismissOverlays(page, this.o.actionTimeout);
			await switchWriterLoginToQrTab(page, this.o.actionTimeout);
			await new Promise((r) => setTimeout(r, 2000));
			return extractQrPayloadFromPage(page);
		});
	}

	/**
	 * 当前页面上最大块 canvas 的 PNG（须在登录页已切到「扫码登录」且二维码已渲染后调用）。
	 */
	async captureLoginQrPreviewPng(): Promise<Buffer | null> {
		return this.enqueue(async () => {
			const page = await this.ensurePage();
			return captureLargestCanvasPngFromPage(page);
		});
	}

	/** 作者信息：进入作家工作台壳页，监听 SPA 拉取的 `user/info`。 */
	async readAuthorInfo(): Promise<AuthorInfo> {
		return this.enqueue(() =>
			this.withRetry("readAuthorInfo", async () => {
				const page = await this.ensurePage();
				const p = page.waitForResponse(
					(r) =>
						r.request().method() === "GET" && r.url().includes(XHR.userInfo),
					{ timeout: this.o.actionTimeout },
				);
				await page.goto(this.o.writerShellUrl, {
					waitUntil: "domcontentloaded",
					timeout: this.o.navigationTimeout,
				});
				await dismissOverlays(page, this.o.actionTimeout);
				let res: HTTPResponse;
				try {
					res = await p;
				} catch {
					const p2 = page.waitForResponse(
						(r) =>
							r.request().method() === "GET" && r.url().includes(XHR.userInfo),
						{ timeout: this.o.actionTimeout },
					);
					await page.reload({
						waitUntil: "domcontentloaded",
						timeout: this.o.navigationTimeout,
					});
					res = await p2;
				}
				return readBaseResponseData<AuthorInfo>(res);
			}),
		);
	}

	/** 作品列表分页：在工作台壳页监听 `book_list` XHR。 */
	async readBookListPage(
		pageIndex: number,
		pageSize: number,
	): Promise<BookListResponse> {
		return this.enqueue(() =>
			this.withRetry("readBookListPage", async () => {
				const page = await this.ensurePage();
				const match = (url: string) =>
					url.includes(XHR.bookList) &&
					getSearchParam(url, "page_index") === String(pageIndex) &&
					getSearchParam(url, "page_count") === String(pageSize);

				const p = page.waitForResponse(
					(r) => r.request().method() === "GET" && match(r.url()),
					{ timeout: this.o.actionTimeout },
				);
				await page.goto(this.o.writerShellUrl, {
					waitUntil: "domcontentloaded",
					timeout: this.o.navigationTimeout,
				});
				await dismissOverlays(page, this.o.actionTimeout);
				try {
					const res = await p;
					return readBaseResponseData<BookListResponse>(res);
				} catch {
					if (pageIndex === 0) {
						const p2 = page.waitForResponse(
							(r) => r.request().method() === "GET" && match(r.url()),
							{ timeout: this.o.actionTimeout },
						);
						await page.reload({
							waitUntil: "domcontentloaded",
							timeout: this.o.navigationTimeout,
						});
						const res = await p2;
						return readBaseResponseData<BookListResponse>(res);
					}
					const p3 = page.waitForResponse(
						(r) => r.request().method() === "GET" && match(r.url()),
						{ timeout: this.o.actionTimeout },
					);
					await page.evaluate(() => {
						const labels = ["下一页", ">", "下页"];
						const els = [
							...document.querySelectorAll("button, a, [role='button'], li"),
						] as HTMLElement[];
						for (const el of els) {
							const t = (el.textContent ?? "").trim();
							if (labels.some((l) => t === l || t.includes(l))) {
								el.click();
								return;
							}
						}
					});
					const res = await p3;
					return readBaseResponseData<BookListResponse>(res);
				}
			}),
		);
	}

	/** 某书的卷列表：作品管理页 + 监听 `volume_list`。 */
	async readVolumeList(bookId: string): Promise<VolumeListResponse> {
		return this.enqueue(() =>
			this.withRetry("readVolumeList", async () => {
				const page = await this.gotoBookManage(bookId);
				const p = page.waitForResponse(
					(r) =>
						r.request().method() === "GET" &&
						r.url().includes(XHR.volumeList) &&
						getSearchParam(r.url(), "book_id") === bookId,
					{ timeout: this.o.actionTimeout },
				);
				await page.reload({
					waitUntil: "domcontentloaded",
					timeout: this.o.navigationTimeout,
				});
				const res = await p;
				return readBaseResponseData<VolumeListResponse>(res);
			}),
		);
	}

	/** 章节列表分页：章节壳页 + 监听 `chapter_list`。 */
	async readChapterList(args: {
		bookId: string;
		volumeId: string;
		pageIndex: number;
		pageCount: number;
	}): Promise<ChapterListResponse> {
		return this.enqueue(() =>
			this.withRetry("readChapterList", async () => {
				const page = await this.ensurePage();
				const shell = formatChapterShellUrl(
					this.o.bookChapterShellUrlTemplate,
					args.bookId,
				);
				const match = (url: string) =>
					url.includes(XHR.chapterList) &&
					getSearchParam(url, "book_id") === args.bookId &&
					getSearchParam(url, "volumeId") === args.volumeId &&
					getSearchParam(url, "page_index") === String(args.pageIndex) &&
					getSearchParam(url, "page_count") === String(args.pageCount);

				const p = page.waitForResponse(
					(r) => r.request().method() === "GET" && match(r.url()),
					{ timeout: this.o.actionTimeout },
				);
				await page.goto(shell, {
					waitUntil: "domcontentloaded",
					timeout: this.o.navigationTimeout,
				});
				await dismissOverlays(page, this.o.actionTimeout);
				try {
					const res = await p;
					return readBaseResponseData<ChapterListResponse>(res);
				} catch {
					const p2 = page.waitForResponse(
						(r) => r.request().method() === "GET" && match(r.url()),
						{ timeout: this.o.actionTimeout },
					);
					await page.reload({
						waitUntil: "domcontentloaded",
						timeout: this.o.navigationTimeout,
					});
					const res = await p2;
					return readBaseResponseData<ChapterListResponse>(res);
				}
			}),
		);
	}

	/** 新建空白章节（点击「新建章节」等，监听 `new_article`）。 */
	async createBlankChapter(bookId: string): Promise<{ itemId: string }> {
		return this.enqueue(() =>
			this.withRetry("createBlankChapter", async () => {
				const page = await this.gotoBookManage(bookId);
				const tryClickNewChapter = () =>
					page.evaluate(() => {
						const hits = ["新建章节", "新章节", "创建章节", "发章节"];
						const all = [
							...document.querySelectorAll("button"),
							...document.querySelectorAll('[role="button"]'),
							...document.querySelectorAll("a"),
						] as HTMLElement[];
						for (const el of all) {
							const t = (el.textContent ?? "").trim();
							if (!t) continue;
							if (hits.some((h) => t.includes(h))) {
								el.click();
								return true;
							}
						}
						return false;
					});

				const respPromise = page.waitForResponse(
					(r) =>
						r.request().method() === "POST" && r.url().includes(XHR.newArticle),
					{ timeout: this.o.actionTimeout },
				);

				let clicked = await tryClickNewChapter();
				if (!clicked) {
					await openChapterManageFromBookCard(
						page,
						bookId,
						this.o.actionTimeout,
					);
					clicked = await tryClickNewChapter();
				}
				if (!clicked) {
					throw new Error(
						"未找到「新建章节」入口，请检查 bookManageUrlTemplate 或页面结构",
					);
				}

				const res = await respPromise;
				const data = await readBaseResponseData<{ itemId: string }>(res);
				if (!this.browser) throw new Error("Browser 未初始化");
				const latest = await switchToLatestEditorTab(this.browser, page);
				this.page = latest;
				await dismissOverlays(latest, this.o.actionTimeout);
				return data;
			}),
		);
	}

	/** 填写并发布章节（UI + 监听 `publish_article`）。 */
	async publishChapter(
		params: PublishChapterParams,
	): Promise<PublishChapterResponse> {
		const flat: Record<string, string | number | boolean> = {
			itemId: params.itemId ?? "",
			book_id: params.book_id,
			content: params.content,
			timer_status: params.timer_status ?? 0,
			need_pay: 0,
			volume_name: params.volume_name,
			volumeId: params.volumeId,
			title: params.title,
			timer_time: params.timer_time != null ? String(params.timer_time) : "",
			publish_status: params.publish_status ?? 1,
			device_platform: "pc",
			speak_type: 0,
			use_ai: 2,
			timer_chapter_preview: "[]",
			has_chapter_ad: false,
			chapter_ad_types: "",
		};
		return this.enqueue(() =>
			this.withRetry("publishChapter", () => this.runPublishChapterUi(flat)),
		);
	}

	async addVolume(bookId: string, volumeName: string): Promise<void> {
		return this.enqueue(() =>
			this.withRetry("addVolume", () =>
				this.runAddVolumeUi({ book_id: bookId, volume_name: volumeName }),
			),
		);
	}

	async modifyVolumes(
		bookId: string,
		volumeData: VolumeModifyData[],
	): Promise<void> {
		return this.enqueue(() =>
			this.withRetry("modifyVolumes", () =>
				this.runModifyVolumesUi({
					book_id: bookId,
					volume_data: JSON.stringify(volumeData),
				}),
			),
		);
	}

	async deleteVolume(bookId: string, volumeId: string): Promise<void> {
		return this.enqueue(() =>
			this.withRetry("deleteVolume", () =>
				this.runDeleteVolumeUi({ book_id: bookId, volumeId }),
			),
		);
	}

	private async ensureChapterEditor(
		bookId: string,
		itemId: string,
	): Promise<void> {
		const page = await this.ensurePage();
		const onEditor = await page.evaluate((id) => {
			const body = document.body?.innerHTML ?? "";
			return body.includes(id);
		}, itemId);
		if (onEditor) return;

		await this.gotoBookManage(bookId);
		const opened = await page.evaluate((id) => {
			const links = [
				...document.querySelectorAll("a[href]"),
			] as HTMLAnchorElement[];
			for (const a of links) {
				if (a.href.includes(id)) {
					a.click();
					return true;
				}
			}
			const rows = [...document.querySelectorAll("tr, [role='row']")];
			for (const row of rows) {
				if ((row.textContent ?? "").length > 10 && row.querySelector("a")) {
					const a = row.querySelector("a") as HTMLAnchorElement | null;
					if (a && (row.innerHTML.includes(id) || a.href.includes("edit"))) {
						a.click();
						return true;
					}
				}
			}
			return false;
		}, itemId);
		if (!opened) {
			throw new Error(
				`无法打开章节编辑器：itemId=${itemId}。请在 createBlankChapter 后同一标签页 publish，或扩展选择器。`,
			);
		}
		await new Promise((r) => setTimeout(r, 800));
		if (this.browser) {
			this.page = await switchToLatestEditorTab(this.browser, page);
		}
		await dismissOverlays(await this.ensurePage(), this.o.actionTimeout);
		await waitForEditorReady(await this.ensurePage(), this.o.actionTimeout);
	}

	private async runPublishChapterUi(
		params: Record<string, string | number | boolean>,
	): Promise<PublishChapterResponse> {
		const bookId = String(params.book_id ?? "");
		const itemId = String(params.itemId ?? "");
		if (!bookId || !itemId) {
			throw new Error("发布需要 book_id 与 itemId");
		}

		await this.ensureChapterEditor(bookId, itemId);
		const page = await this.ensurePage();
		await waitForEditorReady(page, this.o.actionTimeout);

		const title = String(params.title ?? "");
		const content = String(params.content ?? "");

		await page.evaluate((t) => {
			const inputs = [...document.querySelectorAll("input")].filter(
				(i) => (i as HTMLInputElement).type === "text",
			) as HTMLInputElement[];
			const titleInput =
				inputs.find((i) => i.placeholder?.includes("标题")) ?? inputs[0];
			if (titleInput) {
				titleInput.focus();
				titleInput.value = t;
				titleInput.dispatchEvent(new Event("input", { bubbles: true }));
			}
		}, title);

		await page.evaluate((html) => {
			const root =
				(document.querySelector(".ProseMirror") as HTMLElement | null) ??
				(document.querySelector(".ql-editor") as HTMLElement | null);
			if (!root) return;
			root.focus();
			root.innerHTML = html;
			root.dispatchEvent(new Event("input", { bubbles: true }));
		}, content);

		if (this.o.declareAiAssist !== "none") {
			await page
				.evaluate((useNo) => {
					const labels = useNo
						? ["未使用", "否", "无", "未借助"]
						: ["使用", "是", "借助"];
					const inputs = [
						...document.querySelectorAll("input[type=radio]"),
						...document.querySelectorAll("label"),
					] as HTMLElement[];
					for (const el of inputs) {
						const t = (el.textContent ?? "").trim();
						if (labels.some((l) => t.includes(l))) {
							(el as HTMLElement).click();
							return;
						}
					}
				}, this.o.declareAiAssist === "no")
				.catch(() => {});
		}

		const respPromise = page.waitForResponse(
			(r) =>
				r.request().method() === "POST" && r.url().includes(XHR.publishArticle),
			{ timeout: this.o.actionTimeout },
		);

		await dismissOverlays(page, this.o.actionTimeout);

		const publishClicked = await page.evaluate(() => {
			const hits = ["立即发布", "确认发布", "发布", "提交发布"];
			const all = [
				...document.querySelectorAll("button"),
				...document.querySelectorAll('[role="button"]'),
			] as HTMLElement[];
			for (const el of all) {
				const t = (el.textContent ?? "").trim();
				if (hits.some((h) => t === h || t.includes(h))) {
					el.click();
					return true;
				}
			}
			return false;
		});
		if (!publishClicked) {
			throw new Error("未找到发布按钮");
		}

		await dismissOverlays(page, this.o.actionTimeout);

		const res = await respPromise;
		const data = await readBaseResponseData<PublishChapterResponse>(res);
		await assertDailyLimitNotShown(page);
		return data;
	}

	private async runAddVolumeUi(
		params: Record<string, string | number | boolean>,
	): Promise<void> {
		const bookId = String(params.book_id ?? "");
		const name = String(params.volume_name ?? "");
		if (!bookId || !name)
			throw new Error("addVolume 需要 book_id、volume_name");
		const page = await this.gotoBookManage(bookId);

		const respPromise = page.waitForResponse(
			(r) => r.request().method() === "POST" && r.url().includes(XHR.addVolume),
			{ timeout: this.o.actionTimeout },
		);

		const clickedPanel = await page.evaluate(() => {
			const openers = ["分卷", "卷管理", "作品目录", "目录"];
			const all = [
				...document.querySelectorAll("button"),
				...document.querySelectorAll('[role="button"]'),
				...document.querySelectorAll("a"),
			] as HTMLElement[];
			for (const el of all) {
				const t = (el.textContent ?? "").trim();
				if (openers.some((o) => t.includes(o))) {
					el.click();
					return true;
				}
			}
			return false;
		});
		if (clickedPanel) {
			await new Promise((r) => setTimeout(r, 500));
		}

		const clickedNew = await page.evaluate(() => {
			const all = [
				...document.querySelectorAll("button"),
				...document.querySelectorAll('[role="button"]'),
				...document.querySelectorAll("a"),
			] as HTMLElement[];
			for (const el of all) {
				const t = (el.textContent ?? "").trim();
				if (
					t.includes("新建卷") ||
					t.includes("添加卷") ||
					t.includes("新卷")
				) {
					el.click();
					return true;
				}
			}
			return false;
		});

		if (!clickedNew) {
			throw new Error("未找到「新建卷/添加卷」入口");
		}

		await page
			.waitForSelector('input[type="text"], input:not([type])', {
				timeout: this.o.actionTimeout,
			})
			.catch(() => {});

		await page.evaluate((volName) => {
			const inputs = [...document.querySelectorAll("input")].filter(
				(i) => (i as HTMLInputElement).type !== "hidden",
			) as HTMLInputElement[];
			const last = inputs[inputs.length - 1];
			if (last) {
				last.focus();
				last.value = volName;
				last.dispatchEvent(new Event("input", { bubbles: true }));
			}
			const confirms = ["确定", "确认", "保存", "创建"];
			const buttons = [
				...document.querySelectorAll("button"),
			] as HTMLButtonElement[];
			for (const b of buttons) {
				const t = (b.textContent ?? "").trim();
				if (confirms.some((c) => t === c || t.includes(c))) {
					b.click();
					return;
				}
			}
		}, name);

		const res = await respPromise;
		await readBaseResponseData<null>(res);
	}

	private async runModifyVolumesUi(
		params: Record<string, string | number | boolean>,
	): Promise<void> {
		const bookId = String(params.book_id ?? "");
		const raw = String(params.volume_data ?? "[]");
		if (!bookId) throw new Error("modifyVolumes 需要 book_id");
		const items = JSON.parse(raw) as VolumeModifyData[];
		const page = await this.gotoBookManage(bookId);
		for (const it of items) {
			const respPromise = page.waitForResponse(
				(r) =>
					r.request().method() === "POST" && r.url().includes(XHR.volumeModify),
				{ timeout: this.o.actionTimeout },
			);
			const hit = await page.evaluate((vid) => {
				const rows = [...document.querySelectorAll("tr, [role='row'], li")];
				for (const row of rows) {
					if (!(row.textContent ?? "").includes(vid)) continue;
					const edit = row.querySelector(
						"button, a, [role='button']",
					) as HTMLElement | null;
					if (edit) {
						edit.click();
						return true;
					}
				}
				return false;
			}, it.volumeId);
			if (!hit) throw new Error(`未找到卷行: ${it.volumeId}`);
			await new Promise((r) => setTimeout(r, 400));
			await page.evaluate((name) => {
				const inputs = [...document.querySelectorAll("input")].filter(
					(i) => (i as HTMLInputElement).type === "text",
				) as HTMLInputElement[];
				const inp = inputs[0];
				if (inp) {
					inp.focus();
					inp.value = name;
					inp.dispatchEvent(new Event("input", { bubbles: true }));
				}
				const buttons = [
					...document.querySelectorAll("button"),
				] as HTMLButtonElement[];
				for (const b of buttons) {
					const t = (b.textContent ?? "").trim();
					if (t === "确定" || t === "保存" || t.includes("确认")) {
						b.click();
						return;
					}
				}
			}, it.volume_name);
			const res = await respPromise;
			await readBaseResponseData<null>(res);
			await dismissOverlays(page, this.o.actionTimeout);
		}
	}

	private async runDeleteVolumeUi(
		params: Record<string, string | number | boolean>,
	): Promise<void> {
		const bookId = String(params.book_id ?? "");
		const volumeId = String(params.volumeId ?? "");
		if (!bookId || !volumeId) {
			throw new Error("deleteVolume 需要 book_id、volumeId");
		}
		const page = await this.gotoBookManage(bookId);

		const respPromise = page.waitForResponse(
			(r) =>
				r.request().method() === "POST" && r.url().includes(XHR.deleteVolume),
			{ timeout: this.o.actionTimeout },
		);

		const hit = await page.evaluate((vid) => {
			const rows = [...document.querySelectorAll("tr, [role='row'], li")];
			for (const row of rows) {
				if (!(row.textContent ?? "").includes(vid)) continue;
				const del = [...row.querySelectorAll("button, a")].find((el) =>
					(el.textContent ?? "").includes("删除"),
				) as HTMLElement | undefined;
				if (del) {
					del.click();
					return true;
				}
			}
			return false;
		}, volumeId);
		if (!hit) throw new Error(`未找到删除入口: volumeId=${volumeId}`);

		await page
			.evaluate(() => {
				const buttons = [
					...document.querySelectorAll("button"),
				] as HTMLButtonElement[];
				for (const b of buttons) {
					const t = (b.textContent ?? "").trim();
					if (t === "确定" || t.includes("确认删除")) {
						b.click();
						return;
					}
				}
			})
			.catch(() => {});

		const res = await respPromise;
		await readBaseResponseData<null>(res);
	}

	async close(): Promise<void> {
		this.closed = true;
		this.bootstrapPromise = undefined;
		if (this.browser) {
			await this.browser.close();
			this.browser = undefined;
			this.page = undefined;
		}
	}
}
