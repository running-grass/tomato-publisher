import { beforeAll, describe, expect, it } from "vitest";
import { FanqieClient } from "../../src/index.js";
import { cookie, skipIfNoBookId, TEST_BOOK_ID } from "./fixtures.js";

describe.skipIf(skipIfNoBookId)("BookService (integration)", () => {
	let client: FanqieClient;

	beforeAll(() => {
		client = new FanqieClient({ cookie });
	});

	it("通过 client.book 工厂创建 BookService 并暴露 bookId/info", async () => {
		const book = await client.book(TEST_BOOK_ID);
		expect(book.bookId).toBe(TEST_BOOK_ID);
		expect(book.info.book_id).toBe(TEST_BOOK_ID);
		expect(typeof book.info.book_name).toBe("string");
	});

	it("listVolumes 返回卷数组（命中 lazy 缓存）", async () => {
		const book = await client.book(TEST_BOOK_ID);
		const v1 = await book.listVolumes();
		const v2 = await book.listVolumes();
		expect(Array.isArray(v1)).toBe(true);
		expect(v2).toBe(v1);
		if (v1.length > 0) {
			expect(typeof v1[0]?.volumeId).toBe("string");
			expect(typeof v1[0]?.volume_name).toBe("string");
		}
	});

	it("非法 bookId 应抛错", async () => {
		await expect(client.book("__definitely_not_exists__")).rejects.toThrow(
			/作品不存在/,
		);
	});
});
