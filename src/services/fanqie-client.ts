import { resolve } from "node:path";
import type { FanqieBrowserOptions } from "../browser/browser-options";
import { FanqieBrowser } from "../browser/fanqie-browser";
import type { AuthorInfo, BookInfo, BookListResponse } from "../types";
import { BookService } from "./book-service";

const ALL_BOOKS_PAGE_SIZE = 100;

export interface FanqieClientOptions extends FanqieBrowserOptions {
	/**
	 * 供 `publishFromFile` 解析相对路径时的根目录。
	 * 不设则 `publishFromFile` 仅接受绝对路径（库不默认使用 `process.cwd()`）。
	 */
	fileReadBaseDir?: string;
}

/**
 * 番茄作者后台客户端（四级 Service 链式入口）。
 *
 * - 持有 `FanqieBrowser`：仅 Puppeteer + `userDataDir`（扫码登录后的 Profile），不拼接 REST 调用
 * - 提供作者级查询：`getAuthorInfo` / `listBooks`
 * - 工厂方法 `book(bookId)` 返回 `BookService`，构造时即校验 ID 合法性
 */
export class FanqieClient {
	public readonly browser: FanqieBrowser;
	private readonly fileReadBaseDir?: string;

	/** 全量作品列表的 lazy 缓存（用于 `book(id)` 校验复用）。 */
	private _allBooksPromise?: Promise<BookInfo[]>;

	constructor(opts: FanqieClientOptions) {
		const { fileReadBaseDir, ...browserOpts } = opts;
		this.fileReadBaseDir = fileReadBaseDir;
		this.browser = new FanqieBrowser(browserOpts);
	}

	resolveChapterFilePath(filePath: string): string {
		if (filePath.startsWith("/")) {
			return filePath;
		}
		if (this.fileReadBaseDir) {
			return resolve(this.fileReadBaseDir, filePath);
		}
		throw new Error(
			"publishFromFile 需要绝对路径，或在 FanqieClientOptions 中设置 fileReadBaseDir",
		);
	}

	async getAuthorInfo(): Promise<AuthorInfo> {
		return this.browser.readAuthorInfo();
	}

	async listBooks(
		pageIndex: number,
		pageSize: number,
	): Promise<BookListResponse> {
		return this.browser.readBookListPage(pageIndex, pageSize);
	}

	async listAllBooks(): Promise<BookInfo[]> {
		if (!this._allBooksPromise) {
			this._allBooksPromise = this.fetchAllBooks();
		}
		return this._allBooksPromise;
	}

	private async fetchAllBooks(): Promise<BookInfo[]> {
		const collected: BookInfo[] = [];
		let pageIndex = 0;
		while (true) {
			const page = await this.listBooks(pageIndex, ALL_BOOKS_PAGE_SIZE);
			const list = page.book_list ?? [];
			collected.push(...list);
			const totalCount = page.total_count ?? collected.length;
			if (
				list.length === 0 ||
				collected.length >= totalCount ||
				list.length < ALL_BOOKS_PAGE_SIZE
			) {
				break;
			}
			pageIndex += 1;
		}
		return collected;
	}

	async book(bookId: string): Promise<BookService> {
		const all = await this.listAllBooks();
		const info = all.find((b) => b.book_id === bookId);
		if (!info) {
			throw new Error(`作品不存在: bookId=${bookId}`);
		}
		return new BookService(this, info);
	}

	async refresh(): Promise<void> {
		this._allBooksPromise = undefined;
	}

	async close(): Promise<void> {
		await this.browser.close();
	}
}
