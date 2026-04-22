/** 对外导出：`fanqie-publish` 的本地配置类型。 */
export type { Config } from "./config.ts";
/** 对外导出：读取本地配置。 */
export { getConfig, saveConfig } from "./config.ts";

/** 对外导出：番茄作者后台接口的响应基础结构与数据类型。 */
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
} from "./service.ts";

/** 对外导出：番茄作者后台 API 客户端。 */
export { FanqieService } from "./service.ts";
