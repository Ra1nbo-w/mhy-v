# mhy-v

适用于 VeneraNext 的漫画源文件与在线仓库索引。

## 通过链接导入

在 VeneraNext 的漫画源管理中，选择添加在线仓库或从链接导入，粘贴下面的 **JSON 原始链接**，预览后选择需要的源安装：

```text
https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/index.json
```

GitHub 仓库首页用于查看文件；软件导入请使用上面的 JSON 地址。不同应用版本的入口名称可能不同，旧版可以使用下表中的单源 JS 链接。

已安装同 key 的源会更新已有源，不会额外安装一份。发现页与分类页修订版为 2.2.0（如漫画未改动，保持 2.1.0），保留之前的源 key；每个脚本的更新地址也指向本仓库。

本次逐项核对及未实现限制见 [发现页与分类页核对记录](docs/ui-audit.md)。更新源后刷新发现页；仍显示旧分区时完全退出应用再启动。

## 默认源

主索引只收录已有搜索、目录或图片读取证据的五个常规源。它们没有完成所有作品、设备和网络环境的完整验收，网站改版、验证、额度或线路变化仍可能影响使用。

| 名称 | 单源链接 | 已知情况 |
|---|---|---|
| 漫蛙漫画 | [manwa.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/manwa.js) | 同站选线、备用入口及走失恢复；已弃用最初的多站聚合方案。 |
| 如漫画 | [rumanhua.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/rumanhua.js) | 搜索、分类及图片解码；当前使用 HTTP，站点 HTTPS 兼容问题尚存。 |
| Komiic漫画 | [komiic.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/komiic.js) | 对接 komiic.cc 和图片票据；阅读额度以网站为准。 |
| 漫画屋 | [mhua5.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mhua5.js) | 22 个题材及进度分类；修正封面请求头与目录名，分类列表可能要求验证。 |
| 拷贝漫画 | [copy_manga.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/copy_manga.js) | 支持 copy4000 / mangacopy 选线；后者网络可达性尚未验证。 |

## 可选源

可选索引：

```text
https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/optional.json
```

| 名称 | 单源链接 | 限制 |
|---|---|---|
| MYCOMIC | [mycomic.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mycomic.js) | 多组目录漏读逻辑已修正并做模拟回归；网站拦截导致完整联网链路尚未验证。 |
| 包子漫画 | [baozi.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/baozi.js) | 2.2.2 修正把公开分类页当作账号登录的问题，登录后需进入“我的书架”并检查源请求；应用端补丁补全会话属性与返回检查，需重新构建。Android/Windows 真机待验证。详见 [验证说明](docs/baozi-verification.md)。 |
| 漫自由 | [mheee.js](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mheee.js) | EPUB/MOBI 文件目录型源；可搜索、查看卷目录并打开网页下载，不支持普通分话阅读或软件内图片离线下载。 |

全部八源索引为 [all.json](https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/all.json)。不要把可选源的存在理解为验证问题已经解决。

包子等源需在应用自己的内置网页中正常完成验证或登录。仓库不提供固定 Cookie；外部浏览器会话不会自动成为应用会话。

## 更新与维护

修改源代码时保留 `key`，同步提高脚本及对应索引条目的 `version`。源的 `url` 和索引链接均使用 `main` 分支上的原始文件地址。

发布前运行：

```sh
node tools/validate.cjs
node tools/test-ui.cjs
```

检查覆盖脚本语法、索引格式、名称/key/版本/更新地址一致性及重复 key；不会代替网站或手机实测。另需手动验证搜索、详情目录顺序、章节图片和离线下载。不要把账号 Cookie、令牌、原始抓包或个人日志提交到仓库。

如遇页面缓存类型错误，替换源后先完全退出 VeneraNext 再启动，不必清空收藏和历史记录。网站验证失败与应用错误需要根据最新日志分别判断。

## 来源

- [VeneraNext 源接口文档](https://github.com/CyrilPeng/Venera-Next/blob/main/doc/api/comic_source.zh.md)
- [venera-app/venera-configs](https://github.com/venera-app/venera-configs)：包子、MYCOMIC 基于其同名公开脚本修改；Komiic 分类 ID 参考其实现。

代码来源和修改情况见 [NOTICE.md](NOTICE.md)。本仓库不包含漫画正文、账号凭据或个人请求记录。

