// 本地定制版 2026-10-19；基于 venera-app/venera-configs 同名公开源修改。
// 上游参考及修改说明见随包文档；无自动更新，避免覆盖本地页面设计。
/** @type {import('./_venera_.js')} */

const BASE_URL = "https://mycomic.com/cn";
const CDN_URL = "https://biccam.com";
const REFERER = "https://mycomic.com/";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const headers = {
    "User-Agent": UA,
    "Referer": REFERER,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
};

/**
 * Check if the response is a Cloudflare challenge page
 * @param {number} status
 * @param {string} body
 * @returns {boolean}
 */
function isCloudflareChallenge(status, body) {
    if (status === 403 || status === 503) {
        if (body && (body.indexOf("challenge-platform") !== -1 ||
            body.indexOf("cf-browser-verification") !== -1 ||
            body.indexOf("Just a moment") !== -1 ||
            body.indexOf("__cf_chl_") !== -1)) {
            return true;
        }
        return true;
    }
    if (body && body.indexOf("challenge-platform") !== -1) {
        return true;
    }
    return false;
}

/**
 * Wrapper for Network.get that detects Cloudflare challenges
 * and throws a user-friendly error guiding them to login
 * @param {string} url
 * @returns {Promise<{status: number, headers: object, body: string}>}
 */
async function fetchWithCFCheck(url) {
    const resp = await Network.get(url, headers);
    if (isCloudflareChallenge(resp.status, resp.body)) {
        throw "Cloudflare 验证拦截：请在漫画源设置中点击「登录」，在内置浏览器完成验证后重试；若显示 blocked，需检查网络或联系网站，不能保证解除。";
    }
    return resp;
}

/**
 * Extract meta tag content from raw HTML
 * @param {string} html
 * @param {string} name - meta name or property (e.g. "description", "og:title")
 * @returns {string|null}
 */
function getMetaContent(html, name) {
    // pattern 1: <meta name="x" content="y"> or <meta property="x" content="y">
    let m = new RegExp(
        "<meta[^>]*?(?:name|property)=['\"]" + escapeRegex(name) + "['\"][^>]*?content=['\"]([^'\"]*)['\"]",
        "i"
    ).exec(html);
    if (m) return m[1];
    // pattern 2: <meta content="y" name="x"> or <meta content="y" property="x">
    m = new RegExp(
        "<meta[^>]*?content=['\"]([^'\"]*)['\"][^>]*?(?:name|property)=['\"]" + escapeRegex(name) + "['\"]",
        "i"
    ).exec(html);
    if (m) return m[1];
    return null;
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse comic list from an HtmlDocument
 * Finds all <a> links to /cn/comics/{id} that contain an <img> with a CDN cover
 * @param {HtmlDocument} doc
 * @returns {Comic[]}
 */
function parseComicList(doc) {
    const links = doc.querySelectorAll("a[href*='/cn/comics/']");
    const comics = [];
    const seen = new Set();

    links.forEach((a) => {
        const href = a.attributes["href"] || "";
        const match = /\/cn\/comics\/(\d+)/.exec(href);
        if (!match) return;
        const id = match[1];
        if (seen.has(id)) return;

        const img = a.querySelector("img");
        if (!img) return;

        // Cover: prefer data-src (lazy-loaded), fallback to src
        let cover = img.attributes["data-src"] || img.attributes["src"] || "";
        if (!cover || cover.indexOf("biccam.com/comics/") === -1) return;

        // Title from alt attribute
        const title = (img.attributes["alt"] || "").trim() || id;

        // Latest chapter info
        let description = "";
        const chapterDiv = a.querySelector("div.truncate");
        if (chapterDiv) {
            description = chapterDiv.text.trim();
        }

        seen.add(id);
        comics.push(
            new Comic({
                id: id,
                title: title,
                cover: cover,
                description: description,
                language: "zh-Hans",
            })
        );
    });

    return comics;
}

/**
 * Extract max page number from pagination links in raw HTML
 * @param {string} html
 * @returns {number}
 */
function parseMaxPage(html) {
    const pageMatches = html.match(/(?:href="[^"]*page=)(\d+)/g);
    if (!pageMatches) return 1;
    let max = 1;
    pageMatches.forEach((m) => {
        const n = parseInt(m.replace(/.*page=/, ""), 10);
        if (!isNaN(n) && n > max) max = n;
    });
    return max;
}

