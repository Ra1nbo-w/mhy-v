# 维护记录

源脚本的站点结构依据、改动原因与已知限制。改任何源之前先读「通用约定」，改完跑 `node tools/check.cjs`。

## 通用约定

宿主契约里有几条会静默出错，写源时必须遵守：

- `ComicDetails.tags` 必须是普通对象 `{命名空间: string[]}`，没有标签就显式写 `tags: {}`；列表里的 `Comic.tags` 是字符串数组。
- 章节容器用普通对象，**不要 `new Map()`**；`loadEp` 必须返回 `{ images: string[] }`。
- `onThumbnailLoad` 必须同步返回；`onImageLoad` 可以 async。
- `updateTime` 只接受 `YYYY-MM-DD`（可带空格时间），ISO 的 `T`、时间戳、相对时间都会被拒。取不到就留空，不要伪造。
- `account.loginWithWebview.checkStatus(url, title)` 由宿主同步调用，**不能 async**；`onLoginSuccess`、`loginWithCookies.validate` 可以 async（后者必须 resolve 成 bool）。
- 错误一律 `throw new Error("可读的中文说明")`，不要抛字符串。
- `Network.get/post(url, headers, data, extra)` 的 `data` 原样交给宿主，需要表单/数组参数时自己拼字符串并显式设置 `Content-Type`；`extra` 只是拦截器选项，**不是超时配置**。
- 章节要按阅读顺序排列、键要稳定；站点是倒序就先 `reverse()` 再写入。

改源流程：保留 `key`，同步提高脚本与 `index.json` 里对应条目的 `version`（三段数字），`url` 保持 `main` 分支的原始地址。仓库只对外提供一个索引入口。

检查：`node tools/check.cjs`（索引与契约、发现页与分类、生命周期、包子登录四套回归，无网络依赖）。

## 各源站点要点

### 瓜子漫画 `guazimanhua.js` 1.0.1

PHP 服务端渲染模板站（`/comic.php?id=`、`/chapter.php?id=`、`/category.php?cid=`），没有登录墙，也没有 Cloudflare。

- 列表卡片：`article.card > a.cover-wrap[href="/comic.php?id=…"] > img.cover`，标题在 `h3 > a`，状态在 `.genre`，作者与题材在 `.meta`；翻页在 `nav.pager`。
- 分类参数：`cid`（23 个题材：41 耽美、9 恋爱、29 校园、5 霸总、42 都市、8 穿越、23 古风、25 玄幻、31 奇幻、22 科幻、21 灵异、54 动作、11 悬疑、30 冒险、15 搞笑、13 热血、14 恐怖、148 系统、97 逆袭、55 脑洞、61 复仇、17 真人、27 其它）、`is_end=2|1`（连载/完结）、`audience=1|2`（男频/女频）、`city`（地区）、`sort=update|hits|daily|score`；搜索是 `GET /category.php?keyword=`。
- 详情页：JSON-LD `ComicStory` 带 `name / author.name / image / description / dateModified`；`.cinema-strip > div` 是「作者｜分类｜题材｜热度｜最新」信息行；`section.side-card` 里标题为「更新信息」的卡片正文是 `更新时间：…<br>最新章节：…<br>章节总数：…<br>状态：…`。
- 章节目录：`.mobile-chapter-grid` 内 `<a href="/chapter.php?id=…">`，站点按新到旧排列（实测 87 条，末尾是 `0 预告`），读入后整体反转，键用 `ep_<站点章节 ID>`。
- 章节页：`img.reading-image` 带 `data-page` 与 `src`；同一章内图片可能在 `img.guazicdn.com/th/comics/chapters/…` 也可能在 `img.guazicdn.com/rmh/comics/…`，所以只做去重与按 `data-page` 排序，不校验路径。
- 图片 CDN 不校验 `Referer`（无 Referer 也返回 200 `image/webp`），但 `onImageLoad` 仍统一补站内 Referer。
- 取舍：发现页四组（今日热门/最近更新/高分榜/排行榜），`sort=hits` 与 `/top.php` 前几名高度重合所以第三组用高分榜；`categoryComics.load` 只接受 `key=value&…` 白名单参数，`rank:<period>` 前缀转排行；状态优先取「更新信息」里的 `状态：`，取不到才退回 `.cinema-info .meta .badge`；没有 `settings`、`account`——不登录也能读全部内容。

1.0.1 的 403 修正：实测服务端**不按** UA / Referer / 并发拦普通请求（六种 UA、三种 Referer 全部 200，`Range` 返回 206，20 个章节页与 40 张图并发全 200），因此只补客户端因素——`html()` 对 403/429/5xx 退避重试两次、网页与图片请求统一带 `Referer` + 移动端 UA、设置页加「图片请求检查」直接报出图片主机与状态码。仍然是 403 就说明出口 IP 被 CDN 拒，换网络/节点/DNS。

