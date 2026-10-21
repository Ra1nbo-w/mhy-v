// 本地定制版 2026-10-19；基于 venera-app/venera-configs 同名公开源修改。
// 上游参考及修改说明见 NOTICE.md；更新由本仓库提供。
class Baozi extends ComicSource {
  // 此漫画源的名称
  name = "包子漫画";

  // 唯一标识符
  key = "baozi";

  version = "2.3.0";

  minAppVersion = "1.18.0";

  // 更新链接
  url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/baozi.js";

  settings = {
    language: {
      title: "简繁切换",
      type: "select",
      options: [
        { value: "cn", text: "简体" },
        { value: "tw", text: "繁體" },
      ],
      default: "cn",
    },
    domains: {
      title: "主域名",
      type: "select",
      options: [
        { value: "bzmgcn.com" },
        { value: "baozimhcn.com" },
        { value: "webmota.com" },
        { value: "kukuc.co" },
        { value: "twmanga.com" },
        { value: "dinnerku.com" },
      ],
      default: "bzmgcn.com",
    },
    cdn_domains: {
      title: "图片资源站域名",
      type: "select",
      options: [
        { value: "as-rsa1-usla.baozicdn.com" },
        { value: "ascn-a3.bzcdn.net" },
        { value: "asgb-a3.bzcdn.net" },
        { value: "as.baozimh.com" },
        { value: "s1.baozicdn.com" },
        { value: "", text: "默认" },
      ],
      default: "",
    },
    image_quality: {
      title: "图片质量",
      type: "select",
      options: [
        {
          value: "/w640",
          text: "640p"
        },
        {
          value: "",
          text: "原图"
        }
      ],
      default: "/w640",
    },
  };

  // 动态生成完整域名
  get lang() {
    return this.loadSetting("language") || this.settings.language.default;
  }
  get baseUrl() {
    let domain = this.loadSetting("domains") || this.settings.domains.default;
    return `https://${this.lang}.${domain}`;
  }

  /// 账号
  /// 设置为null禁用账号功能
  account = {
    /// 登录
    /// 返回任意值表示登录成功
    login: async (account, pwd) => {
      let res = await Network.post(
        `${this.baseUrl}/api/bui/signin`,
        {
          "content-type":
            "multipart/form-data; boundary=----WebKitFormBoundaryFUNUxpOwyUaDop8s",
        },
        '------WebKitFormBoundaryFUNUxpOwyUaDop8s\r\nContent-Disposition: form-data; name="username"\r\n\r\n' +
        account +
        '\r\n------WebKitFormBoundaryFUNUxpOwyUaDop8s\r\nContent-Disposition: form-data; name="password"\r\n\r\n' +
        pwd +
        "\r\n------WebKitFormBoundaryFUNUxpOwyUaDop8s--\r\n"
      );
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let json = JSON.parse(res.body);
      let token = json.data;
      Network.setCookies(this.baseUrl, [
        new Cookie({
          name: "TSID",
          value: token,
          domain: this.loadSetting("domains") || this.settings.domains.default,
        }),
      ]);
      return "ok";
    },

    // 退出登录时将会调用此函数
    logout: function () {
      Network.deleteCookies(
        this.loadSetting("domains") || this.settings.domains.default
      );
    },

    get registerWebsite() {
      return `${this.baseUrl}/user/signup`;
    },
  };

  /// 解析漫画列表
  parseComic(e) {
    let url = e.querySelector("a").attributes["href"];
    let id = url.split("/").pop();
    let title = e.querySelector("h3").text.trim();
    let cover = e.querySelector("a > amp-img").attributes["src"];
    let tags = e.querySelectorAll("div.tabs > span").map((e) => e.text.trim());
    let description = e.querySelector("small").text.trim();
    return {
      id: id,
      title: title,
      cover: cover,
      tags: tags,
      description: description,
    };
  }

  parseJsonComic(e) {
    return {
      id: e.comic_id,
      title: e.name,
      subTitle: e.author,
      cover: `https://static-tw.baozimh.com/cover/${e.topic_img}?w=285&h=375&q=100`,
      tags: e.type_names,
    };
  }