/**
 * Build a comics listing URL with optional filters
 * @param {number} page
 * @param {string} sort - sort param (e.g. "-update", "-views", "-id")
 * @param {string} q - search keyword
 * @param {string} filterType - "tag" | "country" | "audience" | "year" | "end"
 * @param {string} filterValue - filter value
 * @returns {string}
 */
function buildComicsUrl(page, sort, q, filterType, filterValue) {
    const params = [];
    if (q) params.push("q=" + encodeURIComponent(q));
    if (sort) params.push("sort=" + sort);
    if (filterType && filterValue) {
        params.push("filter[" + filterType + "]=" + filterValue);
    }
    if (page && page > 1) params.push("page=" + page);
    const query = params.join("&");
    return BASE_URL + "/comics" + (query ? "?" + query : "");
}

class MyComic extends ComicSource {
    name = "MYCOMIC";

    key = "mycomic";

    version = "2.2.0";

    minAppVersion = "1.16.0";

    url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mycomic.js";

    init() {
        // Check if cf_clearance cookie exists; if not, the user may need to "login"
        const cookies = Network.getCookies("https://mycomic.com");
        let hasCfClearance = false;
        if (cookies && cookies.length > 0) {
            for (let i = 0; i < cookies.length; i++) {
                if (cookies[i].name === "cf_clearance") {
                    hasCfClearance = true;
                    break;
                }
            }
        }
        if (!hasCfClearance) {
            console.log("[MyComic] No cf_clearance cookie found. User may need to login.");
        }
    }

    // ==================== Account (Cloudflare bypass) ====================

    account = {
        // Method 1: WebView login - opens mycomic.com in a real browser engine
        // The browser will automatically solve Cloudflare's JS challenge,
        // and the resulting cf_clearance cookie will be stored for Network requests.
        loginWithWebview: {
            url: "https://mycomic.com/cn",
            checkStatus: (url, title) => {
                // Cloudflare challenge page has title "Just a moment..." or similar
                // After the challenge is passed, the real site loads
                if (!url || !title) return false;
                if (title.indexOf("moment") !== -1) return false;
                if (title.indexOf("Cloudflare") !== -1) return false;
                if (title.indexOf("challenge") !== -1) return false;
                // Success: we're on the actual mycomic.com page
                if (url.indexOf("mycomic.com") !== -1) return true;
                return false;
            },
            onLoginSuccess: () => {
                // Cookies from WebView should be synced with Network API automatically.
                // Log for debugging.
                const cookies = Network.getCookies("https://mycomic.com");
                console.log("[MyComic] Login success. Cookies: " + (cookies ? cookies.length : 0));
            },
        },

        // Method 2: Manual cookie input - user can paste cf_clearance value
        // obtained from their browser's dev tools
        loginWithCookies: {
            fields: ["cf_clearance"],
            validate: async (values) => {
                if (!values || !values[0]) return false;
                // Set the cf_clearance cookie
                Network.setCookies("https://mycomic.com", [
                    new Cookie({
                        name: "cf_clearance",
                        value: values[0],
                        domain: ".mycomic.com",
                    }),
                ]);
                // Validate by trying to fetch the homepage
                try {
                    const resp = await Network.get(
                        "https://mycomic.com/cn",
                        headers
                    );
                    return resp.status === 200 &&
                        !isCloudflareChallenge(resp.status, resp.body);
                } catch (e) {
                    return false;
                }
            },
        },

        logout: () => {
            Network.deleteCookies("https://mycomic.com");
        },

        registerWebsite: null,
    };

    // ==================== Explore ====================

