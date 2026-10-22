// 瓜子漫画 — guazimanhua.com
// 站点是 PHP 服务端渲染的静态模板：列表 article.card、详情带 JSON-LD ComicStory + .cinema-strip、
// 章节页 .reading-image，图片在 img.guazicdn.com（实测不校验 Referer）。
// 2026-10-23 按线上结构编写；只解析 HTML 与 JSON-LD，不执行网站 JavaScript。
class GuaziManhua extends ComicSource {
    name = "瓜子漫画";
    key = "guazimanhua";
    version = "1.0.0";
    minAppVersion = "1.16.0";
    url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/guazimanhua.js";
    base = "https://www.guazimanhua.com";

    absolute(path) {
        const value = String(path || "").trim();
        if (/^https?:\/\//i.test(value)) return value;
        if (value.startsWith("//")) return "https:" + value;
        return value ? this.base + "/" + value.replace(/^\/+/, "") : "";
    }
    headers() {
        return {
            "Referer": this.base + "/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        };
    }
    async html(path) {
        const response = await Network.get(this.absolute(path), this.headers());
        if (response.status !== 200) throw new Error("瓜子漫画网页请求失败：HTTP " + response.status);
        return response.body;
    }
    // 列表页的翻页条只给出附近的页码，取最大值即可；没有翻页条时按"是否满一页"推进。
    maxPage(document, page, count) {
        let max = 0;
        for (const node of document.querySelectorAll("nav.pager a")) {
            const match = String(node.attributes["href"] || "").match(/page=(\d+)/);
            if (match) max = Math.max(max, Number(match[1]));
        }
        if (max > 0) return Math.max(max, page);
        return count >= 36 ? page + 1 : page;
    }
    parseCards(document) {
        const comics = [], seen = {};
        for (const card of document.querySelectorAll("article.card")) {
            const link = card.querySelector("h3 a") || card.querySelector("a.cover-wrap");
            if (!link) continue;
            const match = String(link.attributes["href"] || "").match(/comic\.php\?id=(\d+)/);
            if (!match || seen[match[1]]) continue;
            const id = match[1];
            seen[id] = true;
            const cover = card.querySelector("img.cover") || card.querySelector("img");
            const state = card.querySelector(".genre");
            const meta = card.querySelector(".meta");
            comics.push(new Comic({
                id,
                title: String(link.text || "").trim(),
                cover: this.absolute(cover ? (cover.attributes["data-src"] || cover.attributes["src"]) : ""),
                subtitle: state ? String(state.text || "").trim() : "",
                description: meta ? String(meta.text || "").trim() : ""
            }));
        }
        return comics;
    }
    parseRanks(document) {
        const comics = [], seen = {};
        for (const card of document.querySelectorAll("article.mobile-rank-card")) {
            const link = card.querySelector("a.mobile-rank-cover") || card.querySelector("h2 a");
            if (!link) continue;
            const match = String(link.attributes["href"] || "").match(/comic\.php\?id=(\d+)/);
            if (!match || seen[match[1]]) continue;
            const id = match[1];
            seen[id] = true;
            const title = card.querySelector("h2 a");
            const cover = card.querySelector("img");
            const meta = card.querySelector("p");
            comics.push(new Comic({
                id,
                title: String((title || link).text || "").trim(),
                cover: this.absolute(cover ? (cover.attributes["data-src"] || cover.attributes["src"]) : ""),
                description: meta ? String(meta.text || "").trim() : ""
            }));
        }
        return comics;
    }
    // JSON-LD 里带封面、作者、简介和 dateModified；用正则取脚本内容，避免依赖引擎的 script 文本节点行为。
    jsonLd(html, type) {
        const blocks = String(html || "").match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/g) || [];
        for (const block of blocks) {
            const body = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>\s*$/, "");
            let data;
            try { data = JSON.parse(body); } catch (_) { continue; }
            const list = Array.isArray(data) ? data : (data && Array.isArray(data["@graph"]) ? data["@graph"] : [data]);
            for (const item of list) if (item && item["@type"] === type) return item;
        }
        return null;
    }
    async listPage(query, page) {
        const path = "/category.php?" + (query ? query + "&" : "") + "page=" + page;
        const document = new HtmlDocument(await this.html(path));
        try {
            const comics = this.parseCards(document);
            return { comics, maxPage: this.maxPage(document, page, comics.length) };
        } finally { document.dispose(); }
    }

    search = {
        optionList: [],
        load: async (keyword, options, page) => {
            const text = String(keyword || "").trim();
            if (!text) throw new Error("请输入搜索关键词。");
            const result = await this.listPage("keyword=" + encodeURIComponent(text), page);
            if (!result.comics.length && page === 1) throw new Error("没有找到与「" + text + "」相关的漫画。");
            return result;
        }
    };