  /// 探索页面
  /// 一个漫画源可以有多个探索页面
  explore = [
    {
      /// 标题
      /// 标题同时用作标识符, 不能重复
      title: "包子漫画",

      /// singlePageWithMultiPart 或者 multiPageComicList
      type: "singlePageWithMultiPart",

      load: async () => {
        var res = await this.getChecked(this.baseUrl);
        if (res.status !== 200) {
          throw "Invalid status code: " + res.status;
        }
        let document = new HtmlDocument(res.body);
        let parts = document.querySelectorAll("div.index-recommend-items");
        let result = {};
        for (let part of parts) {
          let title = part.querySelector("div.catalog-title").text.trim();
          let comics = part
            .querySelectorAll("div.comics-card")
            .map((e) => this.parseComic(e));
          if (comics.length > 0) {
            result[title] = comics;
          }
        }
        return result;
      },
    },
  ];

  /// 分类页面
  /// 一个漫画源只能有一个分类页面, 也可以没有, 设置为null禁用分类页面
  category = {
    /// 标题, 同时为标识符, 不能与其他漫画源的分类页面重复
    title: "包子漫画",
    parts: [
      {
        name: "类型",

        // fixed 或者 random
        // random用于分类数量相当多时, 随机显示其中一部分
        type: "fixed",

        // 如果类型为random, 需要提供此字段, 表示同时显示的数量
        // randomNumber: 5,

        categories: [
          "全部",
          "恋爱",
          "纯爱",
          "古风",
          "异能",
          "悬疑",
          "剧情",
          "科幻",
          "奇幻",
          "玄幻",
          "穿越",
          "冒险",
          "推理",
          "武侠",
          "格斗",
          "战争",
          "热血",
          "搞笑",
          "大女主",
          "都市",
          "总裁",
          "后宫",
          "日常",
          "韩漫",
          "少年",
          "其它",
        ],

        // category或者search
        // 如果为category, 点击后将进入分类漫画页面, 使用下方的`categoryComics`加载漫画
        // 如果为search, 将进入搜索页面
        itemType: "category",

        // 若提供, 数量需要和`categories`一致, `categoryComics.load`方法将会收到此参数
        categoryParams: [
          "all",
          "lianai",
          "chunai",
          "gufeng",
          "yineng",
          "xuanyi",
          "juqing",
          "kehuan",
          "qihuan",
          "xuanhuan",
          "chuanyue",
          "mouxian",
          "tuili",
          "wuxia",
          "gedou",
          "zhanzheng",
          "rexie",
          "gaoxiao",
          "danuzhu",
          "dushi",
          "zongcai",
          "hougong",
          "richang",
          "hanman",
          "shaonian",
          "qita",
        ],
      },
    ],
    enableRankingPage: false,
  };

  /// 分类漫画页面, 即点击分类标签后进入的页面
  categoryComics = {
    load: async (category, param, options, page) => {
      let res = await this.getChecked(
        `${this.baseUrl}/api/bzmhq/amp_comic_list?type=${param.startsWith('region:')?'all':param}&region=${param.startsWith('region:')?param.slice(7):(options[0]||'all')}&state=${options[1]||'all'}&filter=${encodeURIComponent(options[2]==='digits'?'0-9':(options[2]||'*'))}&page=${page}&limit=36&language=${this.lang}&__amp_source_origin=${this.baseUrl}`
      );
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let maxPage = null;
      let json = JSON.parse(res.body);
      if (!json.next) {
        maxPage = page;
      }
      return {
        comics: json.items.map((e) => this.parseJsonComic(e)),
        maxPage: maxPage,
      };
    },
    // 提供选项
    optionList: [
      {
        options: ["all-全部", "cn-国漫", "jp-日本", "kr-韩国", "en-欧美"],
      },
      {
        options: ["all-全部", "serial-连载中", "pub-已完结"],
      },
      {options:["*-全部首字母","ABCD-ABCD","EFGH-EFGH","IJKL-IJKL","MNOP-MNOP","QRST-QRST","UVW-UVW","XYZ-XYZ","digits-数字"]},
    ],
  };

