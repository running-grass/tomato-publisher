import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FanqieClient } from "../../src/index.js";
import {
	chromiumPath,
	skipIfNoVolumeId,
	TEST_BOOK_ID,
	TEST_VOLUME_ID,
	userDataDir,
} from "./fixtures.js";

const skipWrite = process.env.FANQIE_E2E_WRITE !== "1" || skipIfNoVolumeId;

describe.skipIf(skipWrite)("ChapterService publish (E2E 写)", () => {
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

	it("addChapter 后 publish 返回 itemId 与格式化标题", async () => {
		const book = await client.book(TEST_BOOK_ID);
		const volume = await book.volume(TEST_VOLUME_ID);
		const chapter = await volume.addChapter();
		const { itemId, formattedTitle } = await chapter.publish({
			chapterNo: "99999",
			title: "自动化测试章节（可删）",
			content: "正文仅用于集成测试。\n\n第二段。",
		});
		expect(typeof itemId).toBe("string");
		expect(itemId.length).toBeGreaterThan(0);
		expect(formattedTitle).toContain("99999");
	});
});
