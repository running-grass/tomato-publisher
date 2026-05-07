# @running-grass/tomato-publisher

番茄小说作者后台 API 客户端库。仅作为 Node 库提供，链式 Service 设计：`FanqieClient → BookService → VolumeService → ChapterService`。

- 多级 Service：每一级持有上一级 Service 的引用与本级元信息
- 工厂方法均为异步，构造时即校验 ID 合法性
- 父级在内部 lazy 缓存子列表（用于校验复用），写操作后自动失效，可通过 `refresh()` 主动失效
- 仅 ESM 产物（tsc 直出 `dist/*.js` + `*.d.ts`）

## 安装

包发布在 GitHub Packages npm 仓库，需要先在项目根目录配置 `.npmrc`：

```ini
@running-grass:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

`GITHUB_TOKEN` 需要至少 `read:packages` 权限。

```bash
pnpm add @running-grass/tomato-publisher
```

要求 Node.js `>= 20`。

## 快速使用

```ts
import { FanqieClient } from "@running-grass/tomato-publisher";

const client = new FanqieClient({ cookie: process.env.FANQIE_COOKIE! });

const author = await client.getAuthorInfo();
console.log(author.name);

const book = await client.book(bookId);          // 校验 bookId
const volume = await book.volume(volumeId);      // 校验 volumeId
const page = await volume.listChapters(0, 15);

const chapter = await volume.addChapter();
await chapter.publish({
  chapterNo: "1",
  title: "标题",
  content: "第一段内容\n\n第二段内容",
});
```

## API 概览

### `FanqieClient`

| 方法 | 说明 |
|------|------|
| `new FanqieClient({ cookie })` | 创建客户端 |
| `getAuthorInfo()` | 作者信息（不缓存） |
| `listBooks(pageIndex, pageSize)` | 按页查询作品（不缓存） |
| `listAllBooks()` | 全量作品（lazy 缓存） |
| `book(bookId)` | 异步工厂，校验后返回 `BookService` |
| `refresh()` | 失效全量作品缓存 |

### `BookService`

| 方法 | 说明 |
|------|------|
| `info: BookInfo` / `bookId` | 构造时由父级注入 |
| `listVolumes()` | 卷列表（lazy 缓存） |
| `addVolume(name)` / `modifyVolumes(data)` / `deleteVolume(id)` | 写操作后自动失效卷列表缓存 |
| `volume(volumeId)` | 异步工厂，校验后返回 `VolumeService` |
| `refresh()` | 失效本级缓存 |

### `VolumeService`

| 方法 | 说明 |
|------|------|
| `info: VolumeInfo` / `volumeId` / `volumeName` | 构造时由父级注入 |
| `listChapters(pageIndex, pageSize)` | 按页查询章节（不缓存） |
| `addChapter()` | 新建空白章节并返回 `ChapterService` |
| `chapter(itemId)` | 异步工厂，校验后返回 `ChapterService` |
| `rename(newName)` / `delete()` | 委托父级对应方法 |
| `refresh()` | 失效章节 ID 集合缓存 |

### `ChapterService`

| 方法 | 说明 |
|------|------|
| `volume: VolumeService` / `itemId` | 父级与本级 ID |
| `publish({ chapterNo, title, content, scheduledAt? })` | 发布或保存章节（内容自动归一化为 `<p>HTML</p>`） |
| `publishFromFile(filePath, args)` | 从文件读正文后调 `publish` |

### 工具函数

- `formatChapterTitle(chapterNo, title)` / `normalizeChapterContent(raw)`：内部用同名工具，外部也可单独使用

## 开发

```bash
pnpm install
pnpm typecheck     # tsc --noEmit（包含 tests/）
pnpm build         # tsc 输出 dist/
pnpm test          # 运行集成测试（无凭据自动 skip）
```

### 集成测试

集成测试会真实调用番茄作者后台。设置以下环境变量后再跑：

| 变量 | 用途 |
|------|------|
| `FANQIE_COOKIE` | 必填；未设置时所有集成测试自动 skip |
| `FANQIE_TEST_BOOK_ID` | 选填；未设置时跳过 BookService/VolumeService 用例 |
| `FANQIE_TEST_VOLUME_ID` | 选填；未设置时跳过 VolumeService 用例 |

```bash
FANQIE_COOKIE='xxx' FANQIE_TEST_BOOK_ID='123' FANQIE_TEST_VOLUME_ID='456' pnpm test
```

CI 不跑集成测试（仅 `typecheck` + `build`），避免对线上接口产生依赖。

## 发布

打 `v*` 标签会触发 [release.yml](.github/workflows/release.yml) 工作流，使用 `GITHUB_TOKEN` 发布到 GitHub Packages。

```bash
pnpm version patch           # 或 minor / major
git push --follow-tags
```
