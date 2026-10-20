# 包子漫画验证流程修订（2.2.1）

本版本修复网页登录完成判定过严、固定 Windows Edge UA 被用于 Android，以及验证页缓存的问题。网页通过验证后，应用应保存该内置 WebView 的会话；外部浏览器的登录状态不会自动同步到应用。

## 当前状态

- 源脚本、三份索引一致性、发现/分类接口及 Android/Windows 会话标识逻辑已通过 Node 回归测试。
- Android 和 Windows 真机验证尚未完成，不能将本版本视为已解决所有 Gatekeeper 拦截。
- VeneraNext 1.18.0 未把网页登录的真实 User-Agent 提供给源。自动同步依赖本仓库 `patches/venera-next-webview-session.patch`，需要在应用源码中应用、检查并重新构建；更新源文件不会自动安装该补丁。
- 应用端补丁附带 Flutter 测试修改，但本次环境没有 Flutter SDK，未运行 Flutter 分析、测试或平台构建。

## 手动验证

1. 在漫画源管理中更新包子漫画到 2.2.1，完全退出应用后重新打开。
2. 打开本源账号入口，选择“网页登录”，在应用内置网页中手动完成站点验证。默认使用无需账号的分类页完成会话同步。
3. 正常页面加载后应自动返回。返回仅表示会话已同步，不代表已登录网站账号或源请求已经通过验证。
4. 在源设置点击“检查验证”，然后分别测试发现、搜索、详情和章节图片。
5. Android 与 Windows 分别验证，使用相同的网络出口。更换设备或 WebView 版本后重新验证；不要把另一台设备的 UA 当作当前设备配置。

原版 1.18.0 若仍被拦截，可在高级设置手动填写本机内置 WebView 的真实 User-Agent，或使用应用端补丁构建版本。不要使用通用 UA、旧版固定 Edge UA 或外部浏览器的值冒充本机内置 WebView。本仓库不包含任何真实 Cookie、令牌或验证凭据。

## 开发检查

```sh
node tools/validate.cjs
node tools/test-ui.cjs
node tools/test-baozi-verification.cjs
```

回归测试验证接口契约，不代替站点联网、网站账号登录或真机阅读测试。
