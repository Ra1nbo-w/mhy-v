# mhy-v

适用于 VeneraNext 的漫画源文件与在线仓库索引。

## 通过链接导入

在 VeneraNext 的漫画源管理中，选择添加在线仓库或从链接导入，粘贴下面的 **JSON 原始链接**，预览后选择需要的源安装：

```text
https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/index.json
```

一个链接收录全部九个源，安装时在预览页勾选需要的条目即可；`all.json` 是内容完全相同的兼容别名，旧链接不会失效。GitHub 仓库首页用于查看文件；软件导入请使用上面的 JSON 地址。不同应用版本的入口名称可能不同，旧版可以使用下表中的单源 JS 链接。

已安装同 key 的源会更新已有源，不会额外安装一份。当前版本：瓜子漫画为 1.0.0（新源）；漫自由为 2.3.4；包子、MYCOMIC、漫蛙、Komiic、漫画屋为 2.3.3；拷贝为 2.3.2；如漫画为 2.1.2。源 key 和更新地址保持一致。

1.0.0 新增瓜子漫画：首页精选四组（今日热门、最近更新、高分榜、排行榜）、23 个题材加进度/受众/排序筛选、搜索、详情与章节阅读全部走站点 HTML 与 JSON-LD，没有登录墙，封面和章节图都不校验 Referer。2.3.4 只动漫自由：它在软件内就能下载 EPUB / MOBI 了——归档列表改成普通章节列表的样子，卷 ID 直接换真实文件地址（依赖网站登录态），并可选择 EPUB 或 MOBI。2.3.3 是本轮线上核对后的集中修复：包子章节页改走网页章节页并同时兼容两种图片结构、包子更新日期恢复、MYCOMIC 搜索排序与手动 Cookie 登录恢复、漫画屋登录入口改到真正会被挑战的分类页、漫蛙/漫画屋/拷贝补标签、拷贝补更新日期；五个有账号体系的源也逐个修掉了登录缺陷（包子 `checkStatus` 的 `this` 指向、漫自由把登录页误判成已登录、Komiic 只有 Cookie 拿不到 API token、漫画屋入口打不开挑战页、MYCOMIC 缺失败提示），并各加一条手动凭据兜底。逐项变更见 [CHANGELOG](CHANGELOG.md)。

本次逐项核对及未实现限制见 [发现页与分类页核对记录](docs/ui-audit.md)。更新源后刷新发现页；仍显示旧分区时完全退出应用再启动。

## 源列表

一个索引收录全部源；下表前半是常规阅读源，后半是文件站与需要额外验证的源。它们没有完成所有作品、设备和网络环境的完整验收，网站改版、验证、额度或线路变化仍可能影响使用。

| 名称 | 单源链接 | 已知情况 |
|---|---|---|
| 漫蛙漫画 | [manwa.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/manwa.js) | 同站选线；分类页按题材、地区、面向、进度分组，支持新漫排序；详情页补题材标签。 |
| 如漫画 | [rumanhua.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/rumanhua.js) | 搜索、分类及图片解码；当前使用 HTTP，站点 HTTPS 兼容问题尚存。 |
| Komiic漫画 | [komiic.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/komiic.js) | 分类页收录网站公开接口的 71 个分类、七个分组；阅读额度以网站为准。网页登录只用于过网站验证，阅读走账号密码或手动 token。 |
| 漫画屋 | [mhua5.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mhua5.js) | 22 个题材及进度分类；修正封面请求头与目录名。分类页和进度页受 Cloudflare 托管挑战，需先从源设置的「登录」在分类页过一次验证（入口已直接指向分类页）。 |
| 拷贝漫画 | [copy_manga.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/copy_manga.js) | copy4000 / mangacopy 选线；详情页补题材、状态与更新日期；后者网络可达性尚未验证。 |
| 瓜子漫画 | [guazimanhua.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/guazimanhua.js) | 纯 HTML 模板站，无登录墙；发现页四组、23 题材加进度/受众/排序、搜索、详情与章节阅读。章节用站点章节 ID，倒序目录自动反转。 |
| MYCOMIC | [mycomic.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mycomic.js) | 发现页为首页精选、推荐给你、最近更新、最新上架；搜索结果支持最新上架/最近更新/最高人气排序；站点被 WAF 直接拒绝时网页登录也进不去，可在源设置的「登录」里手动粘贴浏览器的 `cf_clearance`。 |
| 包子漫画 | [baozi.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/baozi.js) | 2.3.3 章节页按「登录同源 → `cn.twbzmg.com` → `cn.cnbzmg.com` → appcn」回退并兼容两种图片结构，同时恢复详情页更新日期；挂代理访问时章节镜像落在 `cn.twbzmg.com`，直连落在 `cn.cnbzmg.com`。网页登录成功后可用手动 `TSID` 兜底。完整登录与 Android/Windows 实机仍待验证。详见 [验证说明](docs/baozi-verification.md)。 |
| 漫自由 | [mheee.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mheee.js) | 发现页保留最近更新和最高评分；EPUB/MOBI 文件站，不支持分话阅读，但**可以在软件内直接下载**：登录网站账号后「下载」→ 展开「归档」选卷即可，可选 EPUB 或 MOBI（源设置里切换）。详情页没有标签，按空标签处理。 |

