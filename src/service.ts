import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import axios, { type AxiosInstance } from "axios";

/**
 * 番茄作者后台接口的通用请求头。
 *
 * 说明：部分字段为固定值/模拟浏览器 UA，用于通过后台接口的基础校验。
 */
const commonHeaders: Record<string, string> = {
	"x-secsdk-csrf-token":
		"00010000000183548efca1f3b1a48ccc5eca4f68bb89add0fcf280751edc08421f178138f749189b24dbb612efb5",
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	Accept: "application/json",
};

/**
 * 番茄作者后台通用响应结构。
 *
 * @template T data 字段的具体类型
 */
export interface BaseResponse<T> {
	code: number;
	message: string;
	data: T;
	logId?: string;
	now?: number;
}

/** 作者信息（番茄作者后台接口返回）。 */
export interface AuthorInfo {
	avatar: string;
	name: string;
	id: string;
	desc: string;
	mediaId: string;
	isCp: number;
	hasSerialPermission: number;
	firstBookGender: number;
	hasAuthentication: number;
	mpHighlightAuto: number;
	isAuth: number;
	isGuardianAuth: number;
	age: number;
	type: string;
	isVip: boolean;
	playletStatus: number;
	goldTask: boolean;
	aiImageEntryVisible: boolean;
}

/** 作品信息（番茄作者后台接口返回）。 */
export interface BookInfo {
	book_name: string;
	book_id: string;
	status: number;
	verify_status: number;
	thumb_uri: string;
	category: string;
	create_time: string;
	author: string;
	abstract: string;
	genre: number;
	price: number;
	word_count: number;
	sale_type: number;
	read_count: number;
	authorize_type: number;
	sign_progress: number;
	creation_status: number;
	can_recommend: number;
	origin_level: string;
	origin_app_level: number;
	book_flight_alias_name: string;
	free_status: number;
	last_chapter_time: string;
	last_chapter_title: string;
	last_chapter_id: string;
	chapter_number: number;
	total_impression_count: number;
	add_bookshelf_count: number;
	attend_day_count: number;
	attend_word_count: number;
	attend_need_word_count: number;
	is_cp: number;
	source: string;
	set_top: number;
	has_hide: number;
	has_activity: number;
	activity_id: number;
	activity_name: string;
	can_join_activity: boolean;
	can_join_activity_id: string;
	can_join_activity_name: string;
	can_join_activity_url: string;
	contract_status: number;
	security_auditor_status: number;
	security_status: number;
	thumb_url_list: Array<{
		size: string;
		main_url: string;
		backup_url: string;
	}>;
	book_intro: {
		status: string;
		tag: string;
		message: string;
	};
	referral_traffic_permission: number;
	referral_traffic_running_state: number;
	in_attend_activity: number;
	default_thumb_url: boolean;
	write_extra_permission: number;
	content_word_number: number;
	extra_word_number: number;
	attend_brave_wind_task: number;
	weak_ending: number;
}

/** 作品列表响应（番茄作者后台接口返回）。 */
export interface BookListResponse {
	total_count: number;
	is_cp: number;
	book_list: BookInfo[];
	is_new_sign: number;
	ExperienceLevel: number;
	ExperienceInfo: string;
	author_risk: number;
}

/** 卷信息（番茄作者后台接口返回）。 */
export interface VolumeInfo {
	index: number;
	/** 作品 ID */
	book_id: string;
	/** 卷 ID */
	volumeId: string;
	/** 卷名称 */
	volume_name: string;
	/** 章节数量 */
	item_count: number;
	/** 是否可以删除 */
	can_delete: boolean;
}

/** 卷列表响应（番茄作者后台接口返回）。 */
export interface VolumeListResponse {
	volume_list: VolumeInfo[];
	[key: string]: unknown;
}

/** 章节信息（番茄作者后台接口返回）。 */
export interface ChapterInfo {
	itemId: string;
	volumeId: string;
	index: number;
	title: string;
	recommend_title: string;
	recommend_editable: number;
	display_status: number;
	is_title_recommend: number;
	recommend_count_limit: number;
	recommend_count: number;
	article_status: number;
	recommend_status: number;
	create_time: string;
	need_pay: number;
	price: number;
	word_number: number;
	timer_time: string;
	can_delete: number;
	mp_highlight_stage: number;
	sell_product_chapter: number;
	cant_modify_reason: string;
	correction_feedback_num: number;
	author_speak_audit_block: boolean;
	timer_chapter_preview: unknown;
}

