import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FanqieClient } from "../../src/index.js";
import { chromiumPath, skipIfNoUserDataDir, userDataDir } from "./fixtures.js";

describe.skipIf(skipIfNoUserDataDir)("FanqieClient (integration)", () => {
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

	it("getAuthorInfo 返回非空作者信息", async () => {
		const info = await client.getAuthorInfo();
		expect(info).toBeTruthy();
		expect(typeof info.id).toBe("string");
		expect(info.id.length).toBeGreaterThan(0);
		expect(typeof info.name).toBe("string");
	});

	it("listBooks 第 0 页能正常返回结构", async () => {
		const page = await client.listBooks(0, 10);
		expect(page).toBeTruthy();
		expect(typeof page.total_count).toBe("number");
		expect(Array.isArray(page.book_list)).toBe(true);
	});

	it("listAllBooks 拉取全量作品并支持 lazy 缓存", async () => {
		const all1 = await client.listAllBooks();
		const all2 = await client.listAllBooks();
		expect(Array.isArray(all1)).toBe(true);
		expect(all2).toBe(all1);
	});
});
