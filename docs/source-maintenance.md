# 漫画源维护记录

本文件按版本记录每次改动的原因与验证范围。没有依据的接口、站点限制和章节顺序保持原状，不在离线阶段猜测。

## 1.0.0（新增瓜子漫画）

`guazimanhua.js` 是新源，不是改造旧源。站点是 PHP 服务端渲染的静态模板（`/comic.php?id=`、`/chapter.php?id=`、`/category.php?cid=`），没有登录墙、没有 Cloudflare 挑战，抓到的 HTML 直接可解析。

### 结构依据（2026-10-23 实测）

- 列表卡片：`<article class="card"><a class="cover-wrap" href="/comic.php?id=23127"><img class="cover" …><span class="score">8.9</span><span class="genre">连载</span></a><h3><a …>大象无形</a></h3><div class="meta">番奇动漫 · 热血 · 都市</div></article>`；翻页在 `nav.pager`，链接形如 `/category.php?cid=13&page=2`。
- 分类筛选参数：`cid`（23 个题材）、`is_end=1|2`（完结/连载）、`audience=1|2`（男频/女频）、`city`（地区）、`sort=update|hits|daily|score`；搜索是 `GET /category.php?keyword=`。
- 详情页：JSON-LD `ComicStory` 带 `name / author.name / image / description / dateModified`；`.cinema-strip > div` 是「作者｜分类｜题材｜热度｜最新」信息行；`section.side-card` 里标题为「更新信息」的那张卡片正文是 `更新时间：…<br>最新章节：…<br>章节总数：…<br>状态：…`。
- 章节目录：`.mobile-chapter-grid` 内是 `<a class="new" href="/chapter.php?id=2559326">86 出发去京城</a>`，站点按新到旧排列（实测 87 条，最后一条是 `0 预告`），所以按文档顺序读入后整体反转，键用 `ep_<站点章节 ID>`。
- 章节页：`img.reading-image` 带 `data-page`（1..N）与 `src`；同一章内图片可能在 `img.guazicdn.com/th/comics/chapters/…`，也可能在 `img.guazicdn.com/rmh/comics/…`，所以不做路径校验，只做去重与按 `data-page` 排序。
- 图片 CDN 实测不校验 Referer（无 Referer 请求返回 200 `image/webp`），`onImageLoad` 仍统一补上站内 `Referer`，避免 CDN 以后收紧。

### 实现取舍

- 发现页用四组（今日热门/最近更新/高分榜/排行榜）拼 `multiPartPage`，每组 6 部 + `viewMore` 跳分类；`sort=hits` 与 `/top.php` 的前几名高度重合，所以第三组改为高分榜，避免两块内容一样。
- `categoryComics.load` 只接受 `key=value&…` 形式的参数（正则白名单），`rank:<period>` 前缀转给排行榜；这样可以防住脚本里拼 URL 时的意外注入。
- 详情页状态优先取「更新信息」里的 `状态：`，取不到才退回 `.cinema-info .meta .badge`，因为后者在有多个徽章时可能是题材而不是连载状态。
- 没有做 `settings`、`account`：站点不登录也能读全部内容，硬塞登录入口只会让用户以为需要账号。

### 验证

- 用 cheerio 在 `%TEMP%` 里复刻宿主 `HtmlDocument` 的 `querySelector/querySelectorAll/text/attributes`，把真实源脚本跑在真实页面上：发现页四组各 6 部、`/comic.php?id=18741` 取到 87 章（`0 预告` 在最前）、`/comic.php?id=23127` 取到作者 + 四个题材、章节页 58 张图、搜索「重生」35 条、`cid=13` 第 1 页 36 条 / `maxPage=23`、`is_end=1` 的状态回读为「完结」、排行榜 30 条。
- 仓库侧四套离线回归全部通过；新源也通过 `test-ui.cjs` 对「发现页只有一个 multiPartPage 且标题等于源名」「分类名等于源名」「`categories.length === categoryParams.length`」的断言。

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