  /// 搜索
  search = {
    load: async (keyword, options, page) => {
      let res = await this.getChecked(`${this.baseUrl}/search?q=${encodeURIComponent(keyword)}`);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let document = new HtmlDocument(res.body);
      let comics = document
        .querySelectorAll("div.comics-card")
        .map((e) => this.parseComic(e));
      return {
        comics: comics,
        maxPage: 1,
      };
    },

    // 提供选项
    optionList: [],
  };

  /// 收藏
  favorites = {
    /// 是否为多收藏夹
    multiFolder: false,
    /// 添加或者删除收藏
    addOrDelFavorite: async (comicId, folderId, isAdding) => {
      if (!isAdding) {
        let res = await Network.post(
          `${this.baseUrl}/user/operation_v2?op=del_bookmark&comic_id=${comicId}`
        );
        if (!res.status || res.status >= 400) {
          throw "Invalid status code: " + res.status;
        }
        return "ok";
      } else {
        let res = await Network.post(
          `${this.baseUrl}/user/operation_v2?op=set_bookmark&comic_id=${comicId}&chapter_slot=0`
        );
        if (!res.status || res.status >= 400) {
          throw "Invalid status code: " + res.status;
        }
        return "ok";
      }
    },
    // 加载收藏夹, 仅当multiFolder为true时有效
    // 当comicId不为null时, 需要同时返回包含该漫画的收藏夹
    loadFolders: null,
    /// 加载漫画
    loadComics: async (page, folder) => {
      let res = await this.getChecked(`${this.baseUrl}/user/my_bookshelf`);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let document = new HtmlDocument(res.body);
      function parseComic(e) {
        let title = e.querySelector("h4 > a").text.trim();
        let url = e.querySelector("h4 > a").attributes["href"];
        let id = url.split("/").pop();
        let author = e
          .querySelector("div.info > ul")
          .children[1].text.split("：")[1]
          .trim();
        let description = e
          .querySelector("div.info > ul")
          .children[4].children[0].text.trim();

        return {
          id: id,
          title: title,
          subTitle: author,
          description: description,
          cover: e.querySelector("amp-img").attributes["src"],
        };
      }
      let comics = document
        .querySelectorAll("div.bookshelf-items")
        .map((e) => parseComic(e));
      return {
        comics: comics,
        maxPage: 1,
      };
    },
  };

