/**
 * 集成测试公共 fixture。
 *
 * - 通过环境变量提供凭据与稳定的实测 ID
 * - 当 `FANQIE_COOKIE` 缺失时，集成测试将统一被 skip（详见 `skipIfNoCookie`）
 *
 * 写死项约定：
 * - `FANQIE_TEST_BOOK_ID`：测试账号下一本稳定存在的作品 ID
 * - `FANQIE_TEST_VOLUME_ID`：上述作品下一卷稳定存在的卷 ID
 *
 * 注：以上两个 ID 在 `book-service` 和 `volume-service` 测试里直接当作字符串字面量传入
 *     即可；这里仅做"环境变量可选透传"，避免必须改测试文件就能切换账号。
 */

export const cookie = process.env.FANQIE_COOKIE ?? "";

export const TEST_BOOK_ID = process.env.FANQIE_TEST_BOOK_ID ?? "";
export const TEST_VOLUME_ID = process.env.FANQIE_TEST_VOLUME_ID ?? "";

/**
 * 当未设置 `FANQIE_COOKIE` 时跳过集成测试。
 *
 * 用法：`describe.skipIf(skipIfNoCookie)("...", () => { ... })`
 */
export const skipIfNoCookie = !cookie;

/**
 * 当未设置 `FANQIE_TEST_BOOK_ID` 时跳过依赖具体 bookId 的用例。
 */
export const skipIfNoBookId = !cookie || !TEST_BOOK_ID;

/**
 * 当未设置 `FANQIE_TEST_VOLUME_ID` 时跳过依赖具体 volumeId 的用例。
 */
export const skipIfNoVolumeId = !cookie || !TEST_BOOK_ID || !TEST_VOLUME_ID;