## 2.3.3

- 包子：`loadEp` 改为多候选章节页（登录同源 → `cn.twbzmg.com` → `cn.cnbzmg.com` → `appcn`）。挂代理访问时 `/user/page_direct` 落到 twbzmg、直连落到 cnbzmg；图片选择器同时兼容「`.comic-contain` 直包 `.comic-contain__item`」的现行结构与旧的 `.chapter-img` 包裹；失败时拼出每个候选的原因。
- 包子：`updateTime` 恢复。详情页文本是 `(2026年06月28日 更新)`，旧代码只去掉括号，末尾“更新”让日期正则必然不匹配。
- 包子：`websiteOrigin` 承认两个章节镜像主机（只用于 `Referer`、`cache-time` 与同一份 WebView UA，不搬 `__Host-` Cookie、不改登录入口）。
- MYCOMIC：搜索排序选项改为 `id/update/views` 三键并在 `load` 里补 `-` 前缀；旧写法前导 `-` 会让三个 key 全塌成空串，排序恒不生效。
- MYCOMIC：恢复 `loginWithCookies`。`account` 在文件后半段被重新赋值时丢掉了它；原 `validate` 引用了未定义的 `headers`，异常被自身 `catch` 吞掉，等于永远返回 false。现在写入 Cookie 后用一次详情页请求判定。
- 漫画屋：`account.loginWithWebview.url` 从首页改为 `https://mhua5.com/index.php/category/tags/6`。实测首页、详情页 200，分类页 / 进度页 / `?page=2` 一律 403 Cloudflare「Just a moment」——验证是路径级的，开首页永远拿不到 `cf_clearance`。`checkStatus` 同时要求「落在分类页 + 有真实标题 + 不是挑战页」。
- 漫画屋：`loadInfo` 增加 `题材`（`a[href*="/index.php/category/tags/"]` 的链接文本），与原 `作者` 并列。
- 漫蛙：`loadInfo` 增加 `题材`。详情页没有「题材」字样，只有 `/booklist/?tag=<题材>` 链接。
- 拷贝：`loadInfo` 增加 `题材`（`theme=` 链接）、`状态`（「狀態」行）、`updateTime`（「最後更新」行）。站点文案是繁体，正则以繁体匹配。
- 漫自由：`loadInfo` 显式返回 `tags: {}`。文件站详情只有卷目录，缺 `tags` 会被宿主判成 `Invalid data`。
- 八个源：删除文件末尾的 `_checkedComic` 包装。它只兜底 `tags`，五个源本就返回标签，其余三个已改为显式返回；其中的 `instanceof Map` 分支永不成立。
- `tools/test-source-lifecycle.cjs`：包子 `loadEp` 允许最多 4 个文档（多候选），其余解析器仍要求恰好 1 个且无泄漏。
- `.gitignore` 增加 `.audit/`、`.probe/`，线上核对用的临时克隆与探针不进入仓库。

### 2.3.3 登录

宿主侧的契约（`lib/features/comic_source/source_account_parser.dart`）：`loginWithWebview.checkStatus(url, title)` 走 `consumeSynchronous`，**必须同步**返回 bool；`onLoginSuccess()` 走 `runCodeToCompletion`，可以 async；`loginWithCookies.validate(values)` 可以 async，但必须 resolve 成 bool；`account.login` 成功后宿主自动把 `[账号, 密码]` 存进源数据的 `account` 键。

