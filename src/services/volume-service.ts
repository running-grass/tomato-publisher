import type { ChapterListResponse, VolumeInfo } from "../types";
import type { BookService } from "./book-service";
import { ChapterService } from "./chapter-service";

const URL_CHAPTER_LIST =
	"https://fanqienovel.com/api/author/chapter/chapter_list/v1";
const URL_NEW_ARTICLE =
	"https://fanqienovel.com/api/author/article/new_article/v0/";

const ALL_CHAPTERS_PAGE_SIZE = 100;

interface NewArticleResponse {
	itemId: string;
}

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
		return this.book.client.http.get<ChapterListResponse>(
			URL_CHAPTER_LIST,
			{
				book_id: this.book.bookId,
				page_index: pageIndex,
				page_count: pageSize,
				volumeId: this.volumeId,
			},
			"获取章节列表失败",
		);
	}

	/**
	 * 拉取并缓存当前卷的全部章节 itemId 集合，供 `chapter(id)` 校验。
	 */
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
	 * - 内部调用番茄"新建空白章节"接口（`new_article/v0/`）
	 * - 写后失效本卷的章节 ID 缓存
	 */
	async addChapter(): Promise<ChapterService> {
		const data = await this.book.client.http.postForm<NewArticleResponse>(
			URL_NEW_ARTICLE,
			{ book_id: this.book.bookId, need_reuse: 1 },
			"新建空白章节失败",
		);
		this._chapterIdSetPromise = undefined;
		return new ChapterService(this, data.itemId);
	}

	/** 重命名当前卷（委托父级 `book.modifyVolumes`）。 */
	async rename(newName: string): Promise<void> {
		await this.book.modifyVolumes([
			{ volumeId: this.volumeId, volume_name: newName },
		]);
	}

	/** 删除当前卷（委托父级 `book.deleteVolume`）。 */
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

	/** 失效本级缓存（章节 ID 集合）。 */
	async refresh(): Promise<void> {
		this._chapterIdSetPromise = undefined;
	}
}
