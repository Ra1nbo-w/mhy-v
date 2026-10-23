// 仓库检查入口：索引与源契约、发现页/分类、生命周期、包子登录回归，一次跑完。
// 用法：node tools/check.cjs（无账号、无网络依赖）
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");
const RAW = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/";
const PRIVATE = /C:[\\/]|PHPSESSID=[a-zA-Z0-9]{8}|github_pat_|ghp_[a-zA-Z0-9]{20}/;
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const sourceCode = (name) => fs.readFileSync(path.join(root, "sources", name + ".js"), "utf8");

/* ---------- 1. 索引与源契约 ---------- */

function validateCatalog() {
  const entries = readJson("index.json");
  assert(Array.isArray(entries), "index.json 必须是数组");
  assert.equal(
    entries.length,
    fs.readdirSync(path.join(root, "sources")).filter((f) => f.endsWith(".js")).length,
    "index.json 条目数应等于 sources/ 下的脚本数",
  );

  const declared = new Set();
  for (const item of entries) {
    const where = item.fileName || item.key;
    assert(/^\w+$/.test(item.key), `${where}: key 只能由字母、数字、下划线组成`);
    assert(/^\d+\.\d+\.\d+$/.test(item.version), `${where}: version 必须是 x.y.z`);
    assert.equal(typeof item.fileName, "string", `${where}: fileName 必填`);
    assert(/^sources\/[\w.-]+\.js$/.test(item.fileName), `${where}: fileName 必须是 sources/ 下的 .js 文件`);
    assert(item.url === RAW + item.fileName, `${where}: url 必须指向 main 分支的同名文件`);
    assert(!declared.has(item.fileName), `${where}: 同一个脚本被重复登记`);
    declared.add(item.fileName);

    const code = sourceCode(path.basename(item.fileName, ".js"));
    new vm.Script(code, { filename: item.fileName }); // 语法检查

    const pos = code.search(/class\s+\w+\s+extends\s+ComicSource/);
    assert(pos >= 0, `${where}: 找不到 class X extends ComicSource`);
    const body = code.slice(pos);
    for (const [field, value] of [
      ["name", item.name],
      ["key", item.key],
      ["version", item.version],
      ["url", item.url],
    ]) {
      const match = body.match(new RegExp("\\b" + field + "\\s*=\\s*([\"'])([^\"']*)\\1"));
      assert(match && match[2] === value, `${where}: ${field} 与索引不一致`);
    }

    const minApp = body.match(/\bminAppVersion\s*=\s*["']([^"']+)["']/);
    assert(minApp, `${where}: 缺少 minAppVersion`);
    assert(/^\d+\.\d+\.\d+$/.test(minApp[1]), `${where}: minAppVersion 必须是 x.y.z`);

    // 契约要求 tags/chapters 用普通对象、错误用 Error；这两类问题会静默出错，直接拦住。
    assert(!/\bnew\s+Map\s*\(/.test(code), `${where}: 契约不允许用 Map 存 tags/chapters`);
    assert(!/\bthrow\s+["'`]/.test(code), `${where}: 请抛 Error 实例，不要抛字符串`);
    assert(!PRIVATE.test(code), `${where}: 包含本机路径、Cookie 或令牌，禁止提交`);
  }

  // 反向检查：sources/ 下不允许有未登记的孤儿脚本。
  const orphans = fs
    .readdirSync(path.join(root, "sources"))
    .filter((f) => f.endsWith(".js"))
    .map((f) => "sources/" + f)
    .filter((f) => !declared.has(f));
  assert.equal(orphans.length, 0, `存在未登记的脚本: ${orphans.join(", ")}`);
  return entries.length;
}

/* ---------- 2. 发现页、分类与组合筛选 ---------- */

function uiSource(file, DocumentClass) {
  const requests = [];
  class ComicSource {
    loadSetting() {}
    loadData() {}
    saveData() {}
    deleteData() {}
  }
  class EmptyDocument {
    querySelectorAll() {
      return [];
    }
    querySelector() {
      return null;
    }
    dispose() {}
  }
  const Network = {
    get: async (url) => {
      requests.push(url);
      return { status: 200, body: file === "baozi" ? '"unused"' : "<html></html>" };
    },
    getCookies: () => [],
  };
  const context = vm.createContext({
    ComicSource,
    Comic: class { constructor(o) { Object.assign(this, o); } },
    ComicDetails: class {},
    HtmlDocument: DocumentClass || EmptyDocument,
    Network,
    UI: {},
    console,
  });
  const cls = sourceCode(file).match(/class\s+(\w+)\s+extends ComicSource/)[1];
  return { instance: vm.runInContext(sourceCode(file) + ";new " + cls + "()", context), requests };
}

async function discoverySuite() {
  const entries = readJson("index.json");
  for (const item of entries) {
    const { instance: s } = uiSource(path.basename(item.fileName, ".js"));
    assert.equal(s.explore.length, 1);
    assert.equal(s.explore[0].type, "multiPartPage");
    assert.equal(s.explore[0].title, item.name);
    assert.equal(s.category.title, item.name);
    for (const p of s.category.parts) {
      assert.notEqual(p.name, "常用");
      assert.equal(p.categories.length, p.categoryParams.length);
    }
  }
  {
    const { instance: s, requests } = uiSource("copy_manga");
    await s.categoryComics.load("冒险", "maoxian", ["popular", "0", "1"], 3);
    let u = new URL(requests.pop());
    assert.equal(u.searchParams.get("theme"), "maoxian");
    assert.equal(u.searchParams.get("region"), "0");
    assert.equal(u.searchParams.get("status"), "1");
    assert.equal(u.searchParams.get("ordering"), "-popular");
    assert.equal(u.searchParams.get("offset"), "100");
    await s.categoryComics.load("日本", "region:0", ["updated", "", ""], 1);
    u = new URL(requests.pop());
    assert.equal(u.searchParams.get("region"), "0");
    assert(!u.searchParams.has("theme"));
    await s.categoryComics.load("全新上架", "/newest", [], 2);
    u = new URL(requests.pop());
    assert.equal(u.pathname, "/newest");
    assert.equal(u.searchParams.get("offset"), "60");
    assert.equal(u.searchParams.get("limit"), "60");
    const count = requests.length;
    assert.equal((await s.categoryComics.ranking.load("Day", 2)).comics.length, 0);
    assert.equal(requests.length, count);
  }
  {
    const { instance: s, requests } = uiSource("mheee");
    await s.categoryComics.load("冒险", "13", ["5", "56", "64", "1"], 2);
    assert.equal(new URL(requests.pop()).pathname, "/m/list-13-5-64-56-0-1-2");
    await s.categoryComics.load("完结精选", "progress:64", ["0", "0", "0", "1"], 1);
    assert.equal(new URL(requests.pop()).pathname, "/m/list-0-0-64-0-0-1-1");
  }
  {
    const { instance: s, requests } = uiSource("mycomic");
    await s.categoryComics.load("爱情", "tag:aiqing", ["update", "japan", "shaonv", "0", "2025"], 2);
    const u = new URL(requests.pop());
    for (const [key, value] of Object.entries({ tag: "aiqing", country: "japan", audience: "shaonv", end: "0", year: "2025" })) {
      assert.equal(u.searchParams.get("filter[" + key + "]"), value);
    }
    assert.equal(u.searchParams.get("sort"), "-update");
    assert.equal(u.searchParams.get("page"), "2");
  }
  {
    const { instance: s, requests } = uiSource("baozi");
    s.getChecked = async (url) => {
      requests.push(url);
      return { status: 200, body: '{"items":[],"next":false}' };
    };
    await s.categoryComics.load("日本", "region:jp", ["all", "pub", "digits"], 2);
    const u = new URL(requests.pop());
    assert.equal(u.searchParams.get("type"), "all");
    assert.equal(u.searchParams.get("region"), "jp");
    assert.equal(u.searchParams.get("state"), "pub");
    assert.equal(u.searchParams.get("filter"), "0-9");
    assert.equal(u.searchParams.get("page"), "2");
  }
  {
    const { instance: s } = uiSource("komiic");
    let variables;
    s.query = async (q, v) => {
      variables = v;
      return { comicByCategories: [] };
    };
    await s.list("completed", 1, []);
    assert.equal(variables.pagination.status, "END");
    assert.equal(variables.categoryId.length, 0);
    assert.equal(s.category.parts.length, 7);
    assert.deepEqual(s.category.parts.map((part) => part.name), ["类型", "关系", "设定", "题材", "氛围", "客群", "形式"]);
    const item = s.category.parts[0];
    const index = item.categories.indexOf("黑暗奇幻");
    assert.equal(item.categoryParams[index], "57");
    await s.categoryComics.load("黑暗奇幻", "57", [], 1);
    assert.equal(variables.categoryId[0], "57");
    s.list = async () => ({ comics: [] });
    assert.deepEqual((await s.explore[0].load()).map((part) => part.title), ["最近更新", "本月热门", "人气漫画"]);
  }
  {
    const { instance: s, requests } = uiSource("manwa");
    s.page = async (p) => {
      requests.push(p);
      return { base: "https://manwark.cc", html: "" };
    };
    await s.categoryComics.load("韩国", "area:2", ["", "2", "newest", "0"], 2);
    let u = new URL("https://manwark.cc" + requests.pop());
    assert.equal(u.searchParams.get("area"), "2");
    assert.equal(u.searchParams.get("end"), "2");
    assert.equal(u.searchParams.get("gender"), "0");
    assert.equal(u.searchParams.get("sort"), "2");
    assert.equal(u.searchParams.get("page"), "2");
    await s.categoryComics.load("全彩", "全彩", [], 1);
    u = new URL("https://manwark.cc" + requests.pop());
    assert.equal(u.searchParams.get("tag"), "全彩");
    assert.equal(u.searchParams.get("gender"), "-1");
  }
  {
    const { instance: s } = uiSource("mheee");
    s.list = async () => ({ comics: [] });
    assert.deepEqual((await s.explore[0].load()).map((part) => part.title), ["最近更新", "最高评分"]);
  }
  {
    // MYCOMIC 的首页精选/推荐给你来自首页列表切片，用合成页面固定索引位置。
    class HomeDocument {
      querySelectorAll(selector) {
        if (selector !== "a[href*='/cn/comics/']") return [];
        return Array.from({ length: 18 }, (_, i) => ({
          attributes: { href: "/cn/comics/" + (i + 1) },
          querySelector: (part) => (part === "img" ? { attributes: { src: "https://biccam.com/comics/" + (i + 1) + ".jpg", alt: "Book " + (i + 1) } } : null),
        }));
      }
      dispose() {}
    }
    const { instance: s, requests } = uiSource("mycomic", HomeDocument);
    const parts = await s.explore[0].load();
    assert.deepEqual(parts.map((part) => part.title), ["首页精选", "推荐给你", "最近更新", "最新上架"]);
    assert.equal(parts[0].comics[0].id, "1");
    assert.equal(parts[1].comics[0].id, "13");
    assert.equal(requests.length, 3);
    s.originalExplore[0].load = async () => {
      throw new Error("listing blocked");
    };
    assert.deepEqual((await s.explore[0].load()).map((part) => part.title), ["首页精选", "推荐给你", "最近更新"]);
  }
  return entries.length;
}

/* ---------- 3. 文档生命周期与并发 ---------- */

function lifecycleSource(name) {
  const state = { open: 0, created: 0, fail: false, status: 200, images: null };
  class ComicSource {
    loadData() {}
    saveData() {}
    deleteData() {}
    loadSetting(key) {
      return this.settings[key]?.default;
    }
  }
  class Document {
    constructor() {
      state.open++;
      state.created++;
      this.closed = false;
    }
    querySelector() {
      if (state.fail) throw new Error("parser failure");
      return null;
    }
    querySelectorAll() {
      if (state.fail) throw new Error("parser failure");
      return state.images || [];
    }
    dispose() {
      assert(!this.closed);
      this.closed = true;
      state.open--;
    }
  }
  const context = {
    ComicSource,
    HtmlDocument: Document,
    Comic: class { constructor(x) { Object.assign(this, x); } },
    ComicDetails: class { constructor(x) { Object.assign(this, x); } },
    APP: { platform: "windows" },
    UI: {},
    Network: { get: async () => ({ status: state.status, body: "<html></html>" }), deleteCookies() {} },
  };
  const code = sourceCode(name);
  const cls = code.match(/class\s+(\w+)\s+extends ComicSource/)[1];
  return { s: vm.runInNewContext(code + ";new " + cls + "()", context), state };
}

async function lifecycleSuite() {
  for (const name of ["mycomic", "baozi"]) {
    const { s, state } = lifecycleSource(name);
    const actions =
      name === "mycomic"
        ? [
            ...s.originalExplore.map((part) => () => part.load(1)),
            () => s.originalCategoryComics.load("", "", [], 1),
            () => s.categoryComics.ranking.load("views", 1),
            () => s.search.load("test", [], 1),
            () => s.comic.loadInfo("1"),
            () => s.comic.loadEp("1", "1"),
          ]
        : [() => s.upstreamExplore[0].load(), () => s.search.load("test", [], 1), () => s.favorites.loadComics(1), () => s.comic.loadInfo("1"), () => s.comic.loadEp("1", "1")];
    for (const fail of [false, true]) {
      for (const action of actions) {
        state.fail = fail;
        const count = state.created;
        await action().catch(() => {});
        const created = state.created - count;
        // 包子章节页会依次尝试多个候选主机，最多开 4 个文档；其余解析器只允许 1 个。
        const maxDocs = name === "baozi" && action === actions[actions.length - 1] ? 4 : 1;
        assert(created >= 1, name + " parser must run");
        assert(created <= maxDocs, name + " opened too many documents");
        assert.equal(state.open, 0, name + " leaked document");
      }
    }
  }
  {
    const { s, state } = lifecycleSource("mycomic");
    state.status = 404;
    // 旧 loadInfo 已删除：列表解析只保留 readChapterGroups 一条路径，避免两套逻辑漂移。
    assert.equal(typeof s.originalComic.loadInfo, "undefined", "原 loadInfo 必须已删除");
    await assert.rejects(s.comic.loadInfo("1"), /HTTP 404/);
    assert.equal(state.created, 0);
  }
  {
    const { s, state } = lifecycleSource("baozi");
    state.images = [{ querySelector: () => ({ attributes: { "data-src": "//cdn.example.test/acomic/book/page.jpg" } }) }];
    const result = await s.comic.loadEp("1", "1");
    assert.equal(result.images[0], "https://cdn.example.test/w640/acomic/book/page.jpg");
    assert.equal(state.open, 0);
    state.images = [];
    await assert.rejects(s.comic.loadEp("1", "1"), /未取得图片/);
    assert.equal(state.open, 0);
  }
  {
    const { s } = lifecycleSource("manwa");
    let url;
    s.list = async (p) => {
      url = p;
      return { comics: [] };
    };
    await s.categoryComics.load("更多", "/booklist?tag=%E6%82%AC%E7%96%91&area=2&page=9", [], 2);
    const u = new URL("https://example.test" + url);
    assert.equal(u.pathname, "/booklist");
    assert.equal(u.searchParams.get("tag"), "悬疑");
    assert.equal(u.searchParams.get("area"), "2");
    assert(!u.searchParams.has("page"));
  }
  {
    const { s } = lifecycleSource("komiic");
    const pending = [];
    s.query = () => new Promise((resolve) => pending.push(resolve));
    const ticket = { kid: "fixture", url: "/fixture", ticket: "synthetic-test-only", expiresAt: Date.now() + 60000 };
    const old = s.ticket("fixture");
    const joined = s.ticket("fixture");
    assert.equal(pending.length, 1);
    const oldRejected = assert.rejects(old, /登录状态已变化/);
    const joinedRejected = assert.rejects(joined, /登录状态已变化/);
    s.account.logout();
    const fresh = s.ticket("fixture");
    assert.equal(pending.length, 2);
    pending[0]({ getImageTicket: ticket });
    await Promise.all([oldRejected, joinedRejected]);
    assert(s.ticketRequests.fixture);
    assert(!s.tickets.fixture);
    pending[1]({ getImageTicket: ticket });
    await fresh;
    assert(s.tickets.fixture);
    s.account.logout();
    assert.equal(Object.keys(s.tickets).length, 0);
    const chapter = s.comic.loadEp("1", "ep_1");
    const chapterRejected = assert.rejects(chapter, /登录状态已变化/);
    s.account.logout();
    pending[2]({ imageTicketsByChapterId: [ticket] });
    await chapterRejected;
    assert.equal(Object.keys(s.tickets).length, 0);
  }
}

/* ---------- 4. 包子登录、会话与验证 ---------- */

function baoziSource(platform, session, manual, host = "www.baozimh.com") {
  const requests = [];
  const data = { _webviewSession: session, settings: host ? { loginHost: host } : {} };
  const messages = [];
  let construction = true;
  class ComicSource {
    loadSetting(key) {
      // 应用在新设置注册前解析账号登录网址，此时读设置会抛 Setting not found。
      if (construction) throw new Error("Bad state: Setting not found: " + key);
      return key === "browserUA" ? manual : key === "loginHost" ? host : undefined;
    }
    loadData(key) {
      return data[key];
    }
    saveData(key, value) {
      data[key] = value;
    }
    deleteData(key) {
      delete data[key];
    }
  }
  const Network = {
    getCookies: () => [],
    get: async (url, headers) => {
      requests.push({ url, headers });
      return { status: 200, body: '<div class="comics-card">example</div>' };
    },
  };
  const context = vm.createContext({ ComicSource, Network, APP: { platform }, UI: { showMessage: (message) => messages.push(message) } });
  const source = vm.runInContext(sourceCode("baozi") + ";new Baozi()", context);
  const parsedLoginUrl = source.account.loginWithWebview.url;
  assert(parsedLoginUrl.endsWith("/user/my_bookshelf"));
  construction = false;
  return { source, requests, Network, data, messages };
}

async function baoziSuite() {
  for (const platform of ["android", "windows"]) {
    const ua = platform + " actual WebView";
    const { source: s, requests, Network, messages } = baoziSource(platform, { origin: "https://www.baozimh.com", platform, userAgent: ua });
    await s.getChecked("https://www.baozimh.com/classify");
    assert.equal(requests[0].headers["User-Agent"], ua);
    assert.equal(requests[0].headers["cache-time"], "no");
    await s.getChecked("https://appcn.baozimh.com/chapter");
    assert.equal(requests[1].headers["User-Agent"], undefined);
    const check = s.account.loginWithWebview.checkStatus;
    assert.equal(s.account.loginWithWebview.url, s.baseUrl + "/user/my_bookshelf");
    for (const p of ["/user/my_bookshelf", "/user/my_bookshelf/?page=1#books"]) {
      assert(check("https://www.baozimh.com" + p, "我的書架 - 包子漫畫"));
    }
    for (const title of ["正在验证浏览器", "Just a moment", "登录 - 包子漫画", ""]) {
      assert(!check("https://www.baozimh.com/user/my_bookshelf", title));
    }
    for (const url of [
      "https://www.baozimh.com.evil.test/user/my_bookshelf",
      "http://www.baozimh.com/user/my_bookshelf",
      "https://www.baozimh.com/user/login",
      "https://www.baozimh.com/",
      "https://www.baozimh.com/classify",
    ]) {
      assert(!check(url, "我的书架 - 包子漫画"));
    }
    assert(!check(s.baseUrl + "/user/my_bookshelf", "分类 - 包子漫画"));
    const success = s.account.loginWithWebview.onLoginSuccess;
    for (const body of [
      '<title>分类 - 包子漫画</title><div class="comics-card"></div>',
      '<title>我的书架 - 包子漫画</title><script>const text="退出登录";</script>',
      "<!-- <a>登出</a> --><p>退出登录</p><a>登录</a>",
      "<a>说明</a>退出登录<a>首页</a>",
      '<input type="password"><button>退出登录</button>',
    ]) {
      Network.get = async () => ({ status: 200, body });
      await assert.rejects(s.checkWebsiteAccount(), /网站账号尚未同步/);
      assert.equal(messages.length, 0);
    }
    Network.get = async () => {
      throw new Error("connection timeout");
    };
    await assert.rejects(s.checkWebsiteAccount(), /connection timeout/);
    // 保存浏览器会话不应等待新的应用请求（直连被拦时也要能立即返回）。
    success();
    assert.equal(messages.length, 1);
    for (const body of ['<a href="/user/logout">退出登录</a>', "<button><span>登出</span></button>", "<a>修改密碼</a>"]) {
      Network.get = async () => ({ status: 200, body });
      await s.checkWebsiteAccount();
    }
    assert.equal(messages.length, 1);
    Network.get = async () => ({ status: 200, body: "<title>Just a moment</title>" });
    await assert.rejects(s.getChecked(s.baseUrl), /被拦截/);
    Network.get = async () => ({ status: 403, body: "Forbidden" });
    await assert.rejects(s.getChecked(s.baseUrl), /被拦截/);
  }
  const { source: legacy } = baoziSource("android");
  assert.equal(baoziSource("android", null, legacy.legacyBrowserUA).source.browserUA, "");
  assert.equal(baoziSource("android", { origin: legacy.baseUrl, platform: "windows", userAgent: "wrong" }).source.browserUA, "");
  assert.equal(baoziSource("windows", { origin: "https://other.test", platform: "windows", userAgent: "wrong" }).source.browserUA, "");
  assert.equal(baoziSource("windows", null, "actual manual UA").source.browserUA, "actual manual UA");
  for (const platform of ["android", "windows"]) {
    for (const host of ["cn.bzmgcn.com", "www.baozimh.com"]) {
      const origin = "https://" + host;
      const { source: s, data, requests, Network, messages } = baoziSource(platform, { origin, platform, userAgent: platform + " UA" }, undefined, host);
      assert.equal(s.baseUrl, origin);
      assert.equal(s.account.loginWithWebview.url, origin + "/user/my_bookshelf");
      const check = s.account.loginWithWebview.checkStatus;
      for (const title of ["我的书架 - 包子漫画", "我的書架 - 包子漫畫"]) {
        assert(check(origin + "/user/my_bookshelf?tab=all", title));
        assert.equal(data._baoziWebLogin.origin, origin);
      }
      for (const url of [origin + ".evil.test/user/my_bookshelf", "http://" + host + "/user/my_bookshelf", origin + "/user/signin", origin + "/classify", origin + "/user/my_bookshelf-extra"]) {
        assert(!check(url, "我的书架 - 包子漫画"));
        assert.equal(data._baoziWebLogin.origin, origin);
      }
      await s.getChecked(s.baseUrl + "/search?q=test");
      assert.equal(requests.at(-1).headers.Referer, origin + "/");
      assert.equal(requests.at(-1).headers["User-Agent"], platform + " UA");
      const redirected = host === "cn.bzmgcn.com" ? "https://www.baozimh.com" : "https://cn.bzmgcn.com";
      assert(check(redirected + "/user/my_bookshelf", "我的书架 - 包子漫画"));
      assert.equal(s.baseUrl, redirected);
      assert.equal(s.browserUA, ""); // 原主机的 UA 不复用
      await s.getChecked(s.baseUrl + "/search?q=test");
      assert.equal(requests.at(-1).url, redirected + "/search?q=test");
      assert.equal(requests.at(-1).headers.Referer, redirected + "/");
      const stale = baoziSource(platform, undefined, undefined, host);
      stale.data._baoziWebLogin = { origin: redirected, entryHost: "different-entry" };
      assert.equal(stale.source.baseUrl, origin);
      stale.data._baoziWebLogin = { origin: "https://evil.test", entryHost: host };
      assert.equal(stale.source.baseUrl, origin);
      Network.getCookies = () => [
        { name: "TSID", value: "test-only-account-value" },
        { name: "__Host-gk_browser_test", value: "test-only-browser-value" },
        { name: "__Host-gk_clearance_test", value: "test-only-clearance-value" },
      ];
      s.settings.savedSession.callback();
      assert(messages.at(-1).includes("账号 Cookie：已保存"));
      assert(messages.at(-1).includes("验证 Cookie：已保存"));
      assert(!messages.at(-1).includes("test-only-"));
    }
  }
  assert.equal(baoziSource("android", undefined, undefined, null).source.baseUrl, "https://cn.bzmgcn.com");
  const upgrade = baoziSource("windows", undefined, undefined, null);
  upgrade.data.settings = { domains: "baozimh.com", language: "cn" };
  assert.equal(upgrade.source.account.loginWithWebview.url, "https://cn.bzmgcn.com/user/my_bookshelf");
  upgrade.data.settings.loginHost = "www.baozimh.com";
  assert.equal(upgrade.source.account.loginWithWebview.url, "https://www.baozimh.com/user/my_bookshelf");
  upgrade.data.settings.loginHost = "evil.test";
  assert.equal(upgrade.source.account.loginWithWebview.url, "https://cn.bzmgcn.com/user/my_bookshelf");
}

/* ---------- 入口 ---------- */

(async () => {
  const count = validateCatalog();
  console.log(`PASS: 索引与源契约（${count} 个源，元数据/更新地址一致、key 唯一、语法正确）`);
  assert.equal(await discoverySuite(), count);
  console.log(`PASS: 发现页与分类（${count} 个源各一个 multiPartPage，组合筛选与分页）`);
  await lifecycleSuite();
  console.log("PASS: 文档生命周期（成功/异常释放、HTTP 错误、图片地址、分类链接、票据并发）");
  await baoziSuite();
  console.log("PASS: 包子登录（首装/升级、Android/Windows、同源请求、Cookie 状态不泄露）");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