/** 章节列表响应（番茄作者后台接口返回）。 */
export interface ChapterListResponse {
	total_count: number;
	total_fail_count: number;
	book_genre: number;
	item_list: ChapterInfo[];
	book_status: number;
	creation_status: number;
	book_write_extra_permission: number;
	book_extra_word_number: number;
}

/**
 * 发布/保存章节入参（番茄作者后台接口约定）。
 *
 * - `timer_status=1` 时需同时传 `timer_time`（秒级 Unix 时间戳）
 */
export interface PublishChapterParams {
	itemId?: string;
	book_id: string;
	volumeId: string;
	volume_name: string;
	title: string;
	content: string;
	/** 0=立即发布，1=定时发布 */
	timer_status?: number;
	/** 定时发布时间，秒级 Unix 时间戳；可为空，仅定时发布时必填 */
	timer_time?: number;
	publish_status?: number;
}

/** 发布/保存章节响应（番茄作者后台接口返回）。 */
export interface PublishChapterResponse {
	itemId: string;
	tips?: string;
}

/** 修改卷信息的数据项（番茄作者后台接口约定）。 */
export interface VolumeModifyData {
	volumeId: string;
	volume_name: string;
}

/** 新建章节接口的响应 data（内部使用）。 */
interface NewArticleResponse {
	itemId: string;
}

/**
 * 番茄作者后台 API 客户端。
 *
 * - 通过 Cookie 鉴权（调用方负责持久化 Cookie）
 * - 主要封装：查询作者/作品/卷/章节、创建/修改卷、发布章节
 */
export class FanqieService {
	private client: AxiosInstance;

	/**
	 * @param cookie 番茄作者后台 Cookie 字符串
	 */
	constructor(cookie: string) {
		this.client = axios.create({
			timeout: 10000,
			headers: {
				Cookie: cookie,
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				Accept: "application/json",
			},
		});
	}

	private buildGetParams(
		params: Record<string, string | number> = {},
	): Record<string, string | number> {
		return {
			...params,
			aid: "2503",
			app_name: "muye_novel",
		};
	}

	private buildPostFormData(
		params: Record<string, string | number | boolean> = {},
	): FormData {
		const formData = new FormData();
		formData.append("aid", "2503");
		formData.append("app_name", "muye_novel");

		for (const [key, value] of Object.entries(params)) {
			formData.append(key, String(value));
		}

		return formData;
	}

	/** 获取作者信息。 */
	async getAuthorInfo(): Promise<AuthorInfo> {
		const response = await this.client.get<BaseResponse<AuthorInfo>>(
			"https://fanqienovel.com/api/user/info/v2",
			{
				params: this.buildGetParams(),
			},
		);
		const data = response.data;
		if (data.code !== 0) {
			throw new Error(data.message || "获取作者信息失败");
		}
		return data.data;
	}

	/**
	 * 获取作品列表。
	 *
	 * @param pageIndex 从 0 开始的页码
	 * @param pageSize 每页数量
	 */
	async getBookList(
		pageIndex: number,
		pageSize: number,
	): Promise<BookListResponse> {
		const response = await this.client.get<BaseResponse<BookListResponse>>(
			"https://fanqienovel.com/api/author/book/book_list/v0",
			{
				params: this.buildGetParams({
					page_count: pageSize,
					page_index: pageIndex,
				}),
			},
		);
		const data = response.data;
		if (data.code !== 0) {
			throw new Error(data.message || "获取作品列表失败");
		}
		return data.data;
	}

	/**
	 * 获取作品的卷列表。
	 *
	 * @param bookId 作品 ID
	 */
	async getVolumeList(bookId: string): Promise<VolumeListResponse> {
		const response = await this.client.get<BaseResponse<VolumeListResponse>>(
			"https://fanqienovel.com/api/author/volume/volume_list/v1",
			{
				params: this.buildGetParams({
					book_id: bookId,
				}),
				headers: commonHeaders,
			},
		);
		const data = response.data;
		if (data.code !== 0) {
			throw new Error(data.message || "获取卷列表失败");
		}
		return data.data;
	}

