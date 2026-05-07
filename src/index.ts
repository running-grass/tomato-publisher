/**
 * `@running-grass/tomato-publisher` 公共入口。
 *
 * 链式使用示例：
 * ```ts
 * import { FanqieClient } from "@running-grass/tomato-publisher";
 *
 * const client = new FanqieClient({ cookie: process.env.FANQIE_COOKIE! });
 * const author = await client.getAuthorInfo();
 * const book = await client.book(bookId);          // 异步校验
 * const volume = await book.volume(volumeId);      // 异步校验
 * const chapter = await volume.addChapter();
 * await chapter.publish({ chapterNo: "1", title: "标题", content: "正文" });
 * ```
 */

export { BookService } from "./services/book-service";
export {
	ChapterService,
	type PublishArgs,
	type PublishFromFileArgs,
} from "./services/chapter-service";
export { FanqieClient } from "./services/fanqie-client";
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
