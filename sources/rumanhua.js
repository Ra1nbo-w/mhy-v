// 如漫画 — rumanhua.com 当前通过 HTTP 跳转 rumanhua2.com。
// 2026-10-19，本地导入版；只读取数据，不执行网站 JavaScript。
class Rumanhua extends ComicSource {
    name = "如漫画";
    key = "rumanhua_com";
    version = "2.1.1";
    minAppVersion = "1.16.0";
    url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/rumanhua.js";
    base = "http://rumanhua2.com";

    absolute(path) {
        const value = String(path || "").trim();
        if (/^https?:\/\//i.test(value)) return value;
        if (value.startsWith("//")) return "http:" + value;
        return value ? this.base + "/" + value.replace(/^\/+/, "") : "";
    }
    headers() { return { "Referer": this.base + "/", "Accept": "*/*" }; }
    async html(path) {
        const response = await Network.get(this.absolute(path), this.headers());
        if (response.status !== 200) throw new Error("如漫画网页请求失败：HTTP " + response.status);
        return response.body;
    }
    async post(path, data) {
        const body = Object.keys(data).map(key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key])).join("&");
        const response = await Network.post(this.absolute(path), {
            ...this.headers(), "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest"
        }, body);
        if (response.status !== 200) throw new Error("如漫画接口请求失败：HTTP " + response.status);
        let result;
        try { result = JSON.parse(response.body); }
        catch (_) { throw new Error("如漫画返回的数据不完整或不是 JSON，请稍后重试。"); }
        if (!["200", "201"].includes(String(result.code))) throw new Error(result.msg || "如漫画接口返回异常。");
        if (String(result.code) === "200" && !Array.isArray(result.data)) throw new Error("如漫画接口数据格式已变化。");
        return result;
    }
    meta(document, name) {
        const node = document.querySelector('meta[property="' + name + '"]');
        return node ? node.attributes["content"] || "" : "";
    }
    validId(id) {
        if (typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("无效的漫画或章节 ID。");
        return id;
    }
    search = {
        optionList: [],
        load: async (keyword, options, page) => {
            if (page > 1) return { comics: [], maxPage: 1 };
            keyword = keyword.trim();
            if (keyword.length < 2 || keyword.length > 12) throw new Error("网站要求搜索词为 2～12 个字符。");
            const result = await this.post("/s", { k: keyword });
            return { comics: String(result.code) === "201" ? [] : result.data.map(item => new Comic({
                id: String(item.id), title: item.name, cover: this.absolute(item.imgurl), subtitle: item.remarks || ""
            })), maxPage: 1 };
        }
    };
    categoryComics = {
        optionList: [],
        load: async (category, param, options, page) => {
            if (!/^(?:[1-9]|1[0-6])$/.test(String(param))) throw new Error("未知如漫画分类。");
            const result = await this.post("/data/sort", { s: param, p: page });
            const rows = Array.isArray(result.data) ? result.data : [];
            const comics = rows.map(item => new Comic({ id: String(item.id), title: item.name,
                cover: this.absolute(item.imgurl), subtitle: item.remarks || "" }));
            return { comics, maxPage: comics.length >= 20 && page < 5 ? page + 1 : page };
        }
    };
    comic = {
        loadInfo: async id => {
            this.validId(id);
            const document = new HtmlDocument(await this.html("/" + id + "/"));
            let info, recent = [], hasMore;
            try {
                const title = document.querySelector(".book-name h1");
                if (!title) throw new Error("未找到漫画详情，网站结构可能已变化。");
                for (const a of document.querySelectorAll(".chaplist-box a")) {
                    const match = (a.attributes["href"] || "").match(/^\/([^/]+)\/([^/]+)\.html$/);
                    if (match && match[1] === id) recent.push({ chapterid: match[2], chaptername: a.text.trim() });
                }
                hasMore = !!document.querySelector(".chaplist-more");
                const tags = {};
                const author = this.meta(document, "og:author");
                if (author) tags["作者"] = [author];
                tags["题材"] = document.querySelectorAll(".comic-tags span").map(span => span.text.trim());
                const intro = document.querySelector(".cartoon-introduction");
                const date = this.meta(document, "og:date").match(/\d{4}-\d{2}-\d{2}/);
                info = { title: title.text.trim(), cover: this.absolute(this.meta(document, "og:image")), tags,
                    description: intro ? intro.text.trim() : "", url: this.base + "/" + id + "/" };
                if (date && !date[0].startsWith("1970")) info.updateTime = date[0];
            } finally { document.dispose(); }
            if (hasMore) {
                const response = await this.post("/morechapter", { id });
                if (String(response.code) !== "200" || !response.data.length) throw new Error("完整目录加载失败，请稍后重试，避免缺章。");
                recent = recent.concat(response.data);
            }
            const chapters = {}, seen = {};
            // 网页与 morechapter 都是新到旧；合并后反转，保留站点原章节 ID。
            for (const chapter of recent) {
                this.validId(String(chapter.chapterid));
                if (typeof chapter.chaptername !== "string") throw new Error("章节名称格式异常。");
            }
            for (const chapter of recent.reverse()) {
                const key = "ep_" + chapter.chapterid;
                if (!seen[key]) { chapters[key] = chapter.chaptername; seen[key] = true; }
            }
            if (!Object.keys(chapters).length) throw new Error("该漫画没有可读取的章节。");
            return new ComicDetails({ ...info, chapters });
        },
        loadEp: async (comicId, epId) => {
            this.validId(comicId);
            if (typeof epId !== "string" || !epId.startsWith("ep_")) throw new Error("无效章节 ID。");
            const id = this.validId(epId.slice(3));
            return { images: this.decodeImages(await this.html("/" + comicId + "/" + id + ".html")) };
        },
        onImageLoad: image => ({ url: image }),
        onThumbnailLoad: image => ({ url: image }),
        link: {
            domains: ["rumanhua.com", "www.rumanhua.com", "rumanhua2.com", "m.rumanhua2.com"],
            linkToId: url => {
                const match = url.match(/^https?:\/\/(?:www\.|m\.)?rumanhua(?:2)?\.com\/([a-zA-Z0-9_-]+)\/?(?:[?#].*)?$/);
                return match ? match[1] : null;
            }
        }
    };

    explore = [{title:'如漫画',type:'multiPartPage',load:async()=>{
        const doc=new HtmlDocument(await this.html('/'));
        try{
            const heads=doc.querySelectorAll('.mult-head'), bodies=doc.querySelectorAll('.mult-body');
            const parts=[];
            for(let i=0;i<bodies.length;i++){
                const comics=[],seen={};
                for(const card of bodies[i].querySelectorAll('li')){
                    const a=card.querySelector('a'),img=card.querySelector('img'),title=card.querySelector('.card-title');
                    const id=a&&(a.attributes.href||'').match(/^\/([a-zA-Z0-9_-]+)\/$/);
                    if(!id||!img||!title||seen[id[1]])continue;
                    seen[id[1]]=true;
                    comics.push(new Comic({id:id[1],title:title.text.trim(),cover:this.absolute(img.attributes['data-src']||img.attributes.src)}));
                }
                if(comics.length)parts.push({title:heads[i]?heads[i].text.trim():'首页精选',comics:comics.slice(0,6)});
            }
            if(!parts.length)throw new Error('如漫画首页结构已变化。');
            return parts;
        }finally{doc.dispose();}
    }}];
    category = {title:'如漫画',enableRankingPage:false,parts:[
        {name:'题材',type:'fixed',itemType:'category',categories:['冒险','热血','都市','玄幻','悬疑','耽美','恋爱','生活','搞笑','穿越','修真','后宫','女主','古风'],categoryParams:['1','2','3','4','5','6','7','8','9','10','11','12','13','14']},
        {name:'进度',type:'fixed',itemType:'category',categories:['连载','完结'],categoryParams:['15','16']}
    ]};
    decodeImages(html) {
        const packed=html.match(/\}\('([^']+)',(\d+),(\d+),'([^']*)'\.split/);
        if(!packed)throw new Error('未找到支持的章节图片格式，网站可能已改版。');
        const radix=Number(packed[2]),count=Number(packed[3]),words=packed[4].split('|');
        if(radix<2||radix>62||count<1||count>5000)throw new Error('章节图片字典参数不匹配，请更新源。');
        const alphabet='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const encode=n=>n<radix?alphabet[n]:encode(Math.floor(n/radix))+alphabet[n%radix];
        const dictionary={};for(let i=0;i<count;i++)if(words[i])dictionary[encode(i)]=words[i];
        const unpacked=packed[1].replace(/\b\w+\b/g,token=>Object.prototype.hasOwnProperty.call(dictionary,token)?dictionary[token]:token);
        const payload=unpacked.match(/var __c0rst96="([A-Za-z0-9+/=]+)"/),index=html.match(/class="readerContainer"\s+data-id="(\d+)"/);
        const keys=['smkhy258','smkd95fv','md496952','cdcsdwq','vbfsa256','cawf151c','cd56cvda','8kihnt9','dso15tlo','5ko6plhy'];
        const key=index&&keys[Number(index[1])];if(!payload||!key)throw new Error('章节图片编码参数不匹配，请更新源。');
        const bytes=new Uint8Array(Convert.decodeBase64(payload[1]));let inner='';
        for(let i=0;i<bytes.length;i++)inner+=String.fromCharCode(bytes[i]^key.charCodeAt(i%key.length));
        let images;try{images=JSON.parse(Convert.decodeUtf8(Convert.decodeBase64(inner)));}catch(_){throw new Error('章节图片解码失败，请刷新章节或更新源。');}
        if(!Array.isArray(images)||!images.length||images.some(u=>typeof u!=='string'||!/^https?:\/\//.test(u)))throw new Error('章节没有有效图片。');
        return images;
    }


    _checkedComic = this.comic;
    comic = {...this._checkedComic, loadInfo:async id=>{
        const info=await this._checkedComic.loadInfo(id);
        if(!info.tags)info.tags={};
        if(info.tags instanceof Map)info.tags=Object.fromEntries(info.tags);
        return info;
    }};

}
