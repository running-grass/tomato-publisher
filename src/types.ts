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