    explore = [
        {
            title: "最新上架",
            type: "multiPageComicList",
            load: async (page) => {
                if (!page) page = 1;
                const url = buildComicsUrl(page, "-id");
                const resp = await fetchWithCFCheck(url);
                if (resp.status !== 200) throw "HTTP " + resp.status;
                const doc = new HtmlDocument(resp.body);
                const comics = parseComicList(doc);
                const maxPage = parseMaxPage(resp.body);
                return { comics, maxPage };
            },
        },
        {
            title: "最近更新",
            type: "multiPageComicList",
            load: async (page) => {
                if (!page) page = 1;
                const url = buildComicsUrl(page, "-update");
                const resp = await fetchWithCFCheck(url);
                if (resp.status !== 200) throw "HTTP " + resp.status;
                const doc = new HtmlDocument(resp.body);
                const comics = parseComicList(doc);
                const maxPage = parseMaxPage(resp.body);
                return { comics, maxPage };
            },
        },
        {
            title: "最高人气",
            type: "multiPageComicList",
            load: async (page) => {
                if (!page) page = 1;
                const url = buildComicsUrl(page, "-views");
                const resp = await fetchWithCFCheck(url);
                if (resp.status !== 200) throw "HTTP " + resp.status;
                const doc = new HtmlDocument(resp.body);
                const comics = parseComicList(doc);
                const maxPage = parseMaxPage(resp.body);
                return { comics, maxPage };
            },
        },
    ];

    // ==================== Category ====================

    category = {
        title: "MYCOMIC",
        parts: [
            {
                name: "作品类型",
                type: "fixed",
                categories: [
                    "魔幻", "魔法", "热血", "冒险", "悬疑", "侦探", "爱情",
                    "校园", "搞笑", "四格", "科幻", "神鬼", "舞蹈", "音乐",
                    "百合", "后宫", "机战", "格斗", "恐怖", "萌系", "武侠",
                    "社会", "历史", "耽美", "励志", "职场", "生活", "治愈",
                    "伪娘", "黑道", "战争", "竞技", "体育", "美食", "腐女",
                    "宅男", "推理", "杂志",
                ],
                itemType: "category",
                categoryParams: [
                    "tag:mohuan", "tag:mofa", "tag:rexue", "tag:maoxian",
                    "tag:xuanyi", "tag:zhentan", "tag:aiqing", "tag:xiaoyuan",
                    "tag:gaoxiao", "tag:sige", "tag:kehuan", "tag:shengui",
                    "tag:wudao", "tag:yinyue", "tag:baihe", "tag:hougong",
                    "tag:jizhan", "tag:gedou", "tag:kongbu", "tag:mengxi",
                    "tag:wuxia", "tag:shehui", "tag:lishi", "tag:danmei",
                    "tag:lizhi", "tag:zhichang", "tag:shenghuo", "tag:zhiyu",
                    "tag:weiniang", "tag:heidao", "tag:zhanzheng", "tag:jingji",
                    "tag:tiyu", "tag:meishi", "tag:funv", "tag:zhainan",
                    "tag:tuili", "tag:zazhi",
                ],
            },
            {
                name: "作品地区",
                type: "fixed",
                categories: ["日本", "港台", "欧美", "内地", "韩国", "其他"],
                itemType: "category",
                categoryParams: [
                    "country:japan", "country:hongkong", "country:europe",
                    "country:china", "country:korea", "country:other",
                ],
            },
            {
                name: "适合受众",
                type: "fixed",
                categories: ["少女", "少年", "青年", "儿童", "通用"],
                itemType: "category",
                categoryParams: [
                    "audience:shaonv", "audience:shaonian", "audience:qingnian",
                    "audience:ertong", "audience:tongyong",
                ],
            },
            {
                name: "出品年份",
                type: "fixed",
                categories: [
                    "2026", "2025", "2024", "2023", "2022", "2021",
                    "2020", "2019", "2018", "2017", "2016", "2015",
                    "2014", "2013", "2012", "2011", "2010",
                    "00年代", "90年代", "80年代", "70年代或更早",
                ],
                itemType: "category",
                categoryParams: [
                    "year:2026", "year:2025", "year:2024", "year:2023",
                    "year:2022", "year:2021", "year:2020", "year:2019",
                    "year:2018", "year:2017", "year:2016", "year:2015",
                    "year:2014", "year:2013", "year:2012", "year:2011",
                    "year:2010", "year:200x", "year:199x", "year:198x",
                    "year:197x",
                ],
            },
            {
                name: "目前进度",
                type: "fixed",
                categories: ["连载中", "已完结"],
                itemType: "category",
                categoryParams: ["end:0", "end:1"],
            },
        ],
        enableRankingPage: true,
    };

    // ==================== Category Comics ====================