  /// 单个漫画相关
  comic = {
    // 加载漫画信息
    loadInfo: async (id) => {
      let res = await this.getChecked(`${this.baseUrl}/comic/${id}`);
      if (res.status !== 200) {
        throw "Invalid status code: " + res.status;
      }
      let document = new HtmlDocument(res.body);

      let title = document.querySelector("h1.comics-detail__title").text.trim();
      let cover = document.querySelector("div.l-content > div > div > amp-img")
        .attributes["src"];
      let author = document
        .querySelector("h2.comics-detail__author")
        .text.trim();
      let tags = document
        .querySelectorAll("div.tag-list > span")
        .map((e) => e.text.trim());
      tags = [...tags.filter((e) => e !== "")];
      let updateTime = document
        .querySelector("div.supporting-text > div > span > em")
        ?.text.trim()
        .replace("(", "")
        .replace(")", "");
      if (!updateTime) {
        const getLastChapterText = () => {
          // 合并所有章节容器（处理可能存在多个列表的情况）
          const containers = [
            ...document.querySelectorAll(
              "#chapter-items, #chapters_other_list"
            ),
          ];
          let allChapters = [];
          containers.forEach((container) => {
            const chapters = container.querySelectorAll(".comics-chapters > a");
            allChapters.push(...Array.from(chapters));
          });
          const lastChapter = allChapters[allChapters.length - 1];
          return (
            lastChapter?.querySelector("div > span")?.text.trim() ||
            "暂无更新信息"
          );
        };
        updateTime = getLastChapterText();
      }
      let description = document
        .querySelector("p.comics-detail__desc")
        .text.trim();
      let chapters = new Map();
      let i = 0;
      for (let c of document.querySelectorAll(
        "div#chapter-items > div.comics-chapters > a > div > span"
      )) {
        chapters.set(i.toString(), c.text.trim());
        i++;
      }
      for (let c of document.querySelectorAll(
        "div#chapters_other_list > div.comics-chapters > a > div > span"
      )) {
        chapters.set(i.toString(), c.text.trim());
        i++;
      }
      if (i === 0) {
        // 将倒序的最新章节反转
        const spans = Array.from(
          document.querySelectorAll("div.comics-chapters > a > div > span")
        ).reverse();
        for (let c of spans) {
          chapters.set(i.toString(), c.text.trim());
          i++;
        }
      }
      let recommend = [];
      for (let c of document.querySelectorAll("div.recommend--item")) {
        if (c.querySelectorAll("div.tag-comic").length > 0) {
          let title = c.querySelector("span").text.trim();
          let cover = c.querySelector("amp-img").attributes["src"];
          let url = c.querySelector("a").attributes["href"];
          let id = url.split("/").pop();
          recommend.push({
            id: id,
            title: title,
            cover: cover,
          });
        }
      }
      // updateTime 将 Y年 M月 D日 转化为 Y-M-D
      let updateDate = updateTime
        .replace(/年/g, "-")
        .replace(/月/g, "-")
        .replace(/日/g, "");

      return new ComicDetails({
        title: title,
        cover: cover,
        description: description,
        tags: {
          作者: [author],
          标签: tags,
        },
        chapters: chapters,
        recommend: recommend,
        updateTime: updateDate,
      });
    },
    loadEp: async (comicId, epId) => {
      const images = [];

      // App版链接
      let currentPageUrl = `https://appcn.baozimh.com/baozimhapp/comic/chapter/${comicId}/0_${epId}.html`;

      const res = await this.getChecked(currentPageUrl);
      if (res.status !== 200) {
        throw `Invalid status code: ${res.status}`;
      }

      const doc = new HtmlDocument(res.body);

      // 解析当前页图片(App 版)
      const imageNodes = doc.querySelectorAll(".comic-contain > .chapter-img");
      imageNodes.forEach((imgNode) => {
        let imgUrl = imgNode.querySelector(".comic-contain__item")?.attributes?.["data-src"];
        if (imgUrl) {
          const match = imgUrl.match(/^(https?:\/\/)?([^/\s:]+)(:\d+)?(\/[a-z]comic\/.*)/);
          if (match) {
            const domain = this.loadSetting("cdn_domains") === "" ? match[2] : this.loadSetting("cdn_domains");
            imgUrl = `${match[1]}${domain}${this.loadSetting("image_quality")}${match[4]}`;
          }
          images.push(imgUrl);
        }
      });
      return { images: images };
    },
  };

