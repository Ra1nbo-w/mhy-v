// 漫画屋移动网页适配；仅读取目录和图片，不执行网页广告脚本。
class Mhua5 extends ComicSource {
    name='漫画屋'; key='mhua5'; version = "2.2.0"; minAppVersion='1.16.0'; url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mhua5.js";
    base='https://mhua5.com';
    headers(){return{'User-Agent':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',Referer:this.base+'/'};}
    absolute(path){if(/^https?:\/\//.test(path||''))return path;if(String(path).startsWith('//'))return'https:'+path;return this.base+'/'+String(path||'').replace(/^\//,'');}
    async html(path,desktop=false){const headers=this.headers();if(desktop)headers['User-Agent']='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';const r=await Network.get(this.absolute(path),headers);if(r.status!==200||/Just a moment|正在验证|Sorry, you have been blocked/i.test(r.body||''))throw new Error('漫画屋请求失败或需要浏览器验证（HTTP '+r.status+'），请使用本源网页登录入口后重试。');return r.body;}
    parseList(root){
        const seen={},comics=[];
        for(const a of root.querySelectorAll('a')){
            const id=(a.attributes.href||'').match(/\/index\.php\/comic\/([^/?#]+)/),img=a.querySelector('img');
            if(!id||!img||seen[id[1]])continue;
            const title=(a.querySelector('.comic-name')?.text||img.attributes.alt||a.attributes.title||'').trim();
            if(!title)continue;
            const cover=img.attributes['data-original']||img.attributes['data-src']||img.attributes.src;if(!cover||cover.startsWith('data:'))continue;
            seen[id[1]]=true;comics.push(new Comic({id:id[1],title,cover:this.absolute(cover)}));
        }
        return comics;
    }
    async list(path,page=1){
        const doc=new HtmlDocument(await this.html(path+(path.includes('?')?'&':'?')+'page='+page));
        try{
            const comics=this.parseList(doc);let maxPage=page;
            for(const a of doc.querySelectorAll('a')){const n=Number((a.attributes.href||'').match(/[?&]page=(\d+)/)?.[1]);if(n>maxPage)maxPage=n;}
            // 页面仅显示的结果不会伪报为已取得网站全部搜索结果。
            return{comics,maxPage};
        }finally{doc.dispose();}
    }
    search={optionList:[],load:async(k,o,p)=>this.list('/index.php/search?key='+encodeURIComponent(k.trim()),p)};
    explore=[{title:'漫画屋',type:'multiPartPage',load:async()=>{
        const doc=new HtmlDocument(await this.html('/',true));
        try{
            const parts=[],all=this.parseList(doc),covers={};for(const comic of all)covers[comic.id]=comic;
            const featured=doc.querySelector('.in-fine');if(featured){const comics=this.parseList(featured);if(comics.length)parts.push({title:'首页精选',comics:comics.slice(0,6)});}
            for(const head of doc.querySelectorAll('.in-sec__head, .in-rank-box > .head')){
                const title=head.querySelector('span')?.text.trim();if(!['上升最快','完结大作','收藏榜','最近更新','人气排行榜'].includes(title))continue;
                const container=head.parent;let comics=this.parseList(container);
                if(title==='人气排行榜')comics=container.querySelectorAll('.comic-name a').map(a=>covers[(a.attributes.href||'').split('/').pop()]).filter(Boolean);
                if(!comics.length)continue;
                const path=head.querySelector('a.more')?.attributes.href||(title==='人气排行榜'?'/index.php/category/order/hits':null);
                const p={title,comics:comics.slice(0,6)};if(path)p.viewMore={page:'category',attributes:{category:title,param:path}};parts.push(p);
            }
            // 部分线路仅返回移动首页，保留其真实栏目作为兼容回退。
            if(!parts.length)for(const floor of doc.querySelectorAll('.floor')){const h=floor.querySelector('h2'),comics=this.parseList(floor);if(h&&comics.length){const title=h.text.replace(/更多/g,'').trim(),path=h.querySelector('a')?.attributes.href,p={title,comics:comics.slice(0,6)};if(path?.startsWith('/index.php/'))p.viewMore={page:'category',attributes:{category:title,param:path}};parts.push(p);}}
            if(!parts.length)throw new Error('漫画屋首页结构已变化。');return parts;
        }finally{doc.dispose();}
    }}];
    // 题材与进度 ID 均来自站点桌面首页导航。
    category={title:'漫画屋',enableRankingPage:false,parts:[
        {name:'常用',type:'fixed',itemType:'category',categories:['精品推荐','上升最快','新作尝鲜','人气排行','最新上架'],categoryParams:['/index.php/category/quality/39','/index.php/custom/ascension','/index.php/custom/update','/index.php/category/order/hits','/index.php/category/order/addtime']},
        {name:'题材',type:'fixed',itemType:'category',categories:['热血','冒险','科幻','霸总','玄幻','校园','修真','搞笑','穿越','后宫','耽美','恋爱','悬疑','恐怖','战争','动作','同人','竞技','励志','架空','灵异','百合'],categoryParams:Array.from({length:22},(_,i)=>'/index.php/category/tags/'+(i+6))},
        {name:'进度',type:'fixed',itemType:'category',categories:['连载','完结'],categoryParams:['/index.php/category/finish/1','/index.php/category/finish/2']}
    ]};
    categoryComics={optionList:[],load:async(c,param,o,p)=>{
        if(!/^\/index\.php\/(?:category|custom)\/[a-zA-Z0-9/_-]+$/.test(param))throw new Error('未知漫画屋分类。');
        return this.list(param,p);
    }};
    comic={
        loadInfo:async id=>{
            if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('无效漫画 ID。');
            const doc=new HtmlDocument(await this.html('/index.php/comic/'+id));
            try{
                const title=doc.querySelector('h1.comic-name')?.text.trim();if(!title)throw new Error('漫画屋未找到该作品。');
                const chapters={},rows=[],seen={};
                for(const a of doc.querySelectorAll('.chapter-item a')){
                    const m=(a.attributes.href||'').match(/\/index\.php\/chapter\/(\d+)/);
                    if(m&&!seen[m[1]]&&a.text.trim()){rows.push([m[1],a.text.trim()]);seen[m[1]]=true;}
                }
                for(const [id,name]of rows.reverse())chapters['ep_'+id]=name;
                if(!rows.length)throw new Error('漫画屋章节目录为空。');
                const style=doc.querySelector('.box-back')?.attributes.style||'',cover=style.match(/url\(['"]?([^)'"\s]+)/)?.[1]||'';
                return new ComicDetails({title,cover:this.absolute(cover),description:doc.querySelector('.comic-intro')?.text.trim()||'',tags:{作者:[doc.querySelector('.au-name')?.text.replace(/^作者[：:]\s*/,'').trim()||'']},chapters});
            }finally{doc.dispose();}
        },
        loadEp:async(id,ep)=>{
            const chapter=String(ep).replace(/^ep_/,'');if(!/^\d+$/.test(chapter))throw new Error('无效章节 ID。');
            const doc=new HtmlDocument(await this.html('/index.php/chapter/'+chapter));
            try{
                const images=doc.querySelectorAll('.comic-page img').map(i=>i.attributes['data-src']||i.attributes.src).filter(Boolean).map(u=>this.absolute(u));
                if(!images.length)throw new Error('漫画屋章节未取得图片，请检查验证状态。');return{images};
            }finally{doc.dispose();}
        },
        onImageLoad:url=>({url,headers:this.headers()}),onThumbnailLoad:url=>{
            // mkzcdn 按 Referer 拦截本站请求；不携带页面 Referer 时可正常读取封面。
            if(/^https?:\/\/oss\.mkzcdn\.com\//i.test(url))return{url:url.replace(/^http:/,'https:'),headers:{}};
            return{url,headers:this.headers()};
        }
    };
    account={loginWithWebview:{url:'https://mhua5.com/',checkStatus:(url,title)=>/^https:\/\/(?:www\.)?mhua5\.com(?:\/|$)/.test(url||'')&&/漫画屋/.test(title||'')&&!/moment|blocked|验证/i.test(title||'')},logout:()=>Network.deleteCookies(this.base)};

    _checkedComic = this.comic;
    comic = {...this._checkedComic, loadInfo:async id=>{
        const info=await this._checkedComic.loadInfo(id);
        if(!info.tags)info.tags={};
        if(info.tags instanceof Map)info.tags=Object.fromEntries(info.tags);
        return info;
    }};

}
