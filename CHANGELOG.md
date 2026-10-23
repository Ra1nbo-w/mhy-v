# Changelog

## 仓库精简 — 四个工具合成一个、三个文档合成一个

源脚本没有改动，只减少仓库里的文件数量。

### 变更

- `tools/validate.cjs`、`test-ui.cjs`、`test-source-lifecycle.cjs`、`test-baozi-verification.cjs` 合并为 `tools/check.cjs`，一条命令跑完四套检查，CI 也只调这一个入口。
- `docs/source-maintenance.md`、`docs/ui-audit.md`、`docs/baozi-verification.md` 合并为根目录 `MAINTENANCE.md`，按「通用约定 / 各源要点 / 登录要点 / 版本要点 / 发现页核对 / 遗留」重排并去重。
- 删除 `all.json`：它与 `index.json` 内容完全相同，是上一轮为旧链接保留的别名。现在只保留一个索引入口。
- 删除 `NOTICE.md`：来源与许可说明并入 `README.md` 的「来源与许可」。
- 删除 `patches/`：那份应用端补丁是早期准备的可选改动，从未验证、也不属于源文件，容易让人以为安装源需要先打补丁。
- `README.md` 增加「文件」结构小节，维护命令改为单条 `node tools/check.cjs`。

### 已知限制

- 只导入过 `all.json` 的用户需要改用 `index.json` 重新导入一次（同 key 会原地更新）。

## 瓜子漫画 1.0.1 — 403 退避重试与图片自检

### 修复

- `html()` 对 `403` / `429` / `5xx` 退避重试两次（400ms、800ms），仍失败时把状态码和完整地址写进错误信息。批量下载会连续请求几十个章节页，站点有时把这种并发当成爬虫回 403；重试能挡掉偶发拦截，真被拦住时也能看出是哪一步。
- 网页请求与图片请求统一带 `Referer: https://www.guazimanhua.com/` 和移动端 UA（Android 14 + Chrome 141）。原先请求头里没有 UA，部分 CDN 边缘节点会按空 UA 直接 403。
- 设置页新增「图片请求检查」按钮：用阅读页同一套请求头试抓一张章节图，报出图片主机与 HTTP 状态，用来区分「源解析错了」和「这条网络被 CDN 拒绝」。

### 现场核对（2026-10-23）

- 封面与章节图分别测 `VeneraNext/1.18.0`、`Dart/3.x`、`node`、`curl`、Chrome、iPhone UA：全部 200；`Referer` 为空 / 站内 / 站外都 200；`HEAD` 200、`Range: bytes=0-1023` 206。
- 20 个章节页并发、40 张章节图并发：20/20、40/40 全部 200，单批 < 1.5s。
- 结论：服务端没有按 UA / Referer / 并发速率拦普通请求。若仍出现 403，优先怀疑本地网络出口（代理节点、DNS 落到受限边缘、运营商分流），先用新增按钮确认是图片侧还是网页侧。

## 索引合并（单入口）

源脚本没有改动，只整理了仓库结构。

### 变更

- `index.json` 合并为全部九个源，`optional.json` 删除；`all.json` 当时保留为内容完全相同的兼容别名、后来在「仓库精简」一轮删除。
- `tools/validate.cjs` 不再校验「index + optional」，改为「`all.json` 与 `index.json` 逐条深比较」+「索引条目数等于 `sources/` 下脚本数」，加源或删源不会再忘记改常量。
- `README.md` 去掉「默认源 / 可选源」两个入口和第二个链接，改成一张表加一个导入地址；维护说明同步。

### 已知限制

- 之前只导入过 `optional.json` 的用户，链接会失效，改用 `index.json` 或 `all.json` 重新导入一次即可。

## 1.0.0 — 新增「瓜子漫画」源

版本：瓜子漫画为 1.0.0（新源）；漫自由为 2.3.4；包子、漫画屋、漫蛙、MYCOMIC、Komiic 为 2.3.3；拷贝为 2.3.2；如漫画为 2.1.2。

### 新增

- 瓜子漫画（`guazimanhua.js`）：站点是 PHP 服务端渲染的模板站，全部走 HTML 与 JSON-LD，没有登录墙。
- 发现页四组：今日热门 `?sort=daily`、最近更新 `?sort=update`、高分榜 `?sort=score`、排行榜 `/top.php`，每片取前 6 部，「更多」跳到对应分类。
- 分类：23 个题材（`cid=41..27`）、连载中/已完结（`is_end=2|1`）、男频/女频（`audience=1|2`）、排序（`sort=daily|hits|update|score`）；排行页支持总榜/今日/本周/本月。
- 搜索走 `/category.php?keyword=`，翻页读站点 pager 的最大页码。
- 详情：JSON-LD `ComicStory` 提供封面、作者、简介与 `dateModified`，`.cinema-strip` 的「题材」行补题材，「更新信息」侧栏取日期与状态；目录取 `.mobile-chapter-grid` 的链接并反转成阅读顺序，章节键用站点章节 ID（`ep_<id>`）。
- 章节页取 `img.reading-image`，按 `data-page` 排序并去重；图片 CDN `img.guazicdn.com` 实测不需要 Referer。

