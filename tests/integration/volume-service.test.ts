import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FanqieClient } from "../../src/index.js";
import {
	chromiumPath,
	skipIfNoVolumeId,
	TEST_BOOK_ID,
	TEST_VOLUME_ID,
	userDataDir,
} from "./fixtures.js";

describe.skipIf(skipIfNoVolumeId)("VolumeService (integration)", () => {
	let client: FanqieClient;

	beforeAll(() => {
		client = new FanqieClient({
			userDataDir,
			...(chromiumPath ? { executablePath: chromiumPath } : {}),
		});
	});

	afterAll(async () => {
		await client.close();
	});

	it("通过 book.volume 工厂创建 VolumeService 并暴露 volumeId/volumeName", async () => {
		const book = await client.book(TEST_BOOK_ID);
		const volume = await book.volume(TEST_VOLUME_ID);
		expect(volume.volumeId).toBe(TEST_VOLUME_ID);
		expect(typeof volume.volumeName).toBe("string");
		expect(volume.book.bookId).toBe(TEST_BOOK_ID);
	});

	it("listChapters 第 0 页能返回结构", async () => {
		const book = await client.book(TEST_BOOK_ID);
		const volume = await book.volume(TEST_VOLUME_ID);
		const page = await volume.listChapters(0, 10);
		expect(page).toBeTruthy();
		expect(typeof page.total_count).toBe("number");
		expect(Array.isArray(page.item_list)).toBe(true);
	});

	it("非法 volumeId 应抛错", async () => {
		const book = await client.book(TEST_BOOK_ID);
		await expect(book.volume("__not_a_real_volume__")).rejects.toThrow(
			/卷不存在/,
		);
	});
});