清单只说明每项能力有没有证据，不代表站点当下一定可用；遇到源失效先看对应源的「已知情况」，再按下方四条命令自检。

## 能力矩阵

`updateTime` 是追更功能的唯一依据：缺这一项的源不会产生“有新章节”的提示，应用也不会替源猜测。

| 源 | 发现页 | 分类 | 搜索 | 追更（updateTime） | 标签 | 账号/网页登录 | 下载 | 章节 ID 依据 |
|---|---|---|---|---|---|---|---|---|
| 漫蛙 | 多分区 | 题材/地区/面向/进度 | 有 | **无** | 题材 | 无 | 图片 | 站点章节 ID |
| 如漫画 | 多分区 | 题材/进度 | 有（2–12 字） | `og:date` | 作者、题材 | 无 | 图片 | 站点章节 ID |
| Komiic | 单分区 | 7 组 | 有 | 接口 `dateUpdated`（已校验格式） | 作者、分类 | 网页 + API token | 图片 | 站点章节 ID |
| 漫画屋 | 多分区 | 22 题材 + 进度 | 有 | **无** | 作者、题材 | 网页（分类页过验证） | 图片 | 站点章节 ID |
| 拷贝 | 多分区 | 题材/地区 | 有 | 详情页「最後更新」 | 题材、状态 | 无 | 图片 | 36 位 UUID |
| MYCOMIC | 多分区 | 5 段筛选 | 有 | **无** | 作者、类型 | 网页 + Cookie | 图片 | 站点章节 ID |
| 包子 | 多分区 | 题材/地区 | 有 | 详情页「最新：…（日期 更新）」（可能为空） | 标签列表 | 网页 + TSID | 图片 | **位置索引（站点只有 `section_slot`/`chapter_slot` 槽位）** |
| 漫自由 | 单分区 | 文件分类 | 无 | **无** | 无（文件站） | 网页（下载必需） | 软件内下载 EPUB/MOBI | 文件目录 |
| 瓜子漫画 | 四组 | 23 题材 + 进度/受众/排序 | 有 | 详情页「更新信息」 | 作者、题材 | 无 | 图片 | 站点章节 ID |

“无 updateTime”不是遗漏，而是当前解析结果没有可靠日期字段；加假日期会让追更误报，宁可不显示。

包子等源需在应用自己的内置网页中正常完成验证或登录。仓库不提供固定 Cookie；外部浏览器会话不会自动成为应用会话。五个有账号体系的源在「登录」里同时提供网页登录与手动凭据兜底：包子/漫画屋/MYCOMIC 可粘贴 `cf_clearance`（包子另有 `TSID`），Komiic 可粘贴 API `token`，漫自由只保留网页登录（卷文件下载接口依赖它）。漫画屋、MYCOMIC、Komiic 的设置页还各有一个检查按钮，能在开新作品前确认验证或令牌是否真的生效。漫蛙、拷贝、如漫画没有登录墙，不设登录入口。

## 更新与维护

修改源代码时保留 `key`，同步提高脚本及对应索引条目的 `version`。源的 `url` 和索引链接均使用 `main` 分支上的原始文件地址。

发布前运行：

```sh
node tools/validate.cjs
node tools/test-ui.cjs
node tools/test-baozi-verification.cjs
node tools/test-source-lifecycle.cjs
```

检查覆盖：脚本语法、索引格式、名称/key/版本/更新地址一致性、重复 key、`all.json` 与 `index.json` 内容完全一致、`sources/` 下无未登记脚本、`minAppVersion` 格式，以及三类契约错误（`new Map()`、抛字符串、缺失 `minAppVersion`）。这些检查不代替网站或手机实测，仍需手动验证搜索、详情目录顺序、章节图片和离线下载。不要把账号 Cookie、令牌、原始抓包或个人日志提交到仓库。

同样的命令由 `.github/workflows/validate.yml` 在每次 push 和 PR 上执行；本地跑不过就不必等 CI。

如遇页面缓存类型错误，替换源后先完全退出 VeneraNext 再启动，不必清空收藏和历史记录。网站验证失败与应用错误需要根据最新日志分别判断。

## 来源

- [VeneraNext 源接口文档](https://github.com/CyrilPeng/Venera-Next/blob/main/doc/api/comic_source.zh.md)
- [venera-app/venera-configs](https://github.com/venera-app/venera-configs)：包子、MYCOMIC 基于其同名公开脚本修改；Komiic 分类 ID 参考其实现。

代码来源和修改情况见 [NOTICE.md](NOTICE.md)。本仓库不包含漫画正文、账号凭据或个人请求记录。

`patches/` 下是对 VeneraNext 应用本体的补丁，不属于源文件，也不会被导入器读取；升级 VeneraNext 后需要按新版本重新应用或丢弃，源侧问题不要靠补丁掩盖。