	/**
	 * 获取作品某一卷的章节列表。
	 *
	 * @param bookId 作品 ID
	 * @param pageIndex 从 0 开始的页码
	 * @param pageSize 每页数量
	 * @param volumeId 卷 ID
	 */
	async getChapterList(
		bookId: string,
		pageIndex: number,
		pageSize: number,
		volumeId: string,
	): Promise<ChapterListResponse> {
		const response = await this.client.get<BaseResponse<ChapterListResponse>>(
			"https://fanqienovel.com/api/author/chapter/chapter_list/v1",
			{
				params: this.buildGetParams({
					book_id: bookId,
					page_index: pageIndex,
					page_count: pageSize,
					volumeId: volumeId,
				}),
				headers: commonHeaders,
			},
		);
		const data = response.data;
		if (data.code !== 0) {
			throw new Error(data.message || "获取章节列表失败");
		}
		return data.data;
	}

	/**
	 * 新增卷。
	 *
	 * @param bookId 作品 ID
	 * @param volumeName 卷名称
	 */
	async addVolume(bookId: string, volumeName: string): Promise<void> {
		const formData = this.buildPostFormData({
			book_id: bookId,
			volume_name: volumeName,
		});

		const response = await this.client.post<BaseResponse<null>>(
			"https://fanqienovel.com/api/author/volume/add_volume/v0",
			formData,
			{
				headers: commonHeaders,
			},
		);

		const data = response.data;
		console.log(formData, response.statusText, response.status);
		if (data.code !== 0) {
			throw new Error(data.message || "新增卷失败");
		}
	}

	/**
	 * 修改卷信息（如重命名/顺序等）。
	 *
	 * @param bookId 作品 ID
	 * @param volumeData 卷数据数组
	 */
	async modifyVolume(
		bookId: string,
		volumeData: VolumeModifyData[],
	): Promise<void> {
		const formData = this.buildPostFormData({
			book_id: bookId,
			volume_data: JSON.stringify(volumeData),
		});

		const response = await this.client.post<BaseResponse<null>>(
			"https://fanqienovel.com/api/author/volume/modify/v0",
			formData,
			{
				headers: commonHeaders,
			},
		);

		const data = response.data;
		if (data.code !== 0) {
			throw new Error(data.message || "修改卷失败");
		}
	}

	/**
	 * 删除卷。
	 *
	 * @param bookId 作品 ID
	 * @param volumeId 卷 ID
	 */
	async deleteVolume(bookId: string, volumeId: string): Promise<void> {
		const formData = this.buildPostFormData({
			book_id: bookId,
			volumeId: volumeId,
		});

		const response = await this.client.post<BaseResponse<null>>(
			"https://fanqienovel.com/api/author/volume/delete_volume/v0",
			formData,
			{
				headers: commonHeaders,
			},
		);

		const data = response.data;
		if (data.code !== 0) {
			throw new Error(data.message || "删除卷失败");
		}
	}

	/**
	 * 创建一个“空白章节”，返回章节 ID。
	 *
	 * 用于发布流程：先创建 itemId，再提交内容。
	 *
	 * @param bookId 作品 ID
	 * @returns 新章节的 itemId
	 */
	async createEmptyChapter(bookId: string): Promise<string> {
		const formData = this.buildPostFormData({
			book_id: bookId,
			need_reuse: 1,
		});

		const response = await this.client.post<BaseResponse<NewArticleResponse>>(
			"https://fanqienovel.com/api/author/article/new_article/v0/",
			formData,
			{
				headers: commonHeaders,
			},
		);

		const data = response.data;
		if (data.code !== 0) {
			throw new Error(data.message || "新建空白章节失败");
		}
		return data.data.itemId;
	}

	/**
	 * 发布/保存章节（直接传入 HTML 内容）。
	 *
	 * @param params 发布参数（含卷/标题/内容与可选定时字段）
	 * @returns 发布结果（含 itemId）
	 */
	async publishChapter(
		params: PublishChapterParams,
	): Promise<PublishChapterResponse> {
		const formData = this.buildPostFormData({
			itemId: params.itemId || "",
			book_id: params.book_id,
			content: params.content,
			timer_status: params.timer_status ?? 0,
			need_pay: 0,
			volume_name: params.volume_name,
			volumeId: params.volumeId,
			title: params.title,
			timer_time: params.timer_time != null ? String(params.timer_time) : "",
			publish_status: 1,
			device_platform: "pc",
			speak_type: 0,
			use_ai: 2,
			timer_chapter_preview: "[]",
			has_chapter_ad: false,
			chapter_ad_types: "",
		});

		const response = await this.client.post<
			BaseResponse<PublishChapterResponse>
		>("https://fanqienovel.com/api/author/publish_article/v0", formData, {
			headers: commonHeaders,
		});

		const data = response.data;
		if (data.code !== 0) {
			throw new Error(data.message || "发布/保存章节失败");
		}
		return data.data;
	}

