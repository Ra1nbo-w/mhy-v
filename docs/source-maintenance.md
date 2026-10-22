# 漫画源维护记录

本文件按版本记录每次改动的原因与验证范围。没有依据的接口、站点限制和章节顺序保持原状，不在离线阶段猜测。

## 2.3.2 / 2.1.1（契约对齐）

这一轮的目标不是“多解析一个页签”，而是让源符合 VeneraNext 的源契约，并去掉会静默出错的结构。所有改动都能用离线测试证明，站点结构相关的不确定性在文末列出。

### 包子（2.3.2）

- 章节表从 `new Map()` 改为普通对象。键仍是位置索引（`0`、`1`…），因为当前解析拿不到稳定的章节 ID；在注释里标明这是待迁移项，不能当作长期方案。
- 删除“用最后一章标题伪造 `updateTime`”的分支。以前会把“第 100 话”做年/月/日替换后当成日期，追更比较的是乱码；现在只接受 `YYYY-MM-DD`，取不到就留空。
- `parseJsonComic` 与收藏列表项改用 `new Comic({ subtitle })`。契约只在 `Comic` 构造器里兼容 `subTitle` 别名，直接返回普通对象会让作者字段被丢掉。
- 分类参数先归一化 `String(param || 'all')`，避免 `param.startsWith` 在参数缺失时抛错。
- 页面内多处 `throw "字符串"` 改为 `throw new Error(...)`，错误信息才能进入应用日志与失败详情。

### MYCOMIC（2.3.2）

- 删除手写的 `Accept-Encoding: gzip, deflate, br`。客户端自己协商压缩才能保证透明解压，手写这一项可能拿到未解压的字节。
- Cloudflare 判定收紧：只有正文出现 `challenge-platform` 等特征，或 403/503 且响应体为空时才判为验证页。任意 403/503 都判验证会掩盖真实的地区限制和作品下架。
- 列表不再要求封面包含 `biccam.com/comics/`，章节图也不再锁定 `biccam.com/chapters/`。CDN 换域名后，原来的过滤会让整个列表或整章静默变空。
- 删除已被最终 `loadInfo` 完全覆盖的旧实现（文件从 851 行降到 746 行），避免两套解析逻辑继续漂移。
- 字符串抛错改为 `Error`。

### 漫蛙（2.3.2）

- `probe()` 的抽样作品改为“尽力确认”：抽样页打不开（作品下架、章节换 ID）时保留结构性校验结果，不再让整条线路直接失效；只有明确不是漫蛙站点时才停止切换。
- 缩略图从图片 URL 的 `#venera-manwa-ref=` 片段取线路，和正文图一致。原先读共享的 `activeBase`，并发加载时可能把 A 线路的 Referer 发给 B 线路的图片。

### 如漫画（2.1.1）

- 删除三处被文件末尾定义覆盖的重复实现（旧 `explore`、旧 `category`、旧 `decodeImages`），文件从 233 行降到 177 行。只保留实际生效的定义，减少“改了一处却没生效”的坑。

### 其他源

- Komiic（2.3.2）：`updateTime` 统一经 `dateOnly()` 输出 `YYYY-MM-DD`；接口若给带时间的 ISO 字符串，原样传给应用会被日期校验拒绝。
- 漫画屋（2.3.1）：22 个题材改为显式 ID 数组，让“标签 ID 6..27 连续”这个隐式假设直接可见；空作者不产生空标签；封面缺失返回空串；空关键词直接返回空页。注意：这没有消除站点增删题材后标签与 ID 错位的风险，只是不再藏在 `i + 6` 里。
- 拷贝（2.3.1）：UA 改为 `'VeneraNext/' + APP.version`，不再写死 `v1.18.0`；`pageSize` 统一 offset、limit 与 `maxPage`，修掉 `/recommend`、`/newest` 的 60 与 50 混用。
- 漫自由（2.3.1）：无分章时返回 `chapters: null` 而不是 `{}`；无封面返回空串而不是站点根地址；`getDownloadUrl` 不再先跳浏览器再抛错；`lastComic` 只在变化时写入；分类键用 `hasOwnProperty` 校验。

## 验证

- `tools/validate.cjs`：八个源语法与元数据，三份索引数量与顺序（`all.json` = `index.json` + `optional.json`），`sources/` 下无未登记脚本，`minAppVersion` 格式，以及三类契约错误（`new Map()`、抛字符串、缺失 `minAppVersion`）。
- `tools/test-ui.cjs`：发现页、分类、组合筛选及分页约定。
- `tools/test-baozi-verification.cjs`：首次安装、升级及登录回调约定。
- `tools/test-source-lifecycle.cjs`：正常/异常路径释放、HTTP 错误、图片地址、分类链接和账号切换并发场景；并断言 MYCOMIC 旧 `loadInfo` 已删除。
- `.github/workflows/validate.yml` 在每次 push 和 PR 上执行以上命令。

这些是离线模拟回归，不代替 Android/Windows 实机阅读、网站登录或下载验证。

## 遗留与需实机确认

- 包子的章节键仍是位置索引。迁移到站点章节 ID 需要先确认真实详情页结构，否则会让已有历史、下载和阅读位置指错章；这一步不应在离线阶段盲改。
- 包子、漫画屋、拷贝、MYCOMIC、漫自由目前没有可靠 `updateTime`，追更对这些源无效。补假日期比留空更糟。
- 章节顺序（新到旧 / 旧到新）只做了启发式反转，未逐站核对。
- 如漫画仍使用 HTTP；站点 HTTPS 证书问题解决前不强行切换。
- 漫蛙 `Network.get` 的 `connectTimeout`/`receiveTimeout` 选项当前不会被宿主读取（超时由应用统一设置），属于无效参数，未删是为了保留调用意图；后续确认后可移除。

## 2.3.1

- 包子与 MYCOMIC：为 13 处网页解析对象补 `try/finally` 释放。
- MYCOMIC：统一拒绝非 200 响应。
- 漫蛙：修复 `/booklist?tag=...` 编码与页码。
- Komiic：登录/退出清理图片票据，旧请求不回填。
- 包子：协议相对图片地址补 HTTPS；空章节返回明确错误。
