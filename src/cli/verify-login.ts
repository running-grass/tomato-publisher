/**
 * 验证「userDataDir」能否驱动作家后台读会话；可选无头终端扫码登录。
 *
 * 用法：
 *   FANQIE_USER_DATA_DIR=/path/to/profile pnpm verify-login
 *   pnpm verify-login --login
 *
 * 始终使用无头 Chromium；`--login` 时在终端显示网页二维码截图（chafa/viu）并输出字符二维码。
 */
import { parseArgs } from "node:util";
import QRCode from "qrcode";
import { FanqieClient } from "../services/fanqie-client";
import type { AuthorInfo } from "../types";
import { tryShowPngInTerminal } from "./terminal-image";

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

function printHelp(): void {
	console.log(`用法: pnpm verify-login [选项]

验证 Puppeteer + userDataDir 能否拉取作者信息与作品列表。

环境变量:
  FANQIE_USER_DATA_DIR  必填，Chromium 用户数据目录（扫码后会话写入此处）
  CHROMIUM_PATH         可选，puppeteer-core 用 Chromium 可执行文件路径

选项:
  --user-data-dir <路径>    覆盖 FANQIE_USER_DATA_DIR
  --chromium <路径>         覆盖 CHROMIUM_PATH
  --login                   无头模式下在终端打印二维码并完成扫码登录（写入上述目录）
  --login-timeout <秒>      与 --login 合用，最长等待时间（默认 600）
  --no-terminal-image       与 --login 合用：不在终端渲染网页截图（仍输出字符二维码）
  --json                    仅输出 JSON（便于脚本解析）；二维码与进度输出到 stderr
  -h, --help                显示本说明
`);
}

async function runLoginLoop(
	client: FanqieClient,
	log: (msg: string) => void,
	logQr: (msg: string) => void,
	deadlineMs: number,
	loginTimeoutSec: number,
	showWebQrInTerminal: boolean,
): Promise<AuthorInfo> {
	let lastPayload = "";
	while (Date.now() < deadlineMs) {
		const info = await client.browser.probeWriterSession(12_000);
		if (info) {
			return info;
		}
		const payload = await client.browser.extractLoginQrFromCurrentPage();
		if (payload && payload !== lastPayload) {
			lastPayload = payload;
			log(
				"请使用番茄/抖音 App 扫描下方二维码登录（终端二维码，无图形浏览器窗口）",
			);
			if (showWebQrInTerminal) {
				const preview = await client.browser.captureLoginQrPreviewPng();
				if (preview) {
					const ok = tryShowPngInTerminal(preview);
					if (!ok) {
						log(
							"（未能调用 chafa/viu 显示网页截图：可安装 chafa，例如 nix develop 已包含）",
						);
					}
				}
			}
			const art = await QRCode.toString(payload, {
				type: "terminal",
				small: true,
			});
			logQr(art);
		} else if (!payload) {
			log("未从页面识别到二维码，将重新进入工作台重试…");
		}
		await sleep(2500);
	}
	throw new Error(
		`扫码登录超时（已等待 ${loginTimeoutSec} 秒，可调大 --login-timeout）`,
	);
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2).filter((a) => a !== "--");
	if (argv.includes("--help") || argv.includes("-h")) {
		printHelp();
		process.exit(0);
	}

	const { values } = parseArgs({
		args: argv,
		options: {
			help: { type: "boolean", short: "h" },
			"user-data-dir": { type: "string" },
			chromium: { type: "string" },
			login: { type: "boolean" },
			"login-timeout": { type: "string" },
			"no-terminal-image": { type: "boolean" },
			json: { type: "boolean" },
		},
	});

	if (values.help) {
		printHelp();
		process.exit(0);
	}

	const userDataDir =
		values["user-data-dir"] ?? process.env.FANQIE_USER_DATA_DIR ?? "";
	const executablePath =
		values.chromium ?? process.env.CHROMIUM_PATH ?? undefined;

	if (!userDataDir) {
		console.error(
			"错误: 未设置 userDataDir。请设置 FANQIE_USER_DATA_DIR 或使用 --user-data-dir。",
		);
		printHelp();
		process.exit(1);
	}

	const loginTimeoutRaw = values["login-timeout"];
	const loginTimeoutSec =
		loginTimeoutRaw != null && loginTimeoutRaw !== ""
			? Number(loginTimeoutRaw)
			: 600;
	if (!Number.isFinite(loginTimeoutSec) || loginTimeoutSec < 1) {
		console.error("错误: --login-timeout 须为正数（秒）");
		process.exit(1);
	}
	const deadlineMs = Date.now() + loginTimeoutSec * 1000;

	const client = new FanqieClient({
		userDataDir,
		...(executablePath ? { executablePath } : {}),
		headless: true,
	});

	const log = values.json
		? (m: string) => {
				console.error(m);
			}
		: (m: string) => {
				console.log(m);
			};
	const logQr = values.json
		? (m: string) => {
				console.error(m);
			}
		: (m: string) => {
				console.log(m);
			};

	try {
		let author: AuthorInfo;
		if (values.login) {
			author = await runLoginLoop(
				client,
				log,
				logQr,
				deadlineMs,
				loginTimeoutSec,
				!values["no-terminal-image"],
			);
			log("扫码登录成功，正在拉取作品列表…");
		} else {
			author = await client.getAuthorInfo();
		}
		const booksPage = await client.listBooks(0, 5);

		if (values.json) {
			console.log(
				JSON.stringify(
					{
						ok: true,
						author: { id: author.id, name: author.name },
						books: {
							total_count: booksPage.total_count,
							first_page_count: booksPage.book_list?.length ?? 0,
							sample_titles: (booksPage.book_list ?? [])
								.slice(0, 3)
								.map((b) => b.book_name),
						},
					},
					null,
					2,
				),
			);
		} else {
			console.log("登录态与会话读取: 成功");
			console.log(`  作者: ${author.name} (id=${author.id})`);
			console.log(
				`  作品列表第 0 页: total_count=${booksPage.total_count}, 本页 ${booksPage.book_list?.length ?? 0} 本`,
			);
			const titles = (booksPage.book_list ?? [])
				.slice(0, 3)
				.map((b) => b.book_name);
			if (titles.length > 0) {
				console.log(`  示例书名: ${titles.join("；")}`);
			}
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		if (values.json) {
			console.log(JSON.stringify({ ok: false, error: message }, null, 2));
		} else {
			console.error("验证失败:", message);
		}
		process.exitCode = 1;
	} finally {
		await client.close();
	}
}

main();