    categoryComics = {
        load: async (category, param, options, page) => {
            if (!page) page = 1;

            // Parse filter type and value from param (format: "type:value")
            let filterType = null;
            let filterValue = null;
            let sort = "-id";

            if (param) {
                const parts = param.split(":");
                if (parts.length >= 2) {
                    filterType = parts[0];
                    filterValue = parts.slice(1).join(":");
                }
            }

            // Get sort option
            if (options && options.length > 0 && options[0]) {
                sort = options[0];
            }

            const url = buildComicsUrl(page, sort, null, filterType, filterValue);
            const resp = await fetchWithCFCheck(url);
            if (resp.status !== 200) throw "HTTP " + resp.status;

            const doc = new HtmlDocument(resp.body);
            const comics = parseComicList(doc);
            const maxPage = parseMaxPage(resp.body);

            return { comics, maxPage };
        },

        optionList: [
            {
                options: [
                    "-id-最新上架",
                    "-update-最近更新",
                    "-views-最高人气",
                ],
            },
        ],

        ranking: {
            options: [
                "-views-历史排行",
                "-week-週排行",
                "-month-月排行",
            ],
            load: async (option, page) => {
                if (!page) page = 1;
                const sort = option || "-views";
                const url =
                    BASE_URL +
                    "/rank?sort=" +
                    sort +
                    (page > 1 ? "&page=" + page : "");
                const resp = await fetchWithCFCheck(url);
                if (resp.status !== 200) throw "HTTP " + resp.status;

                const doc = new HtmlDocument(resp.body);
                const comics = parseComicList(doc);
                const maxPage = parseMaxPage(resp.body);

                return { comics, maxPage };
            },
        },
    };

    // ==================== Search ====================

    search = {
        load: async (keyword, options, page) => {
            if (!page) page = 1;
            const kw = (keyword || "").trim();
            if (!kw) return { comics: [], maxPage: 1 };

            let sort = null;
            if (options && options.length > 0 && options[0]) {
                sort = options[0];
            }

            const url = buildComicsUrl(page, sort, kw);
            const resp = await fetchWithCFCheck(url);
            if (resp.status !== 200) throw "HTTP " + resp.status;

            const doc = new HtmlDocument(resp.body);
            const comics = parseComicList(doc);
            const maxPage = parseMaxPage(resp.body);

            return { comics, maxPage };
        },

        optionList: [
            {
                type: "select",
                options: [
                    "-id-最新上架",
                    "-update-最近更新",
                    "-views-最高人气",
                ],
                label: "排序",
                default: null,
            },
        ],

        enableTagsSuggestions: false,
    };

    // ==================== Comic Detail ====================