### 包子漫画 `baozi.js` 2.3.3

- 章节页按「登录同源 → `cn.twbzmg.com` → `cn.cnbzmg.com` → `appcn.baozimh.com`」回退；挂代理访问时 `/user/page_direct` 落到 twbzmg，直连落到 cnbzmg。
- 前置校验是纯工作量证明（`/__gatekeeper_challenge/start` → `verify`），不是 Cloudflare：16 bit、无验证码，通过后下发 `__Host-gk_clearance_<主机哈希>`，约 3 分钟有效；`__Host-` 前缀**按主机绑定**，`cn.bzmgcn.com` 的通过状态不能用于章节镜像。
- 章节页结构：`ul.comic-contain > amp-img.comic-contain__item[data-src]`，没有 `.chapter-img` 包裹层；`data-src` 指向 `https://s1.bzcdn.net/scomic/…`，图片不校验 Referer，`/w640/` 是 WebP 缩略图。
- `appcn.baozimh.com` 是 Cloudflare「Just a moment」且属另一主机，网页登录拿不到它的 Cookie，所以只作最后兜底。
- `updateTime` 取自详情页 `(2026年06月28日 更新)`，要先去掉「更新」后缀再匹配日期。
- 2.3.2 的契约修正：章节容器 `new Map()` 改普通对象、删除「用最后一章标题伪造 updateTime」的分支、`Comic({ subtitle })` 走构造器、分类参数先 `String(param || 'all')` 归一化、字符串抛错改 `Error`。

### 漫自由 `mheee.js` 2.3.4

EPUB/MOBI 文件站，没有分话图片，支持软件内直接下载。依据是站点前台脚本：

```js
// 详情页内联的 fileDownload(id)
$.ajax({ type:'POST', url:'/m/vol/download_add', dataType:'json',
  data:{ ids:[id], ext:g_ext },
  success:({ result }) => { window.location.href = result[i]['url'] + '&filename=' + result[i]['file_name'] } })
```

- 卷 ID 就是 `.vol-item input.form-check-input` 的 `value`；`let g_ext = 'epub'`，可通过 `a[data-ext]` 切 mobi。
- 未登录返回 `HTTP 400 {"code":4001002,"message":"請先登錄"}`，触发每日额度是 `4001050`。Cookie 与内置 WebView 共享，所以下载依赖网页登录态。
- `ids[]` 是 PHP 数组参数，必须手拼 `ids[]=<卷>&ext=epub` 并设 `application/x-www-form-urlencoded`（与 `rumanhua.js` 同一做法）。
- 归档条目对齐普通章节列表：`title` 用站点原名（`第01卷` / `第01话`），`description` 用 `41頁 · EPUB 19M · MOBI 19M`（页数文案自带「頁」，不要再拼）；`loadInfo` 的 description 删掉「卷目录」整段。
- 设置项「下载格式」决定 `ext`；`loadInfo` 必须显式 `tags: {}`，否则宿主判 `Invalid data`。

### MYCOMIC `mycomic.js` 2.3.3

- 站点被 WAF 直接拒绝时（403 `Sorry, you have been blocked`）内置网页也进不去，只能手动粘贴浏览器的 `cf_clearance`。
- 2.3.2 的契约修正：删除手写 `Accept-Encoding`（让客户端自己协商）、Cloudflare 判定收紧（特征正文或 403/503 空正文才算）、列表不再要求封面含 `biccam.com/comics/`（换 CDN 会让整列表静默变空）、删除被最终实现完全覆盖的旧 `loadInfo`（851 → 746 行）。
- 2.3.3：搜索排序选项改为 `id/update/views` 三键并在 `load` 里补 `-` 前缀——旧写法前导 `-` 会让三个 key 全塌成空串，排序恒不生效；恢复被后半段覆盖掉的 `loginWithCookies`（原 `validate` 引用了未定义的 `headers`，异常被自身吞掉，永远返回 false）。

### 漫画屋 `mhua5.js` 2.3.3

- 分类页、进度页、「更多」是**路径级** Cloudflare 挑战：首页与详情页 200，`/index.php/category/…`、`/finish/*`、`?page=2` 一律 403「Just a moment」。所以登录入口直接指向 `https://mhua5.com/index.php/category/tags/6`，开首页永远拿不到 `cf_clearance`。
- `loadInfo` 的 `题材` 取自 `a[href*="/index.php/category/tags/"]` 的链接文本，与已有的 `作者` 并列。