    categoryComics = {
        optionList: [],
        ranking: {
            options: ["all-总榜", "today-今日", "week-本周", "month-本月"],
            load: async (option, page) => {
                if (page > 1) return { comics: [], maxPage: 1 };
                const period = option === "all" ? "" : String(option || "");
                const document = new HtmlDocument(await this.html("/top.php" + (period ? "?period=" + period : "")));
                try {
                    const comics = this.parseRanks(document);
                    if (!comics.length) throw new Error("瓜子漫画排行榜结构已变化。");
                    return { comics, maxPage: 1 };
                } finally { document.dispose(); }
            }
        },
        load: async (category, param, options, page) => {
            const query = String(param || "").trim();
            if (query.startsWith("rank:")) return this.categoryComics.ranking.load(query.slice(5) || "all", page);
            if (query && !/^[a-z_]+=[A-Za-z0-9_]+(?:&[a-z_]+=[A-Za-z0-9_]+)*$/.test(query)) {
                throw new Error("未知的瓜子漫画分类参数。");
            }
            const result = await this.listPage(query, page);
            if (!result.comics.length) throw new Error("该分类下没有更多作品。");
            return result;
        }
    };

    comic = {
        loadInfo: async id => {
            const key = String(id || "").trim();
            if (!/^\d+$/.test(key)) throw new Error("无效的漫画 ID。");
            const raw = await this.html("/comic.php?id=" + key);
            const document = new HtmlDocument(raw);
            try {
                const story = this.jsonLd(raw, "ComicStory");
                const titleNode = document.querySelector("#cinema-title");
                const coverNode = document.querySelector("img.cinema-cover") || document.querySelector(".cinema-cover");
                const introNode = document.querySelector(".cinema-info p");
                const stateNode = document.querySelector(".cinema-info .meta .badge");

                let author = "";
                let genres = [];
                for (const row of document.querySelectorAll(".cinema-strip > div")) {
                    const label = row.querySelector("span");
                    const value = row.querySelector("b");
                    if (!label || !value) continue;
                    const name = String(label.text || "").trim();
                    if (name === "作者") {
                        author = String(value.text || "").trim();
                    } else if (name === "题材") {
                        for (const link of value.querySelectorAll("a")) {
                            const text = String(link.text || "").trim();
                            if (text && genres.indexOf(text) < 0) genres.push(text);
                        }
                    }
                }
                if (!author && story && story.author) {
                    author = String(story.author.name || story.author || "").trim();
                }
                if (!genres.length && story && Array.isArray(story.genre)) {
                    for (const item of story.genre) {
                        const text = String(item || "").trim();
                        if (text && genres.indexOf(text) < 0) genres.push(text);
                    }
                }

                const tags = {};
                if (author) tags["作者"] = [author];
                if (genres.length) tags["题材"] = genres;

                // 「更新信息」侧栏：更新时间 / 最新章节 / 章节总数 / 状态。
                let updateTime = "", state = "";
                for (const card of document.querySelectorAll("section.side-card")) {
                    const head = card.querySelector("h3");
                    if (!head || String(head.text || "").trim() !== "更新信息") continue;
                    const desc = card.querySelector("p.desc") || card.querySelector("p");
                    const text = String(desc ? desc.text : "");
                    const dateMatch = text.match(/更新时间[:：]\s*(\d{4}-\d{1,2}-\d{1,2})/);
                    if (dateMatch) updateTime = dateMatch[1];
                    const stateMatch = text.match(/状态[:：]\s*(\S{1,6})/);
                    if (stateMatch) state = stateMatch[1];
                }
                if (!updateTime && story && typeof story.dateModified === "string") {
                    const match = story.dateModified.match(/^\d{4}-\d{1,2}-\d{1,2}/);
                    if (match) updateTime = match[0];
                }

                const chapters = {}, seen = {}, ordered = [];
                const container = document.querySelector(".mobile-chapter-grid") || document.querySelector("div.mobile-chapter-grid");
                const anchors = container ? container.querySelectorAll("a") : document.querySelectorAll("a");
                for (const anchor of anchors) {
                    const match = String(anchor.attributes["href"] || "").match(/chapter\.php\?id=(\d+)/);
                    if (!match || seen[match[1]]) continue;
                    const name = String(anchor.text || "").trim();
                    if (!name) continue;
                    seen[match[1]] = true;
                    ordered.push({ id: match[1], name });
                }
                if (!ordered.length) throw new Error("该漫画没有可读取的章节。");
                // 站点按"新到旧"排列，阅读顺序需要反转；键用站点章节 ID，保持稳定。
                ordered.reverse();
                for (const chapter of ordered) chapters["ep_" + chapter.id] = chapter.name;

                const info = {
                    title: (titleNode && String(titleNode.text || "").trim()) || (story && story.name) || ("漫画 " + key),
                    cover: this.absolute(coverNode ? coverNode.attributes["src"] : (story ? story.image : "")),
                    description: introNode ? String(introNode.text || "").trim() : "",
                    tags,
                    chapters,
                    url: this.base + "/comic.php?id=" + key,
                    uploader: author
                };
                if (updateTime) info.updateTime = updateTime;
                if (!state && stateNode) state = String(stateNode.text || "").trim();
                if (state) info.subtitle = state;
                return new ComicDetails(info);
            } finally { document.dispose(); }
        },
        loadEp: async (comicId, epId) => {
            const chapterId = String(epId || "");
            if (!/^ep_\d+$/.test(chapterId)) throw new Error("无效的章节 ID。");
            const document = new HtmlDocument(await this.html("/chapter.php?id=" + chapterId.slice(3)));
            try {
                const pages = [], seen = {};
                for (const image of document.querySelectorAll("img.reading-image")) {
                    const url = this.absolute(image.attributes["data-src"] || image.attributes["src"]);
                    if (!/^https?:\/\//i.test(url) || seen[url]) continue;
                    seen[url] = true;
                    const number = Number(image.attributes["data-page"] || 0);
                    pages.push({ order: number > 0 ? number : pages.length + 1, url });
                }
                if (!pages.length) throw new Error("章节没有解析到图片，网站结构可能已变化。");
                pages.sort((a, b) => a.order - b.order);
                return { images: pages.map(item => item.url) };
            } finally { document.dispose(); }
        },
        onImageLoad: image => ({ url: image, headers: { "Referer": this.base + "/" } }),
        onThumbnailLoad: image => ({ url: image, headers: { "Referer": this.base + "/" } }),
        link: {
            domains: ["guazimanhua.com", "www.guazimanhua.com"],
            linkToId: url => {
                const match = String(url || "").match(/^https?:\/\/(?:www\.)?guazimanhua\.com\/comic\.php\?id=(\d+)/);
                return match ? match[1] : null;
            }
        }
    };

    explore = [{ title: "瓜子漫画", type: "multiPartPage", load: async () => {
        const parts = [], errors = [];
        const section = async (title, query) => {
            try {
                const result = await this.listPage(query, 1);
                if (result.comics.length) {
                    parts.push({
                        title,
                        comics: result.comics.slice(0, 6),
                        viewMore: { page: "category", attributes: { category: title, param: query } }
                    });
                }
            } catch (error) { errors.push(title + "：" + ((error && error.message) || error)); }
        };
        await section("今日热门", "sort=daily");
        await section("最近更新", "sort=update");
        await section("高分榜", "sort=score");
        try {
            const document = new HtmlDocument(await this.html("/top.php"));
            try {
                const comics = this.parseRanks(document);
                if (comics.length) {
                    parts.push({
                        title: "排行榜",
                        comics: comics.slice(0, 6),
                        viewMore: { page: "category", attributes: { category: "排行榜", param: "rank:all" } }
                    });
                }
            } finally { document.dispose(); }
        } catch (error) { errors.push("排行榜：" + ((error && error.message) || error)); }
        if (!parts.length) throw new Error("瓜子漫画首页没有取到内容。" + (errors.length ? "（" + errors.join("；") + "）" : ""));
        return parts;
    }}];

    category = {
        title: "瓜子漫画",
        enableRankingPage: true,
        parts: [
            {
                name: "题材", type: "fixed", itemType: "category",
                categories: ["耽美", "恋爱", "校园", "霸总", "都市", "穿越", "古风", "玄幻", "奇幻", "科幻", "灵异", "动作",
                    "悬疑", "冒险", "搞笑", "热血", "恐怖", "系统", "逆袭", "脑洞", "复仇", "真人", "其它"],
                categoryParams: ["cid=41", "cid=9", "cid=29", "cid=5", "cid=42", "cid=8", "cid=23", "cid=25", "cid=31", "cid=22",
                    "cid=21", "cid=54", "cid=11", "cid=30", "cid=15", "cid=13", "cid=14", "cid=148", "cid=97", "cid=55", "cid=61",
                    "cid=17", "cid=27"]
            },
            {
                name: "进度", type: "fixed", itemType: "category",
                categories: ["连载中", "已完结"],
                categoryParams: ["is_end=2", "is_end=1"]
            },
            {
                name: "受众", type: "fixed", itemType: "category",
                categories: ["男频", "女频"],
                categoryParams: ["audience=1", "audience=2"]
            },
            {
                name: "排序", type: "fixed", itemType: "category",
                categories: ["今日热门", "人气", "最近更新", "评分"],
                categoryParams: ["sort=daily", "sort=hits", "sort=update", "sort=score"]
            }
        ]
    };
}