	/**
	 * 从文件读取章节内容并发布（可选定时）。
	 *
	 * - 输入文件支持“纯文本段落”或已是番茄格式的 `<p>` HTML
	 * - 当未传 `itemId` 时会自动创建空白章节
	 *
	 * @param bookId 作品 ID
	 * @param volumeId 卷 ID
	 * @param volumeName 卷名称
	 * @param chapterNo 章节序号（纯数字字符串）
	 * @param title 章节标题（不含“第X章”前缀）
	 * @param contentFile 章节内容文件路径（相对 `process.cwd()` 或绝对路径）
	 * @param options 可选项：指定已存在的 `itemId` 或定时发布时间（秒级 Unix 时间戳）
	 * @returns 操作后的章节 ID 与格式化标题
	 */
	async publishChapterFromFile(
		bookId: string,
		volumeId: string,
		volumeName: string,
		chapterNo: string,
		title: string,
		contentFile: string,
		options: { itemId?: string; scheduledAt?: number } = {},
	): Promise<{ itemId: string; formattedTitle: string }> {
		const fullPath = resolve(process.cwd(), contentFile);
		if (!existsSync(fullPath)) {
			throw new Error(`文件不存在: ${fullPath}`);
		}

		let content = readFileSync(fullPath, "utf8");

		if (!content.trim().startsWith("<p>")) {
			const paragraphs = content
				.split(/\r?\n/)
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
			content = paragraphs.map((p) => `<p>${p}</p>`).join("<p><br></p>");
		}

		const formattedTitle = `第${chapterNo}章 ${title}`.trim();

		let itemId = options.itemId;
		if (!itemId) {
			itemId = await this.createEmptyChapter(bookId);
		}

		const isScheduled = options.scheduledAt != null;
		const response = await this.publishChapter({
			book_id: bookId,
			volumeId: volumeId,
			volume_name: volumeName,
			title: formattedTitle,
			content: content,
			itemId: itemId,
			publish_status: 1,
			...(isScheduled && {
				timer_status: 1,
				timer_time: options.scheduledAt,
			}),
		});

		return { itemId: response.itemId, formattedTitle };
	}

	/**
	 * 将 Markdown（或带 YAML Frontmatter 的 Markdown）导出为番茄编辑器可用的段落 HTML。
	 *
	 * - 会忽略以 `#` 开头的行（标题行）
	 * - 输出以 `<p>` 段落组织，并用 `<p><br></p>` 作为段间空行
	 *
	 * @param inputFile 输入文件路径（相对 `process.cwd()` 或绝对路径）
	 * @param outputFile 输出 HTML 文件路径（相对 `process.cwd()` 或绝对路径）
	 */
	static exportHtml(inputFile: string, outputFile: string): void {
		const fullInputPath = resolve(process.cwd(), inputFile);
		const fullOutputPath = resolve(process.cwd(), outputFile);
		if (!existsSync(fullInputPath)) {
			throw new Error(`文件不存在: ${fullInputPath}`);
		}

		const content = readFileSync(fullInputPath, "utf8");

		let textContent = content;
		if (textContent.startsWith("---")) {
			const match = textContent.match(
				/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/,
			);
			if (match?.[1]) {
				textContent = match[1];
			}
		}

		const paragraphs = textContent
			.split(/\r?\n/)
			.map((p) => p.trim())
			.filter((p) => p.length > 0 && !p.startsWith("#"));
		let htmlContent = "";
		if (paragraphs.length > 0) {
			htmlContent =
				paragraphs.map((p) => `<p>${p}</p>`).join("<p><br></p>") +
				"<p><br></p>";
		}

		writeFileSync(fullOutputPath, htmlContent, "utf8");
	}
}