### 工程

- `index.json` 登记新源并写入 `all.json`；`tools/validate.cjs` 的索引条目数改为与 `sources/` 脚本数一致。
- `README.md` 增加瓜子漫画行、能力矩阵行与「全部九源」表述；`docs/source-maintenance.md` 记录本站结构与选择器依据。

### 已知限制

- 模板站改版会让 `article.card`、`.cinema-strip`、`.mobile-chapter-grid` 等选择器失效，需要同步更新。
- 站点不提供 `updateTime` 之外的时间粒度，追更按天比较；分类与搜索的翻页上限由站点 pager 决定。

## 2.3.4 — 漫自由可以真的下载 EPUB / MOBI

版本：漫自由为 2.3.4；包子、漫画屋、漫蛙、MYCOMIC、Komiic 为 2.3.3；拷贝为 2.3.2；如漫画为 2.1.2。

### 修复

- 漫自由：`getDownloadUrl` 不再抛错，改为请求站点真正的前台接口 `POST https://mheee.com/m/vol/download_add`（表单 `ids[]=<卷ID>&ext=epub|mobi`，返回 `{result:[{url, file_name}]}`），由宿主把 EPUB / MOBI 下载到本地。未登录时站点返回 `4001002`，源内直接提示「请先在源设置的『登录』里登录漫自由网站账号」；触发每日额度时 `4001050` 会走通用错误信息。
- 漫自由：归档条目改成和普通章节列表一样干净——标题直接用站点原名（`第01卷` / `第01话`），去掉「（网页文件下载）」与那句固定的长副标题，副标题改为紧凑信息 `41頁 · EPUB 19M · MOBI 19M`。页数文案本身带「頁」，不再重复拼接。
- 漫自由：详情页描述删掉「卷目录」整段，只保留「怎么下载」和「本作共 N 卷」，作品页不再被卷列表撑长。
- 漫自由：新增设置项「下载格式」（EPUB / MOBI，默认 EPUB），影响归档下载请求的 `ext`。

### 工程

- `index.json` / `optional.json` / `all.json` 同步到 2.3.4；`tools/validate.cjs` 与四套离线回归保持通过。
- `docs/source-maintenance.md` 记录下载链路的实测依据（前台 `fileDownload()` 的请求格式与返回结构）。

### 已知限制

- 漫自由下载需要网站登录态：接口依赖登录 Cookie，Cookie 与内置 WebView 共享，所以先在源设置里走一次网页登录（或手动粘贴 `TSID`）。
- 漫自由仍是「整卷文件」而非分话：阅读按钮不可用，只能通过「下载 → 归档」取 EPUB / MOBI。

## 2.3.3 — 包子章节页与更新日期、标签补齐、登录入口

版本：包子、MYCOMIC、漫蛙、Komiic、漫画屋、漫自由为 2.3.3；拷贝为 2.3.2；如漫画为 2.1.2。

### 修复

- 包子：`loadEp` 不再只指向 `appcn.baozimh.com`。实测 `/user/page_direct` 会 302 到章节主机 `cn.cnbzmg.com/comic/chapter/<slug>/<section>_<chapter>.html`，页面里是 `<ul class="comic-contain">` 直接包 `<amp-img class="comic-contain__item" data-src>`，没有旧代码假设的 `.chapter-img` 中间层，旧选择器会取到 0 张图。现在按「登录同源章节页 → `cn.twbzmg.com` → `cn.cnbzmg.com` → appcn」依次尝试，选择器同时兼容两种结构，失败时把每个地址的原因拼进错误信息。
- 包子：`updateTime` 恢复。页面文本是 `(2026年06月28日 更新)`，原代码只去掉括号，末尾“更新”让 `^\d{4}...日?$` 校验必然失败，追更日期一直为空。
- 包子：`websiteOrigin` 承认两个章节镜像主机（只用于加 `Referer`/`cache-time` 和同一份 WebView UA，不搬 `__Host-` Cookie、不改登录入口）。挂代理访问时站点落到 `cn.twbzmg.com`，直连落到 `cn.cnbzmg.com`。
- MYCOMIC：搜索排序真正生效。三个选项写成 `"-id-最新上架"` 时，读者端按第一个 `-` 切分会让 key 全部塌成空串、只剩一个 chip，`options[0]` 恒为假值；改为 `id-最新上架` 等，并在 `load` 里补站点需要的降序前缀 `-`。
- MYCOMIC：恢复被覆盖时丢掉的 `loginWithCookies`（手动粘贴 `cf_clearance`）。原 `validate` 引用了未定义的 `headers`，异常被自身 `catch` 吞掉，验证永远返回 `false`；现在写入 Cookie 后用一次详情页请求判定成败。
- 漫画屋：登录入口从首页改为分类页 `https://mhua5.com/index.php/category/tags/6`。首页和详情页不触发 Cloudflare，原入口永远拿不到 `cf_clearance`，而分类页、进度页和「更多」在真机上必然是 403 挑战页。
- 漫画屋：详情页补 `题材` 标签（`a[href*="/index.php/category/tags/"]` 的链接文本）与既有 `作者` 并列。
- 漫蛙：详情页补 `题材` 标签。页面没有「题材」字样，只有指向 `/booklist/?tag=<题材>` 的链接。
- 拷贝：详情页补 `题材`（`theme=` 链接）、`状态`（「狀態」行）与 `updateTime`（「最後更新」行，繁体文案）。
- 漫自由：`loadInfo` 显式返回 `tags: {}`。文件站详情只有卷目录，缺 `tags` 会被宿主判成 `Invalid data`。
- 全部八个源：删除文件末尾的 `_checkedComic` 包装。它只兜底 `tags`，而包子/Komiic/MYCOMIC/如漫画/漫画屋本就返回标签，其余三源已改为显式返回；其中的 `instanceof Map` 分支在当前环境下永远不成立。

