import jsQR from "jsqr";
import { PNG } from "pngjs";
import type { Frame, Page } from "puppeteer-core";

/** 从 PNG 缓冲区解码二维码内容（用于无头场景下终端展示）。 */
export function decodeQrFromPngBuffer(buffer: Buffer): string | null {
	let png: PNG;
	try {
		png = PNG.sync.read(buffer);
	} catch {
		return null;
	}
	const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, {
		inversionAttempts: "attemptBoth",
	});
	return code?.data ?? null;
}

/** 登录页扫码区二维码 `<img>`（番茄作家后台当前 class）。 */
const WRITER_LOGIN_QR_IMG_SELECTOR =
	"img.slogin-qrcode-scan-page__content__code__img";

/** 登录页二维码常见略小于 80×80，略放宽；过小多为装饰图标。 */
const MIN_QR_AREA = 44 * 44;

async function screenshotWriterLoginQrImg(
	frame: Frame,
): Promise<Buffer | null> {
	const h = await frame.$(WRITER_LOGIN_QR_IMG_SELECTOR);
	if (!h) return null;
	try {
		const raw = await h.screenshot({ type: "png" });
		return Buffer.from(raw);
	} catch {
		return null;
	} finally {
		await h.dispose().catch(() => {});
	}
}

async function extractQrFromFrame(frame: Frame): Promise<string | null> {
	const loginImgBuf = await screenshotWriterLoginQrImg(frame);
	if (loginImgBuf) {
		const fromImg = decodeQrFromPngBuffer(loginImgBuf);
		if (fromImg) return fromImg;
	}

	const handles = await frame.$$("canvas");
	const candidates: { buf: Buffer; area: number }[] = [];
	for (const h of handles) {
		const box = await h.boundingBox();
		if (!box) continue;
		const area = box.width * box.height;
		if (area < MIN_QR_AREA) continue;
		try {
			const buf = await h.screenshot({ type: "png" });
			candidates.push({ buf: Buffer.from(buf), area });
		} catch {
			// 离屏或零尺寸 canvas
		}
	}
	candidates.sort((a, b) => b.area - a.area);
	for (const c of candidates) {
		const s = decodeQrFromPngBuffer(c.buf);
		if (s) return s;
	}

	const dataUrl = await frame.evaluate((minArea) => {
		const imgs = [
			...document.querySelectorAll("img[src^='data:image']"),
		] as HTMLImageElement[];
		let best: HTMLImageElement | null = null;
		let bestA = 0;
		for (const im of imgs) {
			const w = im.naturalWidth || 0;
			const h = im.naturalHeight || 0;
			const a = w * h;
			if (a >= minArea && a > bestA) {
				bestA = a;
				best = im;
			}
		}
		return best?.src ?? null;
	}, MIN_QR_AREA);
	if (dataUrl?.startsWith("data:image/png;base64,")) {
		const b64 = dataUrl.slice("data:image/png;base64,".length);
		return decodeQrFromPngBuffer(Buffer.from(b64, "base64"));
	}
	return null;
}

/**
 * 截取登录二维码图（优先作家后台 `slogin-qrcode-scan-page__content__code__img`，否则最大 canvas）。
 */
export async function captureLargestCanvasPngFromPage(
	page: Page,
): Promise<Buffer | null> {
	for (const frame of page.frames()) {
		const loginImg = await screenshotWriterLoginQrImg(frame);
		if (loginImg) return loginImg;
	}

	let best: { buf: Buffer; area: number } | null = null;
	for (const frame of page.frames()) {
		const handles = await frame.$$("canvas");
		for (const h of handles) {
			const box = await h.boundingBox();
			if (!box) continue;
			const area = box.width * box.height;
			if (area < MIN_QR_AREA) continue;
			try {
				const raw = await h.screenshot({ type: "png" });
				const buf = Buffer.from(raw);
				if (!best || area > best.area) {
					best = { buf, area };
				}
			} catch {
				// skip
			}
		}
	}
	return best?.buf ?? null;
}

/**
 * 从当前页（含子 frame）上的 canvas / dataURL 解码；最后尝试视口整屏截图。
 */
export async function extractQrPayloadFromPage(
	page: Page,
): Promise<string | null> {
	for (const frame of page.frames()) {
		const fromFrame = await extractQrFromFrame(frame);
		if (fromFrame) return fromFrame;
	}

	try {
		const shot = await page.screenshot({ type: "png", fullPage: false });
		return decodeQrFromPngBuffer(Buffer.from(shot));
	} catch {
		return null;
	}
}
