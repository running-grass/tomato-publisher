/**
 * 集成测试：由宿主显式提供 `userDataDir` / Chromium 路径（本仓库用环境变量便于本地开发，库内不默认读取）。
 */

export const userDataDir = process.env.FANQIE_USER_DATA_DIR ?? "";

export const chromiumPath = process.env.CHROMIUM_PATH ?? "";

export const TEST_BOOK_ID = process.env.FANQIE_TEST_BOOK_ID ?? "";

export const TEST_VOLUME_ID = process.env.FANQIE_TEST_VOLUME_ID ?? "";

export const skipIfNoUserDataDir = !userDataDir;

export const skipIfNoBookId = !userDataDir || !TEST_BOOK_ID;

export const skipIfNoVolumeId =
	!userDataDir || !TEST_BOOK_ID || !TEST_VOLUME_ID;
