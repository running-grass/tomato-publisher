import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** `fanqie-publish` 本地配置目录（用户家目录下）。 */
const CONFIG_DIR = join(homedir(), ".config", "fanqie-publish");
/** `fanqie-publish` 本地配置文件路径。 */
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

/**
 * `fanqie-publish` 的本地配置（存放在用户目录下）。
 *
 * - 当前主要用于保存番茄作者后台 Cookie
 * - 字段可能为空（首次使用/未配置时）
 */
export interface Config {
	cookie?: string;
}

/**
 * 读取本地配置。
 *
 * @returns 配置对象；文件不存在或解析失败时返回空对象
 */
export function getConfig(): Config {
	if (!existsSync(CONFIG_FILE)) {
		return {};
	}
	try {
		const data = readFileSync(CONFIG_FILE, "utf-8");
		return JSON.parse(data);
	} catch (_err) {
		return {};
	}
}

/**
 * 保存本地配置（与已有配置做浅合并）。
 *
 * @param config 要写入的配置片段
 */
export function saveConfig(config: Config): void {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
	const current = getConfig();
	writeFileSync(
		CONFIG_FILE,
		JSON.stringify({ ...current, ...config }, null, 2),
		"utf-8",
	);
}