    comic = {
        loadInfo: async (id) => {
            const url = BASE_URL + "/comics/" + id;
            const resp = await fetchWithCFCheck(url);
            if (resp.status !== 200) throw "HTTP " + resp.status;

            const html = resp.body;
            const doc = new HtmlDocument(html);

            // Parse meta tags
            let title = getMetaContent(html, "og:title") || id;
            title = title.replace(/\s*-\s*MYCOMIC.*$/, "").trim();

            const description = getMetaContent(html, "description") || "";
            const author = getMetaContent(html, "author") || "";
            const cover =
                getMetaContent(html, "og:image") ||
                CDN_URL + "/comics/" + id + ".jpg";
            const keywords = getMetaContent(html, "keywords") || "";

            // Parse tags from filter links on the page
            const tags = new Map();
            const tagLinks = doc.querySelectorAll(
                "a[href*='filter%5Btag%5D']"
            );
            const tagNames = [];
            tagLinks.forEach((a) => {
                const text = a.text.trim();
                if (text) tagNames.push(text);
            });
            if (tagNames.length) tags.set("类型", tagNames);

            // Parse additional info from keywords
            const keywordList = keywords
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            if (author) tags.set("作者", [author]);

            // Try to extract country and audience from keywords
            const countryMap = {
                日本: "日本",
                内地: "内地",
                韩国: "韩国",
                欧美: "欧美",
                港台: "港台",
                其他: "其他",
            };
            const audienceMap = {
                少年: "少年",
                少女: "少女",
                青年: "青年",
                儿童: "儿童",
                通用: "通用",
            };
            const countries = [];
            const audiences = [];
            keywordList.forEach((kw) => {
                if (countryMap[kw]) countries.push(kw);
                if (audienceMap[kw]) audiences.push(kw);
            });
            if (countries.length) tags.set("地区", countries);
            if (audiences.length) tags.set("受众", audiences);

            // Parse chapter list from Alpine.js x-data
            // The x-data attribute contains: chapters: [{"id":96338,"title":"第16回"}, ...]
            const chapters = new Map();
            const chapterMatch = /chapters:\s*(\[[\s\S]*?\])/.exec(html);
            if (chapterMatch) {
                try {
                    const chapterList = JSON.parse(chapterMatch[1]);
                    chapterList.forEach((ch) => {
                        chapters.set(String(ch.id), ch.title);
                    });
                } catch (e) {
                    // Fallback: try to find chapter links in the page
                    const chapterLinks = doc.querySelectorAll(
                        "a[href*='/cn/chapters/']"
                    );
                    chapterLinks.forEach((a) => {
                        const href = a.attributes["href"] || "";
                        const m = /\/cn\/chapters\/(\d+)/.exec(href);
                        if (m) {
                            const chTitle = a.text.trim();
                            if (chTitle && !chapters.has(m[1])) {
                                chapters.set(m[1], chTitle);
                            }
                        }
                    });
                }
            }

            return new ComicDetails({
                title: title,
                cover: cover,
                description: description,
                tags: tags,
                chapters: chapters,
                thumbnails: [cover],
                url: url,
                uploader: author || undefined,
            });
        },

        loadEp: async (comicId, epId) => {
            if (!epId) {
                throw "No episode id";
            }
            const url = BASE_URL + "/chapters/" + epId;
            const resp = await fetchWithCFCheck(url);
            if (resp.status !== 200) throw "HTTP " + resp.status;

            const doc = new HtmlDocument(resp.body);
            // Chapter images have class "page" and src or data-src from biccam.com/chapters/
            const imgs = doc.querySelectorAll("img.page");
            const images = [];

            if (imgs.length > 0) {
                imgs.forEach((img) => {
                    let src =
                        img.attributes["data-src"] ||
                        img.attributes["src"] ||
                        "";
                    if (src && src.indexOf("biccam.com/chapters/") !== -1) {
                        images.push(src);
                    }
                });
            }

            // Fallback: find all imgs with src containing biccam.com/chapters/
            if (images.length === 0) {
                const allImgs = doc.querySelectorAll("img");
                allImgs.forEach((img) => {
                    let src =
                        img.attributes["data-src"] ||
                        img.attributes["src"] ||
                        "";
                    if (src && src.indexOf("biccam.com/chapters/") !== -1) {
                        images.push(src);
                    }
                });
            }

            return { images: images };
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                url: url,
                headers: {
                    "Referer": REFERER,
                    "User-Agent": UA,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Sec-Fetch-Dest": "image",
                    "Sec-Fetch-Mode": "no-cors",
                    "Sec-Fetch-Site": "cross-site",
                },
            };
        },

        onThumbnailLoad: (url) => {
            return {
                url: url,
                headers: {
                    "Referer": REFERER,
                    "User-Agent": UA,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Sec-Fetch-Dest": "image",
                    "Sec-Fetch-Mode": "no-cors",
                    "Sec-Fetch-Site": "cross-site",
                },
            };
        },

        onClickTag: (namespace, tag) => {
            return {
                page: "search",
                attributes: {
                    keyword: tag,
                },
            };
        },