### 漫蛙 `manwa.js` 2.3.3

- `probe()` 改为「尽力确认」：抽样页打不开（作品下架、章节换 ID）时保留结构性校验，只有明确不是漫蛙站才切换线路。
- 缩略图从图片 URL 的 `#venera-manwa-ref=` 片段取线路，与正文图一致；原先读共享的 `activeBase`，并发时会串线。
- `loadInfo` 的 `题材` 只能从 `/booklist/?tag=<题材>` 链接取（详情页没有「题材」字样）。
- `Network.get` 上的 `connectTimeout`/`receiveTimeout` 宿主不读，属无效参数（保留只为表达意图，可随时删）。

### 拷贝漫画 `copy_manga.js` 2.3.2

- copy4000 / mangacopy 选线；UA 用 `'VeneraNext/' + APP.version`，不写死版本号。
- `pageSize` 统一 offset/limit/`maxPage`，修掉 `/recommend`、`/newest` 的 60 与 50 混用。
- `loadInfo` 补 `题材`（`theme=` 链接）、`状态`（「狀態」行）、`updateTime`（「最後更新」行）；站点文案是繁体，正则以繁体匹配。

### Komiic `komiic.js` 2.3.3

- GraphQL 走 `Authorization: Bearer`，网页登录只能拿 Cookie、拿不到 token（schema 里也没有 `me` 字段）；用 `query{account{id}}` 校验 token（匿名返回 `no token`）。
- `updateTime` 统一经 `dateOnly()` 输出 `YYYY-MM-DD`；图片票据有缓存与并发去重，退出登录会作废在途请求。
- 分类页收录站点公开接口的 71 个分类、七个分组；阅读额度以网站为准。

### 如漫画 `rumanhua.js` 2.1.2

- 仍只能用 `http://rumanhua2.com`：证书不匹配该域名，强行 HTTPS 会 `ERR_TLS_CERT_ALTNAME_INVALID`。
- 2.1.1 删除三处被文件末尾覆盖的重复实现（旧 `explore`、旧 `category`、旧 `decodeImages`），233 → 177 行。

## 登录实现要点（2.3.3）

宿主 `source_account_parser.dart` 的调用方式决定写法：`checkStatus` 同步、`onLoginSuccess` 可 async、`validate` 可 async 但必须返回 bool、`login` 成功后宿主自动把 `[账号, 密码]` 存进源数据的 `account` 键。

- 包子：`checkStatus` 是普通函数，宿主以 `source.account.loginWithWebview.checkStatus(...)` 调用时 `this` 指向配置对象而不是源实例，旧的 `this.websiteOrigin(...)`、`this.loginHost`、`this.loadData(...)` 必抛 `TypeError`——网页登录从来没成功过。现在全部用 IIFE 闭包里的 `source`；另加 TSID 回读、手动 `TSID` 兜底、`registerWebsite`。
- 漫画屋：入口改到分类页（只有分类页被挑战），`checkStatus` 要求「落在分类页 + 有真实标题 + 不是挑战页」；`onLoginSuccess` 回读 `cf_clearance`；可手动粘贴 `cf_clearance`，验证方式是带 Cookie 请求分类页。
- 漫自由：旧 `checkStatus` 要求 `/m/user/(center|index)` 且标题含「漫自由」，但 `/m/user/center` 是 404，未登录的 `/m/user/index` 就是登录表单（与 `/m/user/login` 同长度），会在没登录时误判成功。现在要求标题不含 登录/注册/验证/404，并在 `onLoginSuccess` 里回读页面，仍有密码框就提示「没有确认到登录状态」。
- Komiic：网页登录只用于过网站验证；阅读走账号密码或手动 token，登录后立刻用 `account{id}` 验证，失败就删 token。
- MYCOMIC：`onLoginSuccess` 发一次真实请求，命中 WAF 时提示改用手动 `cf_clearance`。
- **不加登录入口的三个源**（都有实测依据）：漫蛙 `/book/<id>/1/` 未登录也返回正文与图片；拷贝的 `/login`、`/comic/*`、`/user` 返回同一份 SPA 外壳、标题恒为「拷貝漫畫」，无法据 URL/标题判断登录态；如漫画走公开 HTTP 接口，没有需要登录的路径。
- 漫画屋、MYCOMIC、Komiic 各有一个 `type:'callback'` 检查项，只读取状态、不修改凭据（设置项必须显式写 `type:'callback'`，只给 `callback` 字段不会渲染）。

## 版本要点