- 包子：`checkStatus` 是普通函数，宿主以 `source.account.loginWithWebview.checkStatus(...)` 调用时 `this` 指向配置对象而不是源实例，旧代码里的 `this.websiteOrigin(...)`、`this.loginHost`、`this.loadData(...)` 必抛 `TypeError`——网页登录从来没有成功过。现在全部改用 IIFE 闭包里的 `source`。另加：登录成功回读 Cookie 并报告是否拿到 `TSID`、手动粘贴 `TSID` 的兜底、`registerWebsite`，删除已被覆盖且引用着已删除 `settings.domains` 的旧 `account`。
- 漫画屋：入口从首页改为分类页（只有分类页会被挑战）。`onLoginSuccess` 回读 `cf_clearance` 并提示；新增手动粘贴 `cf_clearance` 的兜底，验证方式是带 Cookie 请求分类页。
- 漫自由：旧 `checkStatus` 要求 `/m/user/(center|index)` 且标题含“漫自由”，但实测 `/m/user/center` 是 404，未登录的 `/m/user/index` 就是登录表单（与 `/m/user/login` 同长度），会在用户没登录时误判成功。现在要求标题不含 登录/注册/验证/404，并在 `onLoginSuccess` 里回读页面，仍有密码框就提示“没有确认到登录状态”。
- Komiic：接口走 `Authorization: Bearer`，网页登录只能拿 Cookie，拿不到 token（schema 里也没有 `me` 字段）。新增手动粘贴 `token` 的兜底，用 `query{account{id}}` 校验（匿名会返回 `no token`）；账号密码登录成功后也立刻用该查询验证，失败就删掉已存 token。网页登录的提示改为“只用于过网站验证”。
- MYCOMIC：`onLoginSuccess` 增加一次真实请求，命中 WAF 时直接建议改用手动 `cf_clearance`；删除被覆盖的旧 `account`（其 `validate` 引用了未定义的 `headers`）。
- 漫蛙、拷贝、如漫画**不加登录入口**，理由有实测依据：漫蛙 `/book/<id>/1/` 未登录也返回正文（130113 字节）与图片；拷贝的 `/login`、`/comic/*`、`/user` 返回同一份 75601 字节 SPA 外壳、标题恒为“拷貝漫畫”，无法据 URL/标题判断登录状态；如漫画走公开 HTTP 接口，没有需要登录的路径。
- 漫画屋、MYCOMIC、Komiic 各加一个 `type:'callback'` 检查项：漫画屋带 Cookie 请求分类页并识别挑战页特征、MYCOMIC 走一次 `fetchWithCFCheck`、Komiic 用 `query{account{id}}` 校验已保存 token。检查项只读取状态，不修改凭据。

## 2.3.4

这一轮只动漫自由：它从「只能跳浏览器下载」变成「在软件内直接下载 EPUB / MOBI」。

- 依据来自站点前台脚本，不是猜的：详情页内联的 `fileDownload(id)` 就是
  `$.ajax({type:'POST', url:'/m/vol/download_add', dataType:'json', data:{ids:[id], ext:g_ext}, success:({result})=>{ window.location.href = result[i]['url'] + '&filename=' + result[i]['file_name'] }})`，页面里 `let g_ext = 'epub';`，卷 ID 就是 `.vol-item input.form-check-input` 的 `value`。实测未登录请求返回 `HTTP 400 {"code":4001002,"message":"請先登錄"}`，触发每日额度是 `4001050`。
- `getDownloadUrl` 现在按上面的格式手拼 `ids[]=<卷ID>&ext=epub|mobi` 请求 `/m/vol/download_add`，从 `result[0].url` + `&filename=` 返回真实文件地址；没有 `url` 时按错误码给出「请先登录」或接口原因。`ids[]` 是 PHP 数组参数，必须手拼字符串（与 `rumanhua.js` 的先行做法一致，宿主只负责转发 `data`）。
- 归档条目对齐普通章节列表：`title` 用站点原名（`第01卷` / `第01话`），`description` 从「EPUB / MOBI；选择后打开网站，需在网页登录下载。」改为 `41頁 · EPUB 19M · MOBI 19M` 这种紧凑信息，数据取自 `.vol-item-info.ext-mobi` / `.ext-epub` / 无 ext class 的页数节点。页数文案自带「頁」，不再重复拼接。
- `loadInfo` 的 `description` 删除「卷目录」整段，改为下载方式 + 总卷数；`loadEp` 的报错改成引导用户走「下载 → 归档」。
- 新增设置项「下载格式」（EPUB / MOBI，默认 EPUB），通过 `loadSetting('format')` 决定 `ext`。

