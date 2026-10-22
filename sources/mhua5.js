// 漫画屋移动网页适配；仅读取目录和图片，不执行网页广告脚本。
class Mhua5 extends ComicSource {
    name='漫画屋'; key='mhua5'; version = "2.3.3"; minAppVersion='1.16.0'; url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mhua5.js";
    base='https://mhua5.com';
    headers(){return{'User-Agent':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',Referer:this.base+'/'};}
    absolute(path){if(/^https?:\/\//.test(path||''))return path;if(String(path).startsWith('//'))return'https:'+path;return this.base+'/'+String(path||'').replace(/^\//,'');}
    async html(path,desktop=false){const headers=this.headers();if(desktop)headers['User-Agent']='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';const r=await Network.get(this.absolute(path),headers);if(r.status!==200||/Just a moment|正在验证|Sorry, you have been blocked/i.test(r.body||''))throw new Error('漫画屋请求失败或需要浏览器验证（HTTP '+r.status+'）。分类页受 Cloudflare 托管挑战，请先在源设置的「登录」里打开分类页完成一次验证，再回到这里重试。');return r.body;}
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
    search={optionList:[],load:async(k,o,p)=>{const q=k.trim();if(!q)return{comics:[],maxPage:1};return this.list('/index.php/search?key='+encodeURIComponent(q),p);}};
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

        // 站点 tags/<id> 的 22 个题材；ID 与标签一一对应，写死会比循环推算更早暴露站点改动。
        {name:'题材',type:'fixed',itemType:'category',categories:['热血','冒险','科幻','霸总','玄幻','校园','修真','搞笑','穿越','后宫','耽美','恋爱','悬疑','恐怖','战争','动作','同人','竞技','励志','架空','灵异','百合'],categoryParams:[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27].map(id=>'/index.php/category/tags/'+id)},
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
                const author=doc.querySelector('.au-name')?.text.replace(/^作者[：:]\s*/,'').trim()||'';
                // 题材取详情页「题材:」后指向 /index.php/category/tags/<id> 的链接文本（同页可能有重复项）。
                const tags={},themes=[],seenTheme={};
                if(author)tags['作者']=[author];
                for(const a of doc.querySelectorAll('a')){
                    const name=a.text.trim();
                    if(!/\/index\.php\/category\/tags\//.test(a.attributes.href||'')||!name||name.length>12||seenTheme[name])continue;
                    seenTheme[name]=true;themes.push(name);
                }
                if(themes.length)tags['题材']=themes;
                return new ComicDetails({title,cover:cover?this.absolute(cover):'',description:doc.querySelector('.comic-intro')?.text.trim()||'',tags,chapters});
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
    // 首页与详情页不需要验证，分类页才被 Cloudflare 托管挑战拦（403 Just a moment）。
    // 所以登录入口直接打开分类页，让用户在那里过一次验证；通过后 cf_clearance 会进应用共用的 CookieJar。
    settings = {
        checkVerification:{title:'检查分类页验证',type:'callback',buttonText:'检查是否已过验证',callback:async()=>{
            try{
                const r=await Network.get('https://mhua5.com/index.php/category/tags/6',this.headers());
                if(/Just a moment|__cf_chl_|challenge-platform/i.test(r.body||''))throw new Error('仍是 Cloudflare 挑战页');
                if(r.status!==200)throw new Error('HTTP '+r.status);
                UI.showMessage('分类页已可直接读取，验证 Cookie 有效。分类、筛选和「更多」都能用。');
            }catch(e){UI.showMessage('分类页仍不可用：'+e.message+'。请在「登录 → 网页登录」里打开分类页完成一次验证，或手动粘贴 cf_clearance。');}
        }}
    };
    account={
        loginWithWebview:{
            url:'https://mhua5.com/index.php/category/tags/6',
            // checkStatus 由宿主同步调用，必须是纯函数；未通过验证时标题会含 Just a moment。
            checkStatus:(url,title)=>!!url&&/^https:\/\/(?:www\.)?mhua5\.com\/index\.php\/category\//.test(url)&&!!title&&!/moment|blocked|验证|驗證|challenge/i.test(title),
            onLoginSuccess:()=>{
                const cookies=Network.getCookies('https://mhua5.com')||[];
                const cleared=cookies.some(c=>c.name==='cf_clearance'&&!!c.value);
                UI.showMessage(cleared?'漫画屋验证已保存（cf_clearance）：分类页、筛选和「更多」现在都能打开。':'网页已打开，但没有读到 cf_clearance。若页面还在验证，等它自动跳转完成；也可以直接用「手动 Cookie」登录。');
            }
        },
        // 网页登录失败时的兜底：用户在桌面浏览器过完验证后把 cf_clearance 粘进来。
        loginWithCookies:{
            fields:['cf_clearance（浏览器 F12 → Application → Cookies → mhua5.com 复制）'],
            validate:async values=>{
                const value=((values||[])[0]||'').trim();
                if(!value)return false;
                Network.setCookies('https://mhua5.com',[new Cookie({name:'cf_clearance',value,domain:'.mhua5.com'})]);
                try{
                    const r=await Network.get('https://mhua5.com/index.php/category/tags/6',this.headers());
                    return r.status===200&&!/Just a moment|__cf_chl_|challenge-platform/i.test(r.body||'');
                }catch(_){return false;}
            }
        },
        logout:()=>Network.deleteCookies('https://mhua5.com')
    };

}