  // __Host- 验证 Cookie 不能跨主机复用；网页登录与目录请求使用同一主机。
  get loginHost() {
    // Account URLs are parsed before the new settings schema is registered.
    // Construction reads allow saved data, but loadSetting(newKey) can throw
    // on first install or when upgrading from a source without that key.
    const saved = this.loadData('settings');
    const host = saved && saved.loginHost;
    return ['cn.bzmgcn.com', 'www.baozimh.com'].includes(host) ? host : 'cn.bzmgcn.com';
  }
  websiteOrigin(url) {
    const match = /^https:\/\/(?:cn\.bzmgcn\.com|www\.baozimh\.com)(?=\/|[?#]|$)/.exec(url || '');
    return match ? match[0] : null;
  }
  get baseUrl() {
    const session = this.loadData('_baoziWebLogin');
    if (session && session.entryHost === this.loginHost &&
        this.websiteOrigin(session.origin) === session.origin) return session.origin;
    return 'https://' + this.loginHost;
  }
  get browserUA(){
    const manual = (this.loadSetting('browserUA') || '').trim();
    // 旧版默认值不是本机 WebView 的身份，升级后不能继续当作有效配置。
    if (manual && manual !== this.legacyBrowserUA) return manual;
    const session = this.loadData('_webviewSession');
    if (session && session.origin === this.baseUrl &&
        session.platform === APP.platform && typeof session.userAgent === 'string') {
      return session.userAgent.trim();
    }
    return '';
  }
  legacyBrowserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0';
  isVerificationPage(body) {
    return /__gatekeeper_challenge|正在验证浏览器|正在驗證瀏覽器|Sorry,\s*you have been blocked|<title[^>]*>[^<]*(?:just a moment|验证|驗證|checking your browser)|window\._cf_chl_opt/i.test(body || '');
  }
  verificationError() {
    return new Error('包子源请求在 ' + this.baseUrl + ' 被拦截。请在本源内置网页登录，登录后进入“我的书架”并等待自动返回，再点“检查会话保存”和“检查验证”。Cookie 已保存也可能仍被网站拦截；这条错误本身不能证明 Cookie 未保存。请保持网页登录与源请求使用同一网络。');
  }
  // 将站点自己的验证页识别为需要人工处理，不能把它保存为图片。
  async getChecked(url, headers, extra) {
    const requestHeaders={...headers};
    const origin = this.websiteOrigin(url);
    if(origin){
      if (this.browserUA && origin === this.baseUrl) requestHeaders['User-Agent']=this.browserUA;
      requestHeaders['Referer']=origin+'/';
      // 不重复读取验证前缓存的页面；不手工复制跨域 Cookie。
      requestHeaders['cache-time']='no';
    }
    const r = await Network.get(url, requestHeaders, extra);
    if (r.status === 403 || this.isVerificationPage(r.body)) throw this.verificationError();
    if (r.status !== 200) throw new Error('包子漫画请求失败：HTTP '+r.status);
    return r;
  }
  originalCategory = this.category;
  category = {...this.originalCategory,parts:[...this.originalCategory.parts.map(p=>({...p,name:'题材'})),{"name":"地区","type":"fixed","itemType":"category","categories":["国漫","日本","韩国","欧美"],"categoryParams":["region:cn","region:jp","region:kr","region:en"]}]};
  upstreamExplore = this.explore;
  explore = [{title:'包子漫画', type:'multiPartPage', load:async()=>{
    const parts = await this.upstreamExplore[0].load();
    return Object.keys(parts).map(title=>{
      const p={title,comics:parts[title].slice(0,6)},region=/国漫|國漫/.test(title)?'cn':/韩漫|韓漫/.test(title)?'kr':/日漫/.test(title)?'jp':null;
      if(region||/热血|熱血/.test(title))p.viewMore={page:'category',attributes:{category:title,param:region?'region:'+region:'rexie'}};return p;
    });
  }}];
  upstreamAccount = this.account;
  async checkWebsiteAccount() {
    const r = await this.getChecked(this.baseUrl + '/user/my_bookshelf');
    // Ignore script/template strings: only rendered account controls count.
    const html = (r.body || '').replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
    const controls = html.match(/<(?:a|button)\b[^>]*>[\s\S]*?<\/(?:a|button)\s*>/gi) || [];
    const hasAccountControl = controls.some(control => /^(?:退出(?:登录|登入)?|登出|注销|註銷|修改密[码碼])$/.test(control.replace(/<[^>]*>/g, '').replace(/\s+/g, '')));
    const hasLoginForm = /<input\b[^>]*type\s*=\s*["']?password\b/i.test(html);
    if (!hasAccountControl || hasLoginForm) {
      throw new Error('网站账号尚未同步：请在内置网页登录后点击“我的书架”，等待自动返回。若停在主页，请先进入书架；验证通过不等于账号登录。');
    }
  }
  account = (()=> {
    const source=this;
    return {
    logout: ()=>Network.deleteCookies(this.baseUrl),
    loginWithWebview: {
      // Account login must reach the bookshelf, not a public classification page.
      get url(){return source.baseUrl+'/user/my_bookshelf';},
      checkStatus:(url,title)=> {
        const origin = this.websiteOrigin(url);
        if (!origin || !/^\/user\/my_bookshelf\/?(?:[?#].*)?$/.test(url.slice(origin.length))) return false;
        if (/验证|驗證|moment|blocked|Cloudflare|gatekeeper|checking|登录|登入|login|sign\s*in/i.test(title || '')) return false;
        if (!/书架|書架/.test(title || '')) return false;
        // The host captures cookies from this exact landing URL. Keep later
        // requests on its origin; never transplant __Host- cookies to another.
        const session = this.loadData('_baoziWebLogin');
        if (!session || session.origin !== origin || session.entryHost !== this.loginHost) {
          this.saveData('_baoziWebLogin', {origin, entryHost:this.loginHost});
        }
        return true;
      },
      // Cookie capture has already completed here. An unrelated blocked HTTP
      // request must not prevent the host from returning to the app.
      onLoginSuccess:()=>UI.showMessage('内置网页会话已保存（'+this.baseUrl+'）。可点“检查会话保存”确认 Cookie，再检查登录同步。')
    }
    };
  })();
  sourceSettings = Object.fromEntries(Object.entries(this.settings).filter(([key])=>key !== 'domains'));
  settings = {...this.sourceSettings,
    loginHost:{title:'登录入口（切换后重新登录；请求跟随登录成功的站点）',type:'select',options:[{value:'cn.bzmgcn.com',text:'cn.bzmgcn.com'},{value:'www.baozimh.com',text:'www.baozimh.com'}],default:'cn.bzmgcn.com'},
    browserUA:{title:'高级：本机内置 WebView User-Agent（可留空）',type:'input',default:'',validator:null},
    language:{title:'语言（验证入口使用简体线路）',type:'select',options:[{value:'cn',text:'简体'}],default:'cn'},
    website:{title:'外部浏览器（仅查看网站，不会同步验证）',type:'callback',buttonText:'打开网站',callback:()=>UI.launchUrl(this.baseUrl)},
    savedSession:{title:'仅检查本机已保存 Cookie（不联网、不显示 Cookie 值）',type:'callback',buttonText:'检查会话保存',callback:()=>{
      const cookies=Network.getCookies(this.baseUrl+'/user/my_bookshelf') || [];
      const hasAccount=cookies.some(c=>c.name === 'TSID' && !!c.value);
      const hasVerification=cookies.some(c=>/^__Host-(?:gk_browser_|gk_clearance_)|^cf_clearance$/.test(c.name) && !!c.value);
      UI.showMessage('当前站点：'+this.baseUrl+'；可用 Cookie '+cookies.length+' 项；账号 Cookie：'+(hasAccount?'已保存':'未发现')+'；验证 Cookie：'+(hasVerification?'已保存':'未发现')+'。这里只检查保存状态，不代表源请求已通过网站验证。');
    }},
    checkSession:{title:'网页登录后检查源请求',type:'callback',buttonText:'检查登录同步',callback:async()=>{
      await this.checkWebsiteAccount();
      UI.showMessage('源请求能读取登录后的书架；返回发现页刷新。');
    }},
    checkVerification:{title:'仅检查分类页验证（不要求书架已登录）',type:'callback',buttonText:'检查验证',callback:async()=>{
      const r=await this.getChecked(this.baseUrl+'/classify?type=all&region=cn&state=all&filter=%2a');
      if(!/comics-card|amp-list|分类|分類/.test(r.body || '')) throw new Error('页面未包含预期分类内容，尚不能确认验证通过。');
      UI.showMessage('源请求已读取分类页。请继续测试搜索和阅读；网站账号登录和章节图片需分别确认。');
    }}
  };
  upstreamComic = this.comic;
  comic = {...this.upstreamComic,
    loadEp:async(id,ep)=>{
      const result=await this.upstreamComic.loadEp(id,ep);
      if(!result.images.length)throw new Error('未取得包子章节图片，请先完成验证；若仍失败，可能是阅读接口已变化。');
      return result;
    }
  };


    _checkedComic = this.comic;
    comic = {...this._checkedComic, loadInfo:async id=>{
        const info=await this._checkedComic.loadInfo(id);
        if(!info.tags)info.tags={};
        if(info.tags instanceof Map)info.tags=Object.fromEntries(info.tags);
        return info;
    }};

}