### 登录

- 包子：修掉网页登录永远不成功的根因。`checkStatus` 是普通函数却被宿主以 `source.account.loginWithWebview` 形式调用，`this` 指向配置对象而不是源实例，旧代码里的 `this.websiteOrigin(...)`、`this.loginHost`、`this.loadData(...)` 必抛 `TypeError`；现在统一使用 IIFE 闭包里的 `source`。同时在登录成功后回读 Cookie 并提示是否拿到 `TSID`，新增手动粘贴 `TSID` 的兜底入口与注册链接，删除已被覆盖、且引用着已删除 `settings.domains` 的旧 `account`。
- 漫画屋：网页登录入口本来是首页，首页不触发 Cloudflare 挑战，拿到的会话对分类页无效；改为打开分类页并加手动粘贴 `cf_clearance` 的兜底，登录成功回读 Cookie。
- 漫自由：旧 `checkStatus` 要求 `/m/user/(center|index)` 且标题含“漫自由”，但 `/m/user/center` 实为 404，未登录的 `/m/user/index` 本身就是登录表单，会在用户没登录时误判成功。现在要求标题不含 登录/注册/验证/404，并在 `onLoginSuccess` 里回读页面，仍带密码框就提示“没有确认到登录状态”。
- Komiic：网页登录只能拿到 Cookie，而 API 走 `Authorization: Bearer`。新增手动粘贴 `token` 的兜底（用 `query{account{id}}` 校验），账号密码登录成功后也立即用同一查询验证；网页登录的提示语改为“只用于过网站验证”，避免误解。
- MYCOMIC：`onLoginSuccess` 增加一次实际请求，命中 WAF 时直接告诉用户“站点仍拦截请求，可改用手动 `cf_clearance` 登录”；删除被覆盖的旧 `account`（其中 `validate` 引用了未定义的 `headers`）。
- 漫蛙、拷贝、如漫画没有加入登录入口，因为它们不需要：漫蛙章节页与图片不设登录墙（`/book/<id>/1/` 未登录也返回正文），拷贝的 `/login`、`/comic/*`、`/user` 返回同一份 SPA 外壳、标题恒为“拷貝漫畫”，无法据 URL/标题判断登录状态，如漫画走公开 HTTP 接口。
- 漫画屋、MYCOMIC、Komiic 各加一个设置页检查按钮：漫画屋直接请求分类页看是否还停在 Cloudflare 挑战、MYCOMIC 走一次站内请求看 WAF 是否放行、Komiic 用 `query{account{id}}` 校验已保存的 token。用户不必等到开新作品时才发现凭据没生效。

### 工程

- `.gitignore` 增加 `.audit/`、`.probe/`（线上核对用的临时克隆与探针脚本，不进入仓库）。
- `docs/source-maintenance.md` 记录本轮实测结论（包子章节主机与槽位、漫画屋路径级验证、MYCOMIC WAF）与仍需实机确认的项。

### 已知限制

- 包子的章节键仍是位置索引。实测目录是 `section_slot=0` + `chapter_slot=0..n` 连续槽位，站点没有稳定的章节 ID 可迁移；`chapter_slot` 与现有位置索引一一对应。
- 漫画屋分类页仍受 Cloudflare 托管挑战，源请求必须先在应用内网页过一次验证（登录入口已指向分类页）；首页与详情页直连不受影响。
- MYCOMIC 被 WAF 直接拒绝（403 `Sorry, you have been blocked`）时内置网页同样进不去，只能手动粘贴 `cf_clearance`。
- 漫蛙、漫画屋、MYCOMIC、漫自由仍没有可靠 `updateTime`（拷贝本轮已补）。
- 如漫画仍使用 HTTP，站点证书不匹配 `rumanhua2.com`，不能改 HTTPS。
- 包子的真实登录与读图仍需 Android/Windows 实机确认（章节页现在依赖网页主线 cookies）。

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
