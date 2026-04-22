#!/usr/bin/env tsx
import { Command } from "commander";
import { getConfig, saveConfig } from "./config.ts";
import {
	type BookInfo,
	type ChapterInfo,
	FanqieService,
	type VolumeInfo,
	type VolumeModifyData,
} from "./service.ts";

const program = new Command();

program
	.name("fanqie-cli")
	.description("番茄小说作者常用功能 CLI")
	.version("1.0.0");

program
	.command("set-cookie")
	.description("设置番茄小说作者后台的 cookie")
	.argument("<cookie>", "Cookie 字符串")
	.action((cookie: string) => {
		saveConfig({ cookie });
		console.log("✅ Cookie 设置成功！");
	});

function getService(): FanqieService {
	const config = getConfig();
	if (!config.cookie) {
		console.error(
			"❌ 未设置 Cookie，请先运行: fanqie-cli set-cookie <your_cookie>",
		);
		process.exit(1);
	}
	return new FanqieService(config.cookie);
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

interface PaginationOptions {
	page: string;
	size: string;
}

interface PublishChapterOptions {
	itemId?: string;
	scheduledAt?: string;
}

program
	.command("get-info")
	.description("获取作者信息")
	.action(async () => {
		const service = getService();
		try {
			console.log("🔄 正在获取作者信息...");
			const authorInfo = await service.getAuthorInfo();

			console.log("\n===== 作者信息 =====");
			console.log(`👤 笔名: ${authorInfo.name}`);
			console.log(`🆔 ID: ${authorInfo.id}`);
			console.log(`📝 简介: ${authorInfo.desc}`);
			console.log(`📅 年龄: ${authorInfo.age}`);
			console.log(
				`🔑 连载权限: ${authorInfo.hasSerialPermission === 1 ? "是" : "否"}`,
			);
			console.log(`🌟 VIP: ${authorInfo.isVip ? "是" : "否"}`);
			console.log("====================\n");
		} catch (error: unknown) {
			console.error("❌ 请求出错:", getErrorMessage(error));
		}
	});

program
	.command("list-books")
	.description("获取作品列表")
	.option("-p, --page <number>", "页码", "1")
	.option("-s, --size <number>", "每页数量", "10")
	.action(async (options: PaginationOptions) => {
		const service = getService();
		const pageIndex = Math.max(0, parseInt(options.page, 10) - 1);
		const pageSize = parseInt(options.size, 10);

		try {
			console.log(`🔄 正在获取作品列表 (第 ${options.page} 页)...`);
			const bookData = await service.getBookList(pageIndex, pageSize);
			const books = bookData.book_list || [];

			console.log(
				`\n📚 共找到 ${bookData.total_count} 本作品 (本页展示 ${books.length} 本)`,
			);
			console.log("=".repeat(40));

			books.forEach((book: BookInfo, index: number) => {
				console.log(
					`\n📖 【${index + 1}】《${book.book_name}》 (ID: ${book.book_id})`,
				);
				console.log(
					`📝 字数: ${book.word_count} 字 | 章节: ${book.chapter_number} 章`,
				);
				console.log(
					`⏱️ 最新更新: ${book.last_chapter_title} (${new Date(parseInt(book.last_chapter_time, 10) * 1000).toLocaleString()})`,
				);

				const statusMap: Record<number, string> = { 1: "连载中", 2: "已完结" };
				console.log(
					`📊 状态: ${statusMap[book.creation_status] || "未知"} | 推荐评估: ${book.book_intro?.tag || "无"}`,
				);
				if (book.book_intro?.message) {
					const cleanMessage = book.book_intro.message.replace(/<[^>]+>/g, "");
					console.log(`💡 提示: ${cleanMessage}`);
				}
			});
			console.log(`\n${"=".repeat(40)}\n`);
		} catch (error: unknown) {
			console.error("❌ 请求出错:", getErrorMessage(error));
		}
	});

program
	.command("list-volumes")
	.description("获取作品的卷列表")
	.argument("<bookId>", "小说作品 ID")
	.action(async (bookId: string) => {
		const service = getService();
		try {
			console.log(`🔄 正在获取作品 ${bookId} 的卷列表...`);
			const volumeData = await service.getVolumeList(bookId);
			const volumes = volumeData.volume_list || [];

			console.log(`\n📚 共找到 ${volumes.length} 卷`);
			console.log("=".repeat(40));
			volumes.forEach((volume: VolumeInfo) => {
				console.log(
					`\n📁 【卷 ${volume.index}】${volume.volume_name} (ID: ${volume.volumeId})`,
				);
				console.log(
					`📝 章节: ${volume.item_count} 章 | 状态: ${volume.can_delete ? "可删除" : "不可删除"}`,
				);
			});
			console.log(`\n${"=".repeat(40)}\n`);
		} catch (error: unknown) {
			console.error("❌ 请求出错:", getErrorMessage(error));
		}
	});

program
	.command("list-chapters")
	.description("获取作品特定卷的章节列表")
	.argument("<bookId>", "小说作品 ID")
	.argument("<volumeId>", "卷 ID")
	.option("-p, --page <number>", "页码", "1")
	.option("-s, --size <number>", "每页数量", "15")
	.action(
		async (bookId: string, volumeId: string, options: PaginationOptions) => {
			const service = getService();
			const pageIndex = Math.max(0, parseInt(options.page, 10) - 1);
			const pageSize = parseInt(options.size, 10);

			try {
				console.log(
					`🔄 正在获取作品 ${bookId} 卷 ${volumeId} 的章节列表 (第 ${options.page} 页)...`,
				);
				const chapterData = await service.getChapterList(
					bookId,
					pageIndex,
					pageSize,
					volumeId,
				);
				const chapters = chapterData.item_list || [];

				console.log(
					`\n📚 共找到 ${chapterData.total_count} 章 (本页展示 ${chapters.length} 章)`,
				);
				console.log("=".repeat(40));

				chapters.forEach((chapter: ChapterInfo) => {
					console.log(
						`\n📄 【第 ${chapter.index} 章】${chapter.title} (ID: ${chapter.itemId})`,
					);
					console.log(
						`📝 字数: ${chapter.word_number} 字 | 价格: ${chapter.need_pay ? `${chapter.price} 金币` : "免费"}`,
					);
					console.log(
						`⏱️ 创建时间: ${new Date(parseInt(chapter.create_time, 10) * 1000).toLocaleString()}`,
					);

					const statusMap: Record<number, string> = {
						0: "草稿",
						1: "已发布",
						2: "定时发布",
					};
					console.log(
						`📊 状态: ${statusMap[chapter.article_status] || "未知"}`,
					);
				});
				console.log(`\n${"=".repeat(40)}\n`);
			} catch (error: unknown) {
				console.error("❌ 请求出错:", getErrorMessage(error));
			}
		},
	);

program
	.command("add-volume")
	.description("新增卷")
	.argument("<bookId>", "小说作品 ID")
	.argument("<volumeName>", "卷名称")
	.action(async (bookId: string, volumeName: string) => {
		const service = getService();
		try {
			console.log(`🔄 正在为作品 ${bookId} 添加新卷: ${volumeName}...`);
			await service.addVolume(bookId, volumeName);
			console.log("✅ 新增卷成功！");
		} catch (error: unknown) {
			console.error("❌ 新增卷失败:", getErrorMessage(error));
		}
	});

program
	.command("modify-volumes")
	.description("修改卷信息 (例如卷名、卷顺序)")
	.argument("<bookId>", "小说作品 ID")
	.argument(
		"<volumeDataJson>",
		'卷数据 JSON 字符串，例如：\'[{"volumeId":"...","volume_name":"..."}]\'',
	)
	.action(async (bookId: string, volumeDataJson: string) => {
		const service = getService();
		try {
			const volumeData = JSON.parse(volumeDataJson) as VolumeModifyData[];
			console.log(`🔄 正在为作品 ${bookId} 修改卷信息...`);
			await service.modifyVolume(bookId, volumeData);
			console.log("✅ 修改卷信息成功！");
		} catch (error: unknown) {
			console.error("❌ 修改卷信息失败:", getErrorMessage(error));
		}
	});

program
	.command("delete-volume")
	.description("删除卷")
	.argument("<bookId>", "小说作品 ID")
	.argument("<volumeId>", "要删除的卷 ID")
	.action(async (bookId: string, volumeId: string) => {
		const service = getService();
		try {
			console.log(`🔄 正在为作品 ${bookId} 删除卷 ${volumeId}...`);
			await service.deleteVolume(bookId, volumeId);
			console.log("✅ 删除卷成功！");
		} catch (error: unknown) {
			console.error("❌ 删除卷失败:", getErrorMessage(error));
		}
	});

program
	.command("publish-chapter")
	.description("发布章节（支持定时发布）")
	.argument("<bookId>", "小说作品 ID")
	.argument("<volumeId>", "卷 ID")
	.argument("<volumeName>", "卷名称")
	.argument("<chapterNo>", "章节编号，纯数字（如 16）")
	.argument("<title>", "章节标题")
	.argument("<contentFile>", "章节内容文本文件路径")
	.option("-i, --item-id <itemId>", "章节 ID (如果是修改已有章节则需要)")
	.option("--scheduled-at <seconds>", "定时发布时间（秒级 Unix 时间戳）")
	.action(
		async (
			bookId: string,
			volumeId: string,
			volumeName: string,
			chapterNo: string,
			title: string,
			contentFile: string,
			options: PublishChapterOptions,
		) => {
			const service = getService();
			try {
				console.log(`🔄 正在操作章节...`);
				const scheduledAt =
					options.scheduledAt != null ? Number(options.scheduledAt) : undefined;
				const { itemId, formattedTitle } = await service.publishChapterFromFile(
					bookId,
					volumeId,
					volumeName,
					chapterNo,
					title,
					contentFile,
					{
						itemId: options.itemId,
						...(scheduledAt != null &&
							!Number.isNaN(scheduledAt) && { scheduledAt }),
					},
				);
				const statusText =
					options.scheduledAt != null ? "设为定时发布" : "发布";
				console.log(
					`✅ 操作成功！章节 "${formattedTitle}" (ID: ${itemId}) 已${statusText}`,
				);
			} catch (error: unknown) {
				console.error("❌ 操作失败:", getErrorMessage(error));
			}
		},
	);

program
	.command("export-html")
	.description("将章节 Markdown 文件导出为番茄格式的 HTML")
	.argument("<inputFile>", "输入的 Markdown 文件路径")
	.argument("<outputFile>", "输出的 HTML 文件路径")
	.action((inputFile: string, outputFile: string) => {
		try {
			FanqieService.exportHtml(inputFile, outputFile);
			console.log(`✅ 导出成功: ${outputFile}`);
		} catch (error: unknown) {
			console.error("❌ 导出失败:", getErrorMessage(error));
		}
	});

program.parse();