        link: {
            domains: ["mycomic.com"],
            linkToId: (url) => {
                const m = /https?:\/\/(?:www\.)?mycomic\.com\/(?:cn\/)?comics\/(\d+)/.exec(
                    url
                );
                if (!m) return null;
                return m[1];
            },
        },
    };

    // 来源名称只使用 MYCOMIC；分区集中在一个发现页面。
    originalExplore = this.explore;
    explore = [{title:'MYCOMIC',type:'multiPartPage',load:async()=>{
        const home=await fetchWithCFCheck('https://mycomic.com/cn');
        const doc=new HtmlDocument(home.body);
        let featured;try{featured=parseComicList(doc).slice(0,6);}finally{doc.dispose();}
        const result=featured.length?[{title:'首页精选',comics:featured}]:[];
        for(const [title,i]of [['最近更新',1],['最新上架',0]]){
            const list=await this.originalExplore[i].load(1);result.push({title,comics:list.comics.slice(0,6),viewMore:{page:'category',attributes:{category:title,param:'sort:'+(i===1?'update':'id')}}});
        }
        for(const [title,sort]of [['周排行','-week'],['月排行','-month'],['历史排行','-views']]){
            const list=await this.originalCategoryComics.ranking.load(sort,1);result.push({title,comics:list.comics.slice(0,6),viewMore:{page:'category',attributes:{category:title,param:'rank:'+sort.slice(1)}}});
        }
        return result;
    }}];
    settings = {
        website:{title:'网站 / 验证失败时检查拦截原因',type:'callback',buttonText:'打开 MYCOMIC',callback:()=>UI.launchUrl('https://mycomic.com/cn')}
    };
    originalCategory = this.category;
    category = {...this.originalCategory,parts:[{"name":"常用","type":"fixed","itemType":"category","categories":["全部漫画","最近更新","最新上架","人气漫画"],"categoryParams":["","sort:update","sort:id","sort:views"]},...this.originalCategory.parts.map((p,i)=>({...p,name:['题材','地区','受众','年份','进度'][i]}))]};
    originalCategoryComics = this.categoryComics;
    categoryComics = {
        ...this.originalCategoryComics,
        // Venera 用第一个连字符分隔选项值，负号不能直接放在值前。
        optionList:[{notShowWhen:["周排行","月排行","历史排行"],options:['id-最新上架','update-最近更新','views-最高人气']},{notShowWhen:["周排行","月排行","历史排行"],options:['-全部地区','japan-日本','hongkong-港台','europe-欧美','china-内地','korea-韩国','other-其他']},{notShowWhen:["周排行","月排行","历史排行"],options:['-全部受众','shaonv-少女','shaonian-少年','qingnian-青年','ertong-儿童','tongyong-通用']},{notShowWhen:["周排行","月排行","历史排行"],options:['-全部进度','0-连载中','1-已完结']},{notShowWhen:["周排行","月排行","历史排行"],options:['-全部年份',...this.originalCategory.parts[3].categoryParams.map((p,i)=>p.slice(5)+'-'+this.originalCategory.parts[3].categories[i])]}],
        load:async(c,p,o=[],page=1)=>{
            if(p?.startsWith('rank:'))return this.originalCategoryComics.ranking.load('-'+p.slice(5),page);
            const filters={country:o[1]||'',audience:o[2]||'',end:o[3]||'',year:o[4]||''};let sort=o[0]||'id';
            if(p){const [key,value]=p.split(':');if(key==='sort')sort=value;else if(['tag','country','audience','end','year'].includes(key))filters[key]=value;}
            let url=buildComicsUrl(page,'-'+sort);for(const key of Object.keys(filters))if(filters[key]!=='')url+='&filter['+key+']='+encodeURIComponent(filters[key]);
            const response=await fetchWithCFCheck(url),doc=new HtmlDocument(response.body);try{return{comics:parseComicList(doc),maxPage:parseMaxPage(response.body)};}finally{doc.dispose();}
        },
        ranking:{options:['views-历史排行','week-周排行','month-月排行'],load:async(o,p)=>this.originalCategoryComics.ranking.load('-'+(o||'views'),p)}
    };
    // 只有真实站点标题才结束 WebView；Access denied/Blocked 不能当作成功。
    account = {
        loginWithWebview:{url:'https://mycomic.com/cn',checkStatus:(url,title)=>
            /^https:\/\/mycomic\.com(?:\/|$)/.test(url||'') && /MYCOMIC/i.test(title||'') && !/moment|challenge|blocked|denied|cloudflare|验证|驗證/i.test(title||'')},
        logout:()=>Network.deleteCookies('https://mycomic.com')
    };
    originalComic = this.comic;
    chapterArrays(text){
        const found=[],re=/(?:\bchapters|["']chapters["'])\s*:\s*\[/g;let match;
        while((match=re.exec(text))){
            const start=re.lastIndex-1;let depth=0,quote='',escape=false,end=start;
            for(;end<text.length;end++){
                const ch=text[end];
                if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}
                if(ch==='"'||ch==="'"){quote=ch;continue;}
                if(ch==='[')depth++;else if(ch===']'&&!--depth){end++;break;}
            }
            if(depth)continue;
            try{const rows=JSON.parse(text.slice(start,end));if(Array.isArray(rows)&&rows.every(r=>r&&r.id!=null&&typeof r.title==='string'))found.push(rows);}catch(_){}
            re.lastIndex=Math.max(re.lastIndex,end);
        }
        return found;
    }
    readChapterGroups(doc,html){
        const buckets={'单话':[],'单行本':[],'番外篇':[]},seen={};
        const put=(rows,label)=>{
            if(!rows.length)return;
            if(!/^(单话|单行本|番外篇)$/.test(label)){
                const title=rows.map(r=>r.title).join(' ');
                label=/第\s*\d+\s*[话話]/.test(title)?'单话':/第\s*\d+\s*[卷巻]/.test(title)?'单行本':'番外篇';
            }
            const unique=rows.filter(row=>{const id=String(row.id);if(!/^\d+$/.test(id)||seen[id])return false;seen[id]=true;return true;});
            const nums=unique.map(r=>r.title.match(/\d+(?:\.\d+)?/)).filter(Boolean).map(m=>Number(m[0]));
            if(nums.length>1&&nums[0]>nums[nums.length-1])unique.reverse();
            buckets[label].push(...unique);
        };
        // 每组 Alpine 数据都要读取；不能第一个番外数组成功后就停止。
        for(const node of doc.querySelectorAll('[x-data]')){
            const heading=(node.querySelector('h2')||node.querySelector('h3'))?.text.trim()||'';
            const label=/单话|單話/.test(heading)?'单话':/单行本|單行本/.test(heading)?'单行本':/番外/.test(heading)?'番外篇':'';
            for(const rows of this.chapterArrays(node.attributes['x-data']||''))put(rows,label);
        }
        // 服务端内联数据同样逐组读取，ID 去重避免重复目录。
        for(const rows of this.chapterArrays(html))put(rows,'');
        // 无 JSON 的静态章节页只接受有章节文字的链接，排除开始阅读与侧栏其他作品。
        const links=[];
        for(const a of doc.querySelectorAll('a')){
            const m=(a.attributes.href||'').match(/\/cn\/chapters\/(\d+)(?:[/?#]|$)/),title=a.text.trim();
            if(m&&/^(?:第?\s*\d|番外|特别|特別|完结|完結|短篇|序章)/.test(title))links.push({id:m[1],title});
        }
        // 动态目录已经完整时，旁栏章节链接不参与补齐。
        if(!Object.keys(seen).length)put(links,'');
        const result={};for(const name of ['单话','单行本','番外篇'])if(buckets[name].length){
            result[name]={};for(const row of buckets[name])result[name]['ep_'+row.id]=row.title;
        }
        return result;
    }
    comic = {...this.originalComic,
        loadInfo:async id=>{
            if(!/^\d+$/.test(id))throw new Error('无效 MYCOMIC 作品 ID。');
            const response=await fetchWithCFCheck(BASE_URL+'/comics/'+id),html=response.body,doc=new HtmlDocument(html);
            try{
                const chapters=this.readChapterGroups(doc,html);
                if(!Object.keys(chapters).length)throw new Error('MYCOMIC 未取得章节目录，请完成验证或等待源适配网站变化。');
                const tags={},author=getMetaContent(html,'author')||'';
                const genre=doc.querySelectorAll("a[href*='filter%5Btag%5D']").map(a=>a.text.trim()).filter(Boolean);
                if(author)tags['作者']=[author];if(genre.length)tags['类型']=[...new Set(genre)];
                return new ComicDetails({title:(getMetaContent(html,'og:title')||id).replace(/\s*-\s*MYCOMIC.*$/,'').trim(),cover:getMetaContent(html,'og:image')||CDN_URL+'/comics/'+id+'.jpg',description:getMetaContent(html,'description')||'',tags,chapters,url:BASE_URL+'/comics/'+id,uploader:author||undefined});
            }finally{doc.dispose();}
        },
        loadEp:async(id,ep)=>{
            const result=await this.originalComic.loadEp(id,String(ep).replace(/^ep_/,''));
            if(!result.images.length)throw new Error('MYCOMIC 未取得章节图片，请完成验证后重试。');
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
