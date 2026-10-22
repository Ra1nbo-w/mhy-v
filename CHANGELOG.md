# Changelog

## 2.3.2 / 2.1.1 — 契约对齐

### 修复

- 包子：章节表从 `Map` 改为普通对象；删除用最后章节标题伪造 `updateTime` 的分支，只接受 `YYYY-MM-DD`；JSON 漫画与收藏项改用 `new Comic({ subtitle })`；分类参数缺失时不再抛 `TypeError`；字符串抛错改为 `Error`。
- MYCOMIC：移除手写 `Accept-Encoding`；Cloudflare 判定只在正文命中特征或 403/503 空响应时成立；列表与章节图不再绑定 `biccam.com` 域名；删除被最终实现覆盖的旧 `loadInfo`（851 → 746 行）；字符串抛错改为 `Error`。
- 漫蛙：抽样作品下架不再让整条线路失效；缩略图按 URL 中的线路片段取 Referer，避免并发时用错线路。
- 如漫画：删除三处被文件末尾覆盖的重复定义（233 → 177 行）。
- Komiic：`updateTime` 统一为 `YYYY-MM-DD`。
- 漫画屋：题材 ID 改为显式数组（把“ID 连续”的假设显式化，未消除站点增删题材后的错位风险）；空作者不产生空标签；空关键词搜索直接返回空页。
- 拷贝：UA 使用 `APP.version`；统一分页的 offset/limit/`maxPage`。
- 漫自由：无分章返回 `chapters: null`；无封面返回空串；`getDownloadUrl` 不再先跳浏览器再抛错；`lastComic` 写去重；分类键校验 `hasOwnProperty`。

### 工程

- `tools/validate.cjs` 增加：`all.json` 必须等于 `index.json + optional.json` 的顺序快照、`sources/` 无孤儿脚本、`minAppVersion` 格式、禁止 `new Map()` 与抛字符串。
- 新增 `.github/workflows/validate.yml`，push / PR 自动跑校验与三个离线回归测试。
- README 增加能力矩阵（发现、分类、搜索、追更、登录、下载、章节 ID 依据）与补丁说明。
- `docs/source-maintenance.md` 补全 2.3.2 变更原因、验证范围与遗留项。

### 已知限制

- 包子的章节键仍是位置索引，迁移到站点章节 ID 需要实机确认。
- 漫蛙、漫画屋、拷贝、MYCOMIC、漫自由没有可靠 `updateTime`，追更对这些源无效。
- 如漫画仍使用 HTTP。