- **2.3.1**：包子与 MYCOMIC 为 13 处网页解析对象补 `try/finally`；MYCOMIC 统一拒绝非 200；漫蛙修 `/booklist?tag=` 编码与页码；Komiic 登录/退出清理图片票据；包子协议相对图片补 HTTPS。
- **2.3.2 / 2.1.1**：契约对齐（见各源小节）；漫画屋 22 个题材改为显式 ID 数组；漫自由无分章返回 `chapters: null`、无封面返回空串、`getDownloadUrl` 不再先跳浏览器再抛错。
- **2.3.3**：包子章节页多候选与更新日期、MYCOMIC 搜索排序与手动 Cookie、漫画屋登录入口、漫蛙/漫画屋/拷贝补标签、拷贝补更新日期、五个源登录缺陷、八个源删除 `_checkedComic` 包装（其中 `instanceof Map` 分支永不成立）。
- **2.3.4**：漫自由软件内下载 EPUB/MOBI。
- **1.0.0**：新增瓜子漫画。
- **1.0.1**：瓜子漫画 403 退避重试、请求头补齐与图片自检。

## 发现页与分类页

| 源 | 发现页 | 分类与筛选 |
|---|---|---|
| 漫自由 | 最近更新、最高评分 | 题材、地区、语言、进度；列表可组合筛选与排序 |
| Komiic | 最近更新、本月热门、人气漫画 | 公开接口的 71 个分类、七个分组；保留排序与状态 |
| 漫画屋 | 首页精选、上升最快、完结大作、收藏榜、最近更新、人气排行榜 | 22 个题材 + 连载/完结；站点未证实组合筛选，不增加空选项 |
| 拷贝 | 漫画推荐、热门更新、全新上架、漫画排行榜 | 题材、地区；列表支持题材+地区+状态+排序 |
| 漫蛙 | 最近更新、女主逆袭、悬疑系列、完结优选、排行榜 | 题材、地区、面向、进度；线路在源设置里 |
| 如漫画 | 精选漫画、今日推荐、人气漫画、黑马新漫 | 题材、进度 |
| 包子 | 网站首页栏目 | 题材、地区；列表支持地区/状态/首字母 |
| MYCOMIC | 首页精选、推荐给你、最近更新、最新上架 | 题材、地区、受众、年份、进度；支持排序 |
| 瓜子漫画 | 今日热门、最近更新、高分榜、排行榜 | 23 题材 + 进度/受众/排序 |

所有源都是一个 `multiPartPage`：同页多个分区、每分区最多 6 本。首页精选、推荐给你这类「没有独立列表页」的分区不伪造「查看更多」。

未按预览实现的部分：卡片样式、列数、标签位置由应用控制，源只能决定分区、分类与筛选；拷贝排行榜读取首页日/周/月/总分栏，每榜男女频合计最多 20 条且没有下一页；MYCOMIC 首页在本机被 WAF 拦截，推荐位按网页顺序与模拟页面核对。

## 遗留与需实机确认

- 包子的章节键仍是位置索引，**站点没有可迁移的稳定章节 ID**：目录链接是 `/user/page_direct?comic_id=<slug>&section_slot=0&chapter_slot=N`，`chapter_slot` 从 0 连续到 n-1，没有任何章节 id 属性。改键会让历史、下载与阅读位置指错章。
- 章节顺序（新到旧 / 旧到新）只对包子逐站核对过，其余源未逐一验证。
- 包子的章节页主机随**出口网络**变化（代理走 `cn.twbzmg.com`、直连走 `cn.cnbzmg.com`），两者的 `__Host-` 凭据按主机绑定，网页登录（只覆盖 `cn.bzmgcn.com`）拿到的 Cookie 不能直接用于镜像；`cn.twbzmg.com` 实测常常直接放行。
- 漫画屋的分类页、进度页与「更多」是路径级挑战，必须由用户在应用内网页过一次验证，源侧无法代过；首页与详情页不受影响。
- MYCOMIC 被 WAF 拒绝时内置网页同样进不去，只能手动粘贴 `cf_clearance`；`registerWebsite` 为空，没有网页注册入口。
- 漫蛙、漫画屋、MYCOMIC、漫自由没有可靠的 `updateTime`，追更对这些源无效（拷贝已补）。补假日期比留空更糟。
- 登录仍需实机确认：包子的 `TSID` 兜底（站点是否每次重新下发同名 Cookie）、漫自由登录后 `/m/user/index` 是否真的换成用户中心（目前以「没有密码框」为判据）、Komiic 网页登录能否让图片与额度走通。
- 以上都是离线与单机模拟回归，不代替 Android / Windows 实机阅读、登录与下载验证。
