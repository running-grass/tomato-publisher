import axios, { type AxiosInstance } from "axios";
import type { BaseResponse } from "../types";

/**
 * 番茄作者后台接口的通用请求头。
 *
 * 部分字段为固定值/模拟浏览器 UA，用于通过后台接口的基础校验。
 */
const COMMON_HEADERS: Record<string, string> = {
	"x-secsdk-csrf-token":
		"00010000000183548efca1f3b1a48ccc5eca4f68bb89add0fcf280751edc08421f178138f749189b24dbb612efb5",
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	Accept: "application/json",
};

/**
 * 内部 HTTP 客户端：负责 Cookie 注入、公共参数/表单构造、错误归一化。
 *
 * - 仅在库内部使用，不对外导出
 * - 所有响应都按 `BaseResponse<T>` 解包，code !== 0 抛 `Error(message)`
 */
export class HttpClient {
	private readonly axios: AxiosInstance;

	constructor(cookie: string) {
		this.axios = axios.create({
			timeout: 10000,
			headers: {
				...COMMON_HEADERS,
				Cookie: cookie,
			},
		});
	}

	/** 在 GET 参数中追加公共字段（aid / app_name）。 */
	private buildGetParams(
		params: Record<string, string | number> = {},
	): Record<string, string | number> {
		return {
			...params,
			aid: "2503",
			app_name: "muye_novel",
		};
	}

	/** 构造带公共字段的 multipart/form-data。 */
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

	/** 发送 GET 请求并解包 `BaseResponse<T>`。 */
	async get<T>(
		url: string,
		params: Record<string, string | number> = {},
		errorPrefix = "请求失败",
	): Promise<T> {
		const response = await this.axios.get<BaseResponse<T>>(url, {
			params: this.buildGetParams(params),
			headers: COMMON_HEADERS,
		});
		const data = response.data;
		if (data.code !== 0) {
			throw new Error(data.message || errorPrefix);
		}
		return data.data;
	}

	/** 发送 POST(form-data) 请求并解包 `BaseResponse<T>`。 */
	async postForm<T>(
		url: string,
		params: Record<string, string | number | boolean> = {},
		errorPrefix = "请求失败",
	): Promise<T> {
		const formData = this.buildPostFormData(params);
		const response = await this.axios.post<BaseResponse<T>>(url, formData, {
			headers: COMMON_HEADERS,
		});
		const data = response.data;
		if (data.code !== 0) {
			throw new Error(data.message || errorPrefix);
		}
		return data.data;
	}
}
