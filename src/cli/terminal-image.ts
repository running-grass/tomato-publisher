import { spawnSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * 在终端中显示 PNG（依赖本机 `chafa` 或 `viu`，将像素转为 Unicode/符号）。
 * 适用于「把网页截下来的图直接在终端里看见」。
 *
 * @returns 是否至少有一种工具成功执行
 */
export function tryShowPngInTerminal(png: Buffer): boolean {
	const path = join(
		tmpdir(),
		`tomato-terminal-img-${process.pid}-${Date.now()}.png`,
	);
	writeFileSync(path, png);
	try {
		const attempts: [string, ...string[]][] = [
			["chafa", path],
			["viu", path],
		];
		for (const args of attempts) {
			const [bin, ...rest] = args;
			const r = spawnSync(bin, rest, { stdio: "inherit" });
			if (r.status === 0) {
				return true;
			}
		}
	} finally {
		try {
			unlinkSync(path);
		} catch {
			/* 临时文件清理失败可忽略 */
		}
	}
	return false;
}
