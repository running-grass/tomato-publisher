import type {
	BookInfo,
	BookListResponse,
	ChapterInfo,
	ChapterListResponse,
	VolumeInfo,
	VolumeListResponse,
} from "../../src/types";

/** 单元测试用最小 `BookInfo`（字段齐全，值无业务含义）。 */
export function stubBook(bookId: string, bookName: string): BookInfo {
	return {
		book_name: bookName,
		book_id: bookId,
		status: 0,
		verify_status: 0,
		thumb_uri: "",
		category: "",
		create_time: "",
		author: "",
		abstract: "",
		genre: 0,
		price: 0,
		word_count: 0,
		sale_type: 0,
		read_count: 0,
		authorize_type: 0,
		sign_progress: 0,
		creation_status: 1,
		can_recommend: 0,
		origin_level: "",
		origin_app_level: 0,
		book_flight_alias_name: "",
		free_status: 0,
		last_chapter_time: "0",
		last_chapter_title: "",
		last_chapter_id: "",
		chapter_number: 0,
		total_impression_count: 0,
		add_bookshelf_count: 0,
		attend_day_count: 0,
		attend_word_count: 0,
		attend_need_word_count: 0,
		is_cp: 0,
		source: "",
		set_top: 0,
		has_hide: 0,
		has_activity: 0,
		activity_id: 0,
		activity_name: "",
		can_join_activity: false,
		can_join_activity_id: "",
		can_join_activity_name: "",
		can_join_activity_url: "",
		contract_status: 0,
		security_auditor_status: 0,
		security_status: 0,
		thumb_url_list: [],
		book_intro: { status: "", tag: "", message: "" },
		referral_traffic_permission: 0,
		referral_traffic_running_state: 0,
		in_attend_activity: 0,
		default_thumb_url: true,
		write_extra_permission: 0,
		content_word_number: 0,
		extra_word_number: 0,
		attend_brave_wind_task: 0,
		weak_ending: 0,
	};
}

/** 单元测试用最小 `VolumeInfo`。 */
export function stubVolume(
	bookId: string,
	volumeId: string,
	volumeName: string,
): VolumeInfo {
	return {
		index: 1,
		book_id: bookId,
		volumeId,
		volume_name: volumeName,
		item_count: 0,
		can_delete: true,
	};
}

/** 单元测试用最小 `ChapterInfo`。 */
export function stubChapterInfo(itemId: string, volumeId: string): ChapterInfo {
	return {
		itemId,
		volumeId,
		index: 1,
		title: "",
		recommend_title: "",
		recommend_editable: 0,
		display_status: 0,
		is_title_recommend: 0,
		recommend_count_limit: 0,
		recommend_count: 0,
		article_status: 0,
		recommend_status: 0,
		create_time: "0",
		need_pay: 0,
		price: 0,
		word_number: 0,
		timer_time: "",
		can_delete: 0,
		mp_highlight_stage: 0,
		sell_product_chapter: 0,
		cant_modify_reason: "",
		correction_feedback_num: 0,
		author_speak_audit_block: false,
		timer_chapter_preview: null,
	};
}

export function stubBookListResponse(
	books: BookInfo[],
	totalCount?: number,
): BookListResponse {
	return {
		total_count: totalCount ?? books.length,
		is_cp: 0,
		book_list: books,
		is_new_sign: 0,
		ExperienceLevel: 0,
		ExperienceInfo: "",
		author_risk: 0,
	};
}

export function stubVolumeListResponse(
	volumes: VolumeInfo[],
): VolumeListResponse {
	return { volume_list: volumes };
}

export function stubChapterListResponse(
	items: ChapterInfo[],
	totalCount?: number,
): ChapterListResponse {
	return {
		total_count: totalCount ?? items.length,
		total_fail_count: 0,
		book_genre: 0,
		item_list: items,
		book_status: 0,
		creation_status: 0,
		book_write_extra_permission: 0,
		book_extra_word_number: 0,
	};
}
