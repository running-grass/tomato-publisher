/**
 * 将章节正文归一化为番茄编辑器使用的 `<p>HTML</p>` 段落串。
 *
 * - 若内容已经以 `<p>` 开头则原样返回（视为已是合法 HTML）
 * - 否则按行切分，剔除空行，每行包一对 `<p>...</p>`，段间以 `<p><br></p>` 分隔
 */
export function normalizeChapterContent(rawContent: string): string {
	if (rawContent.trim().startsWith("<p>")) {
		return rawContent;
	}
	const paragraphs = rawContent
		.split(/\r?\n/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);
	return paragraphs.map((p) => `<p>${p}</p>`).join("<p><br></p>");
}

/**
 * 把章节序号与标题拼接成番茄约定的展示格式：`第N章 标题`。
 */
export function formatChapterTitle(chapterNo: string, title: string): string {
	return `第${chapterNo}章 ${title}`.trim();
}
