# 包子漫画登录与会话保存（2.2.4）

2.2.4 修复首次安装或升级时的 `Setting not found: loginHost`：应用在新设置注册前解析账号登录网址，不能在这里调用 `loadSetting` 读取新增设置。现在从构建阶段允许读取的已有数据快照获取保存值，缺失时使用源内默认入口。回归测试已先复现相同错误，再验证修复。

用户提供的内置 WebView 网络截图显示，成功登录的实际地址为 `https://cn.bzmgcn.com/user/my_bookshelf`，请求携带网站账号及验证 Cookie。此前源将成功页面和后续请求固定在 `www.baozimh.com`，会漏判这个登录成功页；两个主机的 Cookie 不能直接互换。截图证明 WebView 请求带 Cookie，尚不能单独证明应用网络层已经保存它们。

## 本次仅修改源 JS 的修复

- 默认登录入口改为 `cn.bzmgcn.com`，保留 `www.baozimh.com` 选项。新的入口设置替代此前固定 www 的旧域名设置，避免旧配置继续把登录导向错误主机。
- 精确识别这两个 HTTPS 主机的书架页，拒绝相似域名、登录页和验证页。识别成功后，VeneraNext 原有流程负责捕获 Cookie/localStorage、保存并返回。
- 只保存实际登录主机及所选入口，后续搜索、书架、分类和详情请求跟随该主机。不手动复制跨主机 Cookie，不写入网站令牌。
- 成功回调不再等待额外的应用网络请求。会话已捕获但直连请求被拦截时，不应因此阻止自动返回。
- 新增“检查会话保存”：通过应用已有 API 检查当前站点的 Cookie 数量、账号及验证 Cookie 是否存在；不显示 Cookie 值，不联网。
- “检查登录同步”和“检查验证”仍执行实际请求，分别确认网站账号及分类页是否可用；保存成功不能代替联网检查。

## 更新和验证

1. 更新包子源到 **2.2.4**，完全退出 VeneraNext 后重新启动。应用要求 1.18.0 或以上。
2. 在源设置确认“登录入口”为 `cn.bzmgcn.com`。打开“登录 → 网页登录”，由用户自行输入账号密码并完成验证。
3. 登录后若停在主页，点击网站“我的书架”。正常书架页应触发应用保存并返回。
4. 点击“检查会话保存”，确认当前站点以及账号/验证 Cookie 的保存状态；随后分别点“检查登录同步”“检查验证”。不要提供 Cookie 值或令牌。
5. 使用相同网络完成网页登录与后续请求，再分别检查搜索、详情和章节图片。Android 与 Windows 各自更新和验证。

如果 Cookie 显示已保存而请求仍被拦截，需要继续区分网络出口和浏览器环境差异；错误消息本身不能证明 Cookie 未保存，也不能据此认定必须修改应用。

## 现场实测：章节页主机与前置校验（2026-10-22）

用普通浏览器 UA 直连实测（未登录、无 Cookie），记录如下，供后续维护判断：

- 前置校验不是 Cloudflare：`https://cn.bzmgcn.com/` 返回 403，正文为
  `{"challenge_url":"/__gatekeeper_challenge/start?return=%2F","error":"challenge_required"}`。
  挑战页是纯工作量证明（无验证码、不依赖浏览器指纹），难度 16 bit，通过后下发
  `__Host-gk_clearance_<主机哈希>`，有效期约 3 分钟。
- 该类 Cookie 带 `__Host-` 前缀，**按主机绑定**：`cn.bzmgcn.com` 上的通过状态不能用于章节主机。
- 章节入口：详情页每个章节是 `/user/page_direct?comic_id=<slug>&section_slot=0&chapter_slot=N`，
  302 到 `https://cn.cnbzmg.com/comic/chapter/<slug>/0_<N>.html` 或 `https://cn.twbzmg.com/...`。
  **两个镜像按出口网络二选一：挂代理走 `cn.twbzmg.com`，直连走 `cn.cnbzmg.com`。**
  在 `cn.bzmgcn.com` 上请求同一路径同样会 302 到 `cn.cnbzmg.com` 并收到 403 挑战。
- 两个镜像的前置校验不同：同一条直连网络下 `cn.twbzmg.com` 的首页与章节页都是 200（无挑战），
  `cn.cnbzmg.com` 则需要先过 gatekeeper。因此 2.3.3 的 `loadEp` 先试 twbzmg 再试 cnbzmg。
- 章节页结构：`ul.comic-contain > amp-img.comic-contain__item[data-src]`，
  **没有** `.chapter-img` 包裹层；`data-src` 指向 `https://s1.bzcdn.net/scomic/...`。
- 图片本身不校验 `Referer`；质量前缀 `/w640/` 返回 WebP 缩略图，原图不加上下文也可直接取。
- `appcn.baozimh.com`（旧的移动版章节地址）当前返回 Cloudflare「Just a moment」页，且属于另一个主机，
  网页登录拿不到它的 Cookie，因此原 `loadEp` 的固定地址在真机上无法取图。

据此 2.3.3 把 `loadEp` 改成多候选并兼容现行 DOM。落到 `cn.twbzmg.com` 时通常不需要额外凭据；
只有落到 `cn.cnbzmg.com` 时才要求该主机自身通过校验。后续若要覆盖后一种情况，可选：让现有 WebView 登录流程
顺带访问一次任意章节页（使目标主机也拿到凭据），或在源脚本内自行完成校验；
两者都需要实机确认体验与时限，暂未实施。

## 已完成的检查与限制

```sh
node tools/validate.cjs
node tools/test-ui.cjs
node tools/test-baozi-verification.cjs
```

模拟回归覆盖 Android/Windows、两个主机的书架页、重定向后的请求主机、相似域名拒绝、原主机 UA 隔离、不联网的返回回调及 Cookie 状态消息不泄露值。完整真实登录、直连、搜索阅读和 Android/Windows 实机结果仍待验证。

仓库已有的 `patches/venera-next-webview-session.patch` 是此前准备的可选应用端改动，尚未编译验证，**不是这次源 JS 修复的安装前提**。本次没有构建、替换或发布 VeneraNext 应用。
