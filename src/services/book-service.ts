import type {
	BookInfo,
	VolumeInfo,
	VolumeListResponse,
	VolumeModifyData,
} from "../types";
import type { FanqieClient } from "./fanqie-client";
import { VolumeService } from "./volume-service";

const URL_VOLUME_LIST =
	"https://fanqienovel.com/api/author/volume/volume_list/v1";
const URL_ADD_VOLUME =
	"https://fanqienovel.com/api/author/volume/add_volume/v0";
const URL_MODIFY_VOLUME = "https://fanqienovel.com/api/author/volume/modify/v0";
const URL_DELETE_VOLUME =
	"https://fanqienovel.com/api/author/volume/delete_volume/v0";

/**
 * 作品级 Service：持有作品 ID 与作品元信息，管理卷集合。
 */
export class BookService {
	/** 全量卷列表的 lazy 缓存（用于 `volume(id)` 校验复用）。 */
	private _volumeListPromise?: Promise<VolumeInfo[]>;

	/**
	 * 由 `FanqieClient.book(bookId)` 工厂方法创建；调用方一般不直接 `new`。
	 */
	constructor(
		public readonly client: FanqieClient,
		public readonly info: BookInfo,
	) {}

	get bookId(): string {
		return this.info.book_id;
	}

	/** 获取并缓存当前作品的全部卷信息。 */
	async listVolumes(): Promise<VolumeInfo[]> {
		if (!this._volumeListPromise) {
			this._volumeListPromise = this.fetchVolumeList();
		}
		return this._volumeListPromise;
	}

	private async fetchVolumeList(): Promise<VolumeInfo[]> {
		const data = await this.client.http.get<VolumeListResponse>(
			URL_VOLUME_LIST,
			{ book_id: this.bookId },
			"获取卷列表失败",
		);
		return data.volume_list ?? [];
	}

	/** 新增卷；写后失效卷列表缓存。 */
	async addVolume(volumeName: string): Promise<void> {
		await this.client.http.postForm<null>(
			URL_ADD_VOLUME,
			{ book_id: this.bookId, volume_name: volumeName },
			"新增卷失败",
		);
		this._volumeListPromise = undefined;
	}

	/** 修改卷信息（如卷名/顺序）；写后失效卷列表缓存。 */
	async modifyVolumes(volumeData: VolumeModifyData[]): Promise<void> {
		await this.client.http.postForm<null>(
			URL_MODIFY_VOLUME,
			{
				book_id: this.bookId,
				volume_data: JSON.stringify(volumeData),
			},
			"修改卷失败",
		);
		this._volumeListPromise = undefined;
	}

	/** 删除卷；写后失效卷列表缓存。 */
	async deleteVolume(volumeId: string): Promise<void> {
		await this.client.http.postForm<null>(
			URL_DELETE_VOLUME,
			{ book_id: this.bookId, volumeId },
			"删除卷失败",
		);
		this._volumeListPromise = undefined;
	}

	/**
	 * 通过 `volumeId` 创建 `VolumeService`，构造时校验 ID 合法。
	 *
	 * @throws 当 `volumeId` 不在当前作品的卷列表中
	 */
	async volume(volumeId: string): Promise<VolumeService> {
		const list = await this.listVolumes();
		const info = list.find((v) => v.volumeId === volumeId);
		if (!info) {
			throw new Error(`卷不存在: bookId=${this.bookId}, volumeId=${volumeId}`);
		}
		return new VolumeService(this, info);
	}

	/** 失效本级缓存（卷列表）。 */
	async refresh(): Promise<void> {
		this._volumeListPromise = undefined;
	}
}
