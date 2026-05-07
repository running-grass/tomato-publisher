import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../../src/http/client";
import {
	BookService,
	ChapterService,
	FanqieClient,
	VolumeService,
} from "../../src/index";
import {
	stubBook,
	stubBookListResponse,
	stubChapterInfo,
	stubChapterListResponse,
	stubVolume,
	stubVolumeListResponse,
} from "./stubs";

const COOKIE = "unit-test-cookie";

/**
 * 按 URL 分发 `HttpClient.get` 的 mock，不触发真实网络。
 */
function mockGet(
	impl: (
		url: string,
		params?: Record<string, string | number>,
	) => Promise<unknown>,
) {
	return vi
		.spyOn(HttpClient.prototype, "get")
		.mockImplementation(
			async (url: string, params?: Record<string, string | number>) =>
				impl(url, params) as never,
		);
}

function mockPostForm(
	impl: (
		url: string,
		params?: Record<string, string | number | boolean>,
	) => Promise<unknown>,
) {
	return vi
		.spyOn(HttpClient.prototype, "postForm")
		.mockImplementation(
			async (url: string, params?: Record<string, string | number | boolean>) =>
				impl(url, params) as never,
		);
}

describe("Service 工厂链（单元，无网络）", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("FanqieClient.book", () => {
		it("合法 bookId 返回 BookService，并持有 client 与 info", async () => {
			const bookRow = stubBook("book-ok", "单元测试书");
			mockGet(async (url) => {
				if (url.includes("book_list")) {
					return stubBookListResponse([bookRow], 1);
				}
				throw new Error(`未 mock 的 GET: ${url}`);
			});

			const client = new FanqieClient({ cookie: COOKIE });
			const book = await client.book("book-ok");

			expect(book).toBeInstanceOf(BookService);
			expect(book.client).toBe(client);
			expect(book.bookId).toBe("book-ok");
			expect(book.info.book_name).toBe("单元测试书");
		});

		it("非法 bookId 抛出「作品不存在」", async () => {
			mockGet(async (url) => {
				if (url.includes("book_list")) {
					return stubBookListResponse([stubBook("other", "别的书")], 1);
				}
				throw new Error(`未 mock 的 GET: ${url}`);
			});

			const client = new FanqieClient({ cookie: COOKIE });
			await expect(client.book("not-exists")).rejects.toThrow(/作品不存在/);
		});
	});

	describe("BookService.volume", () => {
		const bookRow = stubBook("book-1", "书一");
		const volRow = stubVolume("book-1", "vol-ok", "正文卷");

		beforeEach(() => {
			mockGet(async (url) => {
				if (url.includes("book_list")) {
					return stubBookListResponse([bookRow], 1);
				}
				if (url.includes("volume_list")) {
					return stubVolumeListResponse([volRow]);
				}
				throw new Error(`未 mock 的 GET: ${url}`);
			});
		});

		it("合法 volumeId 返回 VolumeService，并持有 book 与 info", async () => {
			const client = new FanqieClient({ cookie: COOKIE });
			const book = await client.book("book-1");
			const volume = await book.volume("vol-ok");

			expect(volume).toBeInstanceOf(VolumeService);
			expect(volume.book).toBe(book);
			expect(volume.volumeId).toBe("vol-ok");
			expect(volume.volumeName).toBe("正文卷");
		});

		it("非法 volumeId 抛出「卷不存在」", async () => {
			const client = new FanqieClient({ cookie: COOKIE });
			const book = await client.book("book-1");
			await expect(book.volume("vol-bad")).rejects.toThrow(/卷不存在/);
		});
	});

	describe("VolumeService.chapter", () => {
		const bookRow = stubBook("book-2", "书二");
		const volRow = stubVolume("book-2", "vol-2", "第二卷");
		const chRow = stubChapterInfo("item-ok", "vol-2");

		beforeEach(() => {
			mockGet(async (url) => {
				if (url.includes("book_list")) {
					return stubBookListResponse([bookRow], 1);
				}
				if (url.includes("volume_list")) {
					return stubVolumeListResponse([volRow]);
				}
				if (url.includes("chapter_list")) {
					return stubChapterListResponse([chRow], 1);
				}
				throw new Error(`未 mock 的 GET: ${url}`);
			});
		});

		it("合法 itemId 返回 ChapterService，并持有 volume 与 itemId", async () => {
			const client = new FanqieClient({ cookie: COOKIE });
			const book = await client.book("book-2");
			const volume = await book.volume("vol-2");
			const chapter = await volume.chapter("item-ok");

			expect(chapter).toBeInstanceOf(ChapterService);
			expect(chapter.volume).toBe(volume);
			expect(chapter.itemId).toBe("item-ok");
		});

		it("非法 itemId 抛出「章节不存在」", async () => {
			const client = new FanqieClient({ cookie: COOKIE });
			const book = await client.book("book-2");
			const volume = await book.volume("vol-2");
			await expect(volume.chapter("item-bad")).rejects.toThrow(/章节不存在/);
		});
	});

	describe("VolumeService.addChapter", () => {
		it("postForm 返回 itemId 时得到 ChapterService（不校验列表）", async () => {
			const bookRow = stubBook("book-3", "书三");
			const volRow = stubVolume("book-3", "vol-3", "第三卷");

			mockGet(async (url) => {
				if (url.includes("book_list")) {
					return stubBookListResponse([bookRow], 1);
				}
				if (url.includes("volume_list")) {
					return stubVolumeListResponse([volRow]);
				}
				throw new Error(`未 mock 的 GET: ${url}`);
			});

			mockPostForm(async (url) => {
				if (url.includes("new_article")) {
					return { itemId: "new-item-1" };
				}
				throw new Error(`未 mock 的 POST: ${url}`);
			});

			const client = new FanqieClient({ cookie: COOKIE });
			const book = await client.book("book-3");
			const volume = await book.volume("vol-3");
			const chapter = await volume.addChapter();

			expect(chapter).toBeInstanceOf(ChapterService);
			expect(chapter.volume).toBe(volume);
			expect(chapter.itemId).toBe("new-item-1");
		});
	});
});
