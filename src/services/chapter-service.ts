import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PublishChapterParams, PublishChapterResponse } from "../types";
import {
	formatChapterTitle,
	normalizeChapterContent,
} from "../utils/chapter-content";
import type { VolumeService } from "./volume-service";

const URL_PUBLISH_ARTICLE =
	"https://fanqienovel.com/api/author/publish_article/v0";

/** `publish` 方法的入参。 */
export interface PublishArgs {
	/** 章节序号（纯数字字符串），用于格式化标题"第N章 ..."。 */
	chapterNo: string;
	/** 章节标题（不含"第N章"前缀）。 */
	title: string;
	/** 章节正文：纯文本（按行分段）或已是 `<p>` HTML，会自动归一化。 */
	content: string;
	/** 定时发布时间，秒级 Unix 时间戳；不传则立即发布。 */
	scheduledAt?: number;
}

/** `publishFromFile` 方法的入参。 */
export interface PublishFromFileArgs {
	/** 章节序号（纯数字字符串）。 */
	chapterNo: string;
	/** 章节标题（不含"第N章"前缀）。 */
	title: string;
	/** 定时发布时间，秒级 Unix 时间戳；不传则立即发布。 */
	scheduledAt?: number;
}

/**
 * 章节级 Service：持有章节 itemId，提供发布/保存能力。
 */
export class ChapterService {
	/**
	 * 由 `VolumeService.chapter(itemId)` / `VolumeService.addChapter()` 创建。
	 */
	constructor(
		public readonly volume: VolumeService,
		public readonly itemId: string,
	) {}

	/**
	 * 发布或保存章节内容。
	 *
	 * - 内容会自动归一化为 `<p>HTML</p>` 段落串
	 * - 标题会格式化为"第N章 ..."形式
	 *
	 * @returns 章节 ID 与格式化后的标题
	 */
	async publish(
		args: PublishArgs,
	): Promise<{ itemId: string; formattedTitle: string }> {
		const formattedTitle = formatChapterTitle(args.chapterNo, args.title);
		const content = normalizeChapterContent(args.content);

		const params: PublishChapterParams = {
			itemId: this.itemId,
			book_id: this.volume.book.bookId,
			volumeId: this.volume.volumeId,
			volume_name: this.volume.volumeName,
			title: formattedTitle,
			content,
			publish_status: 1,
			...(args.scheduledAt != null
				? { timer_status: 1, timer_time: args.scheduledAt }
				: {}),
		};

		const result = await this.publishChapterRaw(params);
		return { itemId: result.itemId, formattedTitle };
	}

	/**
	 * 从文件读取正文并发布章节。
	 *
	 * @param filePath 正文文件路径（相对 `process.cwd()` 或绝对路径）
	 */
	async publishFromFile(
		filePath: string,
		args: PublishFromFileArgs,
	): Promise<{ itemId: string; formattedTitle: string }> {
		const fullPath = resolve(process.cwd(), filePath);
		if (!existsSync(fullPath)) {
			throw new Error(`文件不存在: ${fullPath}`);
		}
		const content = readFileSync(fullPath, "utf8");
		return this.publish({
			chapterNo: args.chapterNo,
			title: args.title,
			content,
			...(args.scheduledAt != null ? { scheduledAt: args.scheduledAt } : {}),
		});
	}

	/** 直接调用番茄发布接口（内部）。 */
	private async publishChapterRaw(
		params: PublishChapterParams,
	): Promise<PublishChapterResponse> {
		return this.volume.book.client.http.postForm<PublishChapterResponse>(
			URL_PUBLISH_ARTICLE,
			{
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
			},
			"发布/保存章节失败",
		);
	}
}
