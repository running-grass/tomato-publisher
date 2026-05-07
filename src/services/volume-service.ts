import type { ChapterListResponse, VolumeInfo } from "../types";
import type { BookService } from "./book-service";
import { ChapterService } from "./chapter-service";

const ALL_CHAPTERS_PAGE_SIZE = 100;

/**
 * 卷级 Service：持有卷 ID 与卷元信息，管理章节集合。
 */
export class VolumeService {
	/** 全量章节 itemId 集合的 lazy 缓存（用于 `chapter(id)` 校验）。 */
	private _chapterIdSetPromise?: Promise<Set<string>>;

	/**
	 * 由 `BookService.volume(volumeId)` 工厂方法创建。
	 */
	constructor(
		public readonly book: BookService,
		public readonly info: VolumeInfo,
	) {}

	get volumeId(): string {
		return this.info.volumeId;
	}

	get volumeName(): string {
		return this.info.volume_name;
	}

	/**
	 * 按页获取章节列表（不缓存，按调用方分页参数返回）。
	 *
	 * @param pageIndex 从 0 开始的页码
	 * @param pageSize 每页数量
	 */
	async listChapters(
		pageIndex: number,
		pageSize: number,
	): Promise<ChapterListResponse> {
		return this.book.client.browser.readChapterList({
			bookId: this.book.bookId,
			volumeId: this.volumeId,
			pageIndex,
			pageCount: pageSize,
		});
	}

	private async getChapterIdSet(): Promise<Set<string>> {
		if (!this._chapterIdSetPromise) {
			this._chapterIdSetPromise = this.fetchAllChapterIds();
		}
		return this._chapterIdSetPromise;
	}

	private async fetchAllChapterIds(): Promise<Set<string>> {
		const ids = new Set<string>();
		let pageIndex = 0;
		while (true) {
			const page = await this.listChapters(pageIndex, ALL_CHAPTERS_PAGE_SIZE);
			const list = page.item_list ?? [];
			for (const c of list) {
				ids.add(c.itemId);
			}
			const totalCount = page.total_count ?? ids.size;
			if (
				list.length === 0 ||
				ids.size >= totalCount ||
				list.length < ALL_CHAPTERS_PAGE_SIZE
			) {
				break;
			}
			pageIndex += 1;
		}
		return ids;
	}

	/**
	 * 新建一个空白章节，返回对应的 `ChapterService`。
	 *
	 * - 由浏览器在作品管理页点击「新建章节」等触发 SPA
	 * - 写后失效本卷的章节 ID 缓存
	 */
	async addChapter(): Promise<ChapterService> {
		const data = await this.book.client.browser.createBlankChapter(
			this.book.bookId,
		);
		this._chapterIdSetPromise = undefined;
		return new ChapterService(this, data.itemId);
	}

	async rename(newName: string): Promise<void> {
		await this.book.modifyVolumes([
			{ volumeId: this.volumeId, volume_name: newName },
		]);
	}

	async delete(): Promise<void> {
		await this.book.deleteVolume(this.volumeId);
	}

	/**
	 * 通过 `itemId` 创建 `ChapterService`，构造时校验 ID 合法。
	 *
	 * @throws 当 `itemId` 不在当前卷的章节列表中
	 */
	async chapter(itemId: string): Promise<ChapterService> {
		const ids = await this.getChapterIdSet();
		if (!ids.has(itemId)) {
			throw new Error(
				`章节不存在: bookId=${this.book.bookId}, volumeId=${this.volumeId}, itemId=${itemId}`,
			);
		}
		return new ChapterService(this, itemId);
	}

	async refresh(): Promise<void> {
		this._chapterIdSetPromise = undefined;
	}
}
