# mhy-v

适用于 VeneraNext 的漫画源文件与在线仓库索引。

## 通过链接导入

在 VeneraNext 的漫画源管理中，选择添加在线仓库或从链接导入，粘贴下面的 **JSON 原始链接**，预览后选择需要的源安装：

```text
https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/index.json
```

GitHub 仓库首页用于查看文件；软件导入请使用上面的 JSON 地址。不同应用版本的入口名称可能不同，旧版可以使用下表中的单源 JS 链接。

已安装同 key 的源会更新已有源，不会额外安装一份。当前版本：包子、MYCOMIC、漫蛙、Komiic 为 2.3.2；漫画屋、拷贝、漫自由为 2.3.1；如漫画为 2.1.1。源 key 和更新地址保持一致。

2.3.2 是一轮“契约对齐”维护：删除重复/死代码，章节与标签改用普通对象，`updateTime` 只接受真实日期（不再用最后一章标题伪造），统一抛 `Error`，并移除写死 CDN 域名、写死 App 版本 UA 等环境耦合。逐项变更见 [维护记录](docs/source-maintenance.md)。

本次逐项核对及未实现限制见 [发现页与分类页核对记录](docs/ui-audit.md)。更新源后刷新发现页；仍显示旧分区时完全退出应用再启动。

## 默认源

主索引只收录已有搜索、目录或图片读取证据的五个常规源。它们没有完成所有作品、设备和网络环境的完整验收，网站改版、验证、额度或线路变化仍可能影响使用。

| 名称 | 单源链接 | 已知情况 |
|---|---|---|
| 漫蛙漫画 | [manwa.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/manwa.js) | 同站选线；分类页按题材、地区、面向、进度分组，支持新漫排序。 |
| 如漫画 | [rumanhua.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/rumanhua.js) | 搜索、分类及图片解码；当前使用 HTTP，站点 HTTPS 兼容问题尚存。 |
| Komiic漫画 | [komiic.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/komiic.js) | 分类页收录网站公开接口的 71 个分类、七个分组；阅读额度以网站为准。 |
| 漫画屋 | [mhua5.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mhua5.js) | 22 个题材及进度分类；修正封面请求头与目录名，分类列表可能要求验证。 |
| 拷贝漫画 | [copy_manga.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/copy_manga.js) | 支持 copy4000 / mangacopy 选线；后者网络可达性尚未验证。 |

## 可选源

可选索引：

```text
https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/optional.json
```

| 名称 | 单源链接 | 限制 |
|---|---|---|
| MYCOMIC | [mycomic.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mycomic.js) | 发现页为首页精选、推荐给你、最近更新、最新上架；网站拦截导致完整联网链路尚未验证。 |
| 包子漫画 | [baozi.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/baozi.js) | 2.3.0 延续登录主机修复并移除分类页「常用」；完整直连及 Android/Windows 实机仍待验证。详见 [验证说明](docs/baozi-verification.md)。 |
| 漫自由 | [mheee.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mheee.js) | 发现页保留最近更新和最高评分；EPUB/MOBI 文件目录型源，不支持普通分话阅读。 |

全部八源索引为 [all.json](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/all.json)。不要把可选源的存在理解为验证问题已经解决。

## 能力矩阵

`updateTime` 是追更功能的唯一依据：缺这一项的源不会产生“有新章节”的提示，应用也不会替源猜测。

| 源 | 发现页 | 分类 | 搜索 | 追更（updateTime） | 账号/网页登录 | 下载 | 章节 ID 依据 |
|---|---|---|---|---|---|---|---|
| 漫蛙 | 多分区 | 题材/地区/面向/进度 | 有 | **无** | 按站点要求 | 图片 | 站点章节 ID |
| 如漫画 | 多分区 | 题材/进度 | 有（2–12 字） | `og:date` | 无 | 图片 | 站点章节 ID |
| Komiic | 单分区 | 7 组 | 有 | 接口 `dateUpdated`（已校验格式） | 网页 + API token | 图片 | 站点章节 ID |
| 漫画屋 | 多分区 | 22 题材 + 进度 | 有 | **无** | 网页 | 图片 | 站点章节 ID |
| 拷贝 | 多分区 | 题材/地区 | 有 | **无** | 网页 | 图片 | 36 位 UUID |
| MYCOMIC | 多分区 | 5 段筛选 | 有 | **无** | 网页 + Cookie | 图片 | 站点章节 ID |
| 包子 | 多分区 | 题材/地区 | 有 | 仅真实日期（可能为空） | 网页 | 图片 | **位置索引（待实机迁移）** |
| 漫自由 | 单分区 | 文件分类 | 无 | **无** | 无 | 外部文件 | 文件目录 |

“无 updateTime”不是遗漏，而是当前解析结果没有可靠日期字段；加假日期会让追更误报，宁可不显示。

包子等源需在应用自己的内置网页中正常完成验证或登录。仓库不提供固定 Cookie；外部浏览器会话不会自动成为应用会话。

## 更新与维护

修改源代码时保留 `key`，同步提高脚本及对应索引条目的 `version`。源的 `url` 和索引链接均使用 `main` 分支上的原始文件地址。

发布前运行：

```sh
node tools/validate.cjs
node tools/test-ui.cjs
node tools/test-baozi-verification.cjs
node tools/test-source-lifecycle.cjs
```

检查覆盖：脚本语法、索引格式、名称/key/版本/更新地址一致性、重复 key、`all.json` 与 `index.json + optional.json` 的顺序内容一致、`sources/` 下无未登记脚本、`minAppVersion` 格式，以及三类契约错误（`new Map()`、抛字符串、缺失 `minAppVersion`）。这些检查不代替网站或手机实测，仍需手动验证搜索、详情目录顺序、章节图片和离线下载。不要把账号 Cookie、令牌、原始抓包或个人日志提交到仓库。

同样的命令由 `.github/workflows/validate.yml` 在每次 push 和 PR 上执行；本地跑不过就不必等 CI。

如遇页面缓存类型错误，替换源后先完全退出 VeneraNext 再启动，不必清空收藏和历史记录。网站验证失败与应用错误需要根据最新日志分别判断。

## 来源

- [VeneraNext 源接口文档](https://github.com/CyrilPeng/Venera-Next/blob/main/doc/api/comic_source.zh.md)
- [venera-app/venera-configs](https://github.com/venera-app/venera-configs)：包子、MYCOMIC 基于其同名公开脚本修改；Komiic 分类 ID 参考其实现。

代码来源和修改情况见 [NOTICE.md](NOTICE.md)。本仓库不包含漫画正文、账号凭据或个人请求记录。

`patches/` 下是对 VeneraNext 应用本体的补丁，不属于源文件，也不会被导入器读取；升级 VeneraNext 后需要按新版本重新应用或丢弃，源侧问题不要靠补丁掩盖。