## 遗留与需实机确认

- 包子的章节键仍是位置索引，**站点没有可迁移的稳定章节 ID**：实测目录链接是 `/user/page_direct?comic_id=<slug>&section_slot=0&chapter_slot=N`，`chapter_slot` 从 0 连续到 n-1，没有任何章节 id 属性，槽位号与现有位置索引一一对应。除非站点改版提供真实 ID，否则不应改键（改键会让历史、下载和阅读位置指错章）。
- 章节顺序（新到旧 / 旧到新）目前只对包子逐站核对过：`#chapter-items` 是 0..23、`#chapters_other_list` 是 24..n-1，都是升序，现有的“两段拼接 + 为空才反转”的启发式与站点一致；其余源未逐一核对。
- 包子的章节页主机随**出口网络**变化：挂代理走 `cn.twbzmg.com`，直连走 `cn.cnbzmg.com`（`/user/page_direct` 的 302 决定，`cn.bzmgcn.com` 上的同路径会先跳到镜像）。`cn.twbzmg.com` 实测常常直接放行，`cn.cnbzmg.com` 需要先过 gatekeeper；两者的 `__Host-` 凭据按主机绑定，网页登录（只覆盖 `cn.bzmgcn.com`）拿到的 Cookie 不能直接用于镜像。`loadEp` 因此按「登录同源 → twbzmg → cnbzmg → appcn」顺序尝试。
- 漫画屋的分类页、进度页和「更多」是路径级 Cloudflare 挑战：源请求必须先由用户在应用内网页过一次验证（登录入口已直接指向分类页），源侧无法代过。首页与详情页不受影响。
- MYCOMIC 被 WAF 直接拒绝时（403 `Sorry, you have been blocked`）内置网页同样进不去，只能手动粘贴浏览器的 `cf_clearance`；`registerWebsite` 为空，没有网页注册入口。
- 漫蛙、漫画屋、MYCOMIC、漫自由目前没有可靠 `updateTime`，追更对这些源无效（拷贝本轮已补）。补假日期比留空更糟。
- 如漫画仍使用 HTTP；`rumanhua2.com` 的证书不匹配该域名，强行切 HTTPS 会直接 `ERR_TLS_CERT_ALTNAME_INVALID`。
- 漫蛙 `Network.get` 的 `connectTimeout`/`receiveTimeout` 选项当前不会被宿主读取（超时由应用统一设置），属于无效参数，未删是为了保留调用意图；后续确认后可移除。
- 漫自由下载依赖网站登录态：`/m/vol/download_add` 未登录只返回 `4001002`，而 Cookie 与内置 WebView 共享，所以要么先在源设置里网页登录，要么等后续站点提供 token。文件是整卷 EPUB / MOBI，不是分话图片。
- 登录相关仍需实机确认：包子的 `TSID` 兜底（站点是否每次重新下发同名 Cookie）、漫自由登录成功后 `/m/user/index` 是否真的换成用户中心（目前只能以“没有密码框”作为判据）、Komiic 网页登录能否让图片与额度走通（API 仍要 Bearer token，网页 Cookie 只影响网站侧验证）。

## 2.3.1

- 包子与 MYCOMIC：为 13 处网页解析对象补 `try/finally` 释放。
- MYCOMIC：统一拒绝非 200 响应。
- 漫蛙：修复 `/booklist?tag=...` 编码与页码。
- Komiic：登录/退出清理图片票据，旧请求不回填。
- 包子：协议相对图片地址补 HTTPS；空章节返回明确错误。
