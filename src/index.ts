/**
 * `@running-grass/tomato-publisher` 公共入口。
 *
 * ```ts
 * import { FanqieClient } from "@running-grass/tomato-publisher";
 *
 * const client = new FanqieClient({
 *   userDataDir: "/path/to/chrome-profile",
 *   executablePath: "/path/to/chromium",
 * });
 * try {
 *   const author = await client.getAuthorInfo();
 *   const book = await client.book(bookId);
 *   const volume = await book.volume(volumeId);
 *   const chapter = await volume.addChapter();
 *   await chapter.publish({ chapterNo: "1", title: "标题", content: "正文" });
 * } finally {
 *   await client.close();
 * }
 * ```
 */

export type { FanqieBrowserOptions } from "./browser/browser-options";
export { openChapterManageFromBookCard } from "./browser/chapter-manage-ui";
export { BookService } from "./services/book-service";
export {
	ChapterService,
	type PublishArgs,
	type PublishFromFileArgs,
} from "./services/chapter-service";
export {
	FanqieClient,
	type FanqieClientOptions,
} from "./services/fanqie-client";
export { VolumeService } from "./services/volume-service";
export type {
	AuthorInfo,
	BaseResponse,
	BookInfo,
	BookListResponse,
	ChapterInfo,
	ChapterListResponse,
	PublishChapterParams,
	PublishChapterResponse,
	VolumeInfo,
	VolumeListResponse,
	VolumeModifyData,
} from "./types";
export {
	formatChapterTitle,
	normalizeChapterContent,
} from "./utils/chapter-content";
