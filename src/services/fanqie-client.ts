import { HttpClient } from "../http/client";
import type { AuthorInfo, BookInfo, BookListResponse } from "../types";
import { BookService } from "./book-service";

const URL_AUTHOR_INFO = "https://fanqienovel.com/api/user/info/v2";
const URL_BOOK_LIST = "https://fanqienovel.com/api/author/book/book_list/v0";

const ALL_BOOKS_PAGE_SIZE = 100;

/**
 * 番茄作者后台 API 客户端（四级 Service 链式入口）。
 *
 * - 持有 Cookie 与内部 `HttpClient`
 * - 提供作者级查询：`getAuthorInfo` / `listBooks`
 * - 工厂方法 `book(bookId)` 返回 `BookService`，构造时即校验 ID 合法性
 */
export class FanqieClient {
	/** 内部 HTTP 客户端，子级 Service 通过父链复用同一实例。 */
	public readonly http: HttpClient;

	/** 全量作品列表的 lazy 缓存（用于 `book(id)` 校验复用）。 */
	private _allBooksPromise?: Promise<BookInfo[]>;

	constructor(opts: { cookie: string }) {
		if (!opts.cookie) {
			throw new Error("FanqieClient 需要 cookie");
		}
		this.http = new HttpClient(opts.cookie);
	}

	/** 获取作者信息（不缓存）。 */
	async getAuthorInfo(): Promise<AuthorInfo> {
		return this.http.get<AuthorInfo>(URL_AUTHOR_INFO, {}, "获取作者信息失败");
	}

	/**
	 * 按页获取作品列表（不缓存，按调用方分页参数返回）。
	 *
	 * @param pageIndex 从 0 开始的页码
	 * @param pageSize 每页数量
	 */
	async listBooks(
		pageIndex: number,
		pageSize: number,
	): Promise<BookListResponse> {
		return this.http.get<BookListResponse>(
			URL_BOOK_LIST,
			{ page_count: pageSize, page_index: pageIndex },
			"获取作品列表失败",
		);
	}

	/**
	 * 拉取并缓存全量作品列表，供 `book(id)` 校验使用。
	 *
	 * 自动翻页直到取尽 `total_count`。
	 */
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

	/**
	 * 通过 `bookId` 创建 `BookService`，构造时即校验 ID 是否合法。
	 *
	 * @throws 当 `bookId` 不在当前账号作品列表中
	 */
	async book(bookId: string): Promise<BookService> {
		const all = await this.listAllBooks();
		const info = all.find((b) => b.book_id === bookId);
		if (!info) {
			throw new Error(`作品不存在: bookId=${bookId}`);
		}
		return new BookService(this, info);
	}

	/** 失效全量作品列表缓存（下次访问会重新拉取）。 */
	async refresh(): Promise<void> {
		this._allBooksPromise = undefined;
	}
}
