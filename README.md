# @running-grass/tomato-publisher

番茄小说**作家后台**的 **TypeScript 库**（非应用）：通过 **Puppeteer（puppeteer-core）** 驱动已写入 **`userDataDir` 的 Chromium Profile**（有头扫码登录一次即可），在**真实页面会话**中完成操作。

- **读数据**：只导航作家后台 **页面 URL**（如工作台、作品管理、章节壳页），由 SPA 自行发起 XHR；库在 Node 侧 **`waitForResponse`** 匹配响应并解析，**不对外**提供按 REST URL 调用的 `get`/`postForm`。
- **写数据**：**点击 / 填表** 触发 SPA POST，同样用 **`waitForResponse`** 校验；**不在** `page.evaluate` 里调用 `fetch`。
- Service 链：`FanqieClient → BookService → VolumeService → ChapterService`。
- **库不假设** `chapters/`、`uploaded/`、`process.cwd()` 等业务目录；`publishFromFile` 仅支持绝对路径，或搭配 **`FanqieClientOptions.fileReadBaseDir`**。

## 安装

包发布在 GitHub Packages，需配置 `.npmrc`（参见仓库说明）。要求 Node **>= 20**，本机或 CI 需提供 **Chromium** 可执行文件。

## 使用

```ts
import { FanqieClient } from "@running-grass/tomato-publisher";

const client = new FanqieClient({
  userDataDir: "/path/to/chrome-profile-with-login",
  executablePath: "/path/to/chromium",
  headless: true,
  writerShellUrl: "https://fanqienovel.com/main/writer",
  bookManageUrlTemplate: "https://fanqienovel.com/main/writer/book/{bookId}",
  bookChapterShellUrlTemplate:
    "https://fanqienovel.com/main/writer/book/{bookId}/chapter",
  navigationTimeout: 90_000,
  actionTimeout: 45_000,
  maxRetries: 2,
  declareAiAssist: "none",
});

try {
  const author = await client.getAuthorInfo();
  const book = await client.book(bookId);
  const volume = await book.volume(volumeId);
  const chapter = await volume.addChapter();
  await chapter.publish({
    chapterNo: "1",
    title: "标题",
    content: "正文",
  });
} finally {
  await client.close();
}
```

### `FanqieClientOptions`（节选）

| 字段 | 说明 |
|------|------|
| `userDataDir` | 已登录作家后台的 Chromium 用户数据目录（必填） |
| `executablePath` | Chromium 路径；不设时可依赖运行环境的 `CHROMIUM_PATH`（仍建议由宿主显式传入） |
| `initialUrl` | 首次启动导航，默认 `https://fanqienovel.com/` |
| `writerShellUrl` | 作家工作台 **页面**（非 API），默认 `.../main/writer` |
| `bookManageUrlTemplate` | 作品管理 **页面**，`{bookId}` 占位 |
| `bookChapterShellUrlTemplate` | 章节列表壳 **页面**，`{bookId}` 占位 |
| `navigationTimeout` / `actionTimeout` / `maxRetries` | 导航、交互、失败重试 |
| `screenshotDir` / `onBrowserError` | 失败截图目录或回调（库不写死相对路径文件名） |
| `declareAiAssist` | `"none"` \| `"no"` \| `"yes"`，尝试在发布面板勾选 AI 申报（依赖页面结构） |
| `fileReadBaseDir` | 供 `publishFromFile` 解析相对路径 |

**定时发布**：当前 `publish({ scheduledAt })` 会抛出「尚未在 UI 流程中实现」。

## Nix（可复现 devShell）

```bash
nix develop   # 提供 nodejs、pnpm、chromium，并设置 CHROMIUM_PATH
pnpm install
pnpm test
```

## 开发

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

集成测试需 `FANQIE_USER_DATA_DIR`（及推荐 `CHROMIUM_PATH`）、可选 `FANQIE_TEST_BOOK_ID` / `FANQIE_TEST_VOLUME_ID`。破坏性写测另设 **`FANQIE_E2E_WRITE=1`** 才运行 `chapter-publish.e2e.test.ts`。

## 与开源参考项目的关系

流程与交互细节对齐 [fanqie_auto_publish](https://github.com/hchcx/fanqie_auto_publish)、[fanqie-publisher](https://github.com/rockbenben/fanqie-publisher) 的**行为级**经验（遮罩、编辑器就绪、日字数上限等），本库用 **Puppeteer** 与 **可注入 options** 重写，不复制其目录布局或 Python 代码。
