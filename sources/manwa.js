// 漫蛙单源线路版：只适配 manwa.me 同一站点的线路，不包含旧多站聚合。
class Manwa extends ComicSource {
    name='漫蛙漫画'; key='manwa_routes'; version = "2.1.0"; minAppVersion='1.16.0'; url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/manwa.js";
    pendingRoute=null; activeBase='';
    settings={
        line:{title:'线路选择',type:'select',options:[{value:'auto',text:'自动（缓存 / 备用入口 / 走失恢复）'},{value:'backup',text:'备用入口 fuwbn.cc/mw666'},{value:'permanent',text:'永久地址 manwa.me'},{value:'manual',text:'手动地址'}],default:'auto'},
        manual:{title:'手动 HTTPS 根地址',type:'input',default:'https://manwark.cc',validator:'^https://[a-zA-Z0-9.-]+/?$'},
        refresh:{title:'更新线路',type:'callback',buttonText:'更新并检查',callback:async()=>UI.showMessage('当前线路：'+await this.resolve(true))},
        current:{title:'当前地址',type:'callback',buttonText:'检查线路',callback:async()=>UI.showMessage('当前线路：'+await this.resolve())},
        missing:{title:'走失恢复页',type:'callback',buttonText:'打开走失页',callback:()=>UI.launchUrl('https://mwmissing1.cc/')}
    };
    cleanBase(value){
        const s=String(value||'').trim().replace(/\/$/,'');
        if(!/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(s))throw new Error('线路必须是正常 HTTPS 根域名，不含路径、账号或端口。');
        return s;
    }
    async raw(url){
        const r=await Network.get(url,{'Accept':'text/html','Referer':url},{connectTimeout:10000,receiveTimeout:15000});
        if(r.status===401||r.status===403||/正在验证|Just a moment|Sorry, you have been blocked/i.test(r.body||''))throw new Error('线路需要登录或浏览器验证，请先在当前网站正常登录；不会把权限问题当作域名故障。');
        if(r.status!==200)throw new Error('漫蛙请求失败：HTTP '+r.status);
        return r.body;
    }
    parseEntry(html){
        const m=String(html).match(/(?:var\s+)?lks\s*=\s*JSON\.parse\(atob\(['"]([A-Za-z0-9+/=]+)['"]\)\)/);
        if(!m)throw new Error('漫蛙备用入口格式已变化，请打开走失页查看。');
        const values=JSON.parse(Convert.decodeUtf8(Convert.decodeBase64(m[1])));
        if(!Array.isArray(values))throw new Error('备用入口没有返回线路数组。');
        return [...new Set(values.slice(0,12).map(value=>this.cleanBase(value)))];
    }
    async candidates(){
        try{return this.parseEntry(await this.raw('https://fuwbn.cc/mw666'));}catch(first){
            const html=await this.raw('https://mwmissing1.cc/');
            const doc=new HtmlDocument(html);
            try{
                // 只接受明确备用按钮的 HTTPS 入口，忽略广告和 APP 下载链接。
                for(const a of doc.querySelectorAll('a')){
                    const href=a.attributes.href||'';
                    if(/备用|備用/.test(a.text)&&/^https:\/\/fuwbn\.cc\/mw666\/?$/.test(href))return this.parseEntry(await this.raw(href));
                }
            }finally{doc.dispose();}
            throw new Error('备用入口无法恢复，请打开走失页并填写手动地址。');
        }
    }
    async probe(base){
        const html=await this.raw(base+'/');
        if(!/漫蛙/.test(html)||!/\/book\/\d+/.test(html))throw new Error('该地址不是已支持的漫蛙漫画站。');
        // 固定抽样验证作品 ID，避免自动跳到不兼容站点导致历史记录错配。
        const detail=await this.raw(base+'/book/8167');
        const doc=new HtmlDocument(detail);
        try{
            const title=doc.querySelector('.detail-main-info-title')?.text||'';
            if(!/一人之下/.test(title)||!/\/chapter\/275364(?:["'?\s<]|$)/.test(detail))throw new Error('线路作品或章节 ID 与当前源不兼容，停止切换。');
        }finally{doc.dispose();}
        return base;
    }
    async resolve(force=false){
        if(this.pendingRoute)return this.pendingRoute;
        const mode=this.loadSetting('line')||'auto',manual=mode==='manual'?this.cleanBase(this.loadSetting('manual')):'';
        const cached=this.loadData('route');
        if(!force&&cached&&cached.mode===mode&&cached.manual===manual&&Date.now()-cached.checkedAt<86400000){this.activeBase=this.cleanBase(cached.base);return this.activeBase;}
        this.pendingRoute=(async()=>{
            let candidates=[];
            if(mode==='permanent')candidates=['https://manwa.me'];
            else if(mode==='manual')candidates=[manual];
            else if(mode==='backup')candidates=await this.candidates();
            else candidates=[...(cached?.base?[this.cleanBase(cached.base)]:[]),'https://manwark.cc'];
            let lastError,attempted=new Set(),queue=[...new Set(candidates)];
            let refreshed=mode==='backup';
            while(attempted.size<4){
                if(!queue.length){
                    if(mode!=='auto'||refreshed)break;
                    refreshed=true;try{queue=await this.candidates();}catch(e){lastError=e;break;}
                }
                const base=queue.shift();if(!base)break;if(attempted.has(base))continue;attempted.add(base);
                try{
                    await this.probe(base);
                    this.saveData('route',{base,mode,manual,checkedAt:Date.now()});this.activeBase=base;return base;
                }catch(e){if(/登录|验证|权限/.test(String(e)))throw e;lastError=e;}
            }
            throw new Error('漫蛙线路不可用：'+String(lastError||'没有可用候选')+'。请在源设置更新线路或打开走失页。');
        })();
        try{return await this.pendingRoute;}finally{this.pendingRoute=null;}
    }
    async page(path){
        let base=await this.resolve();
        try{return{base,html:await this.raw(base+path)};}catch(e){
            if((this.loadSetting('line')||'auto')!=='auto'||/登录|验证|权限/.test(String(e)))throw e;
            // 仅只读请求重试一次；同一详情或章节使用返回的地址快照。
            base=await this.resolve(true);return{base,html:await this.raw(base+path)};
        }
    }
    absolute(path,base){if(/^https?:\/\//.test(path||''))return path;if(String(path).startsWith('//'))return'https:'+path;return base+'/'+String(path||'').replace(/^\//,'');}
    parseList(root,base){
        const seen={},comics=[];
        for(const a of root.querySelectorAll('a')){
            const id=(a.attributes.href||'').match(/\/book\/(\d+)(?:[/?#]|$)/),img=a.querySelector('img');
            if(!id||!img||seen[id[1]])continue;
            const title=(img.attributes.alt||a.attributes.title||a.querySelector('.manga-list-2-title')?.text||a.text).trim();
            const cover=img.attributes['data-original']||img.attributes['data-src']||img.attributes.src;
            if(!cover||!title)continue;seen[id[1]]=true;
            comics.push(new Comic({id:id[1],title,cover:this.absolute(cover,base)}));
        }
        return comics;
    }
    async list(path,page){
        const r=await this.page(path+(path.includes('?')?'&':'?')+'page='+page),doc=new HtmlDocument(r.html);
        try{
            let maxPage=page;
            for(const a of doc.querySelectorAll('.pagination2 a')){
                const n=Number(a.attributes['data-page']||(a.attributes.href||'').match(/[?&]page=(\d+)/)?.[1]);
                if(n>maxPage)maxPage=n;
            }
            return{comics:this.parseList(doc,r.base),maxPage};
        }finally{doc.dispose();}
    }
    search={optionList:[],load:async(k,o,p)=>this.list('/search?keyword='+encodeURIComponent(k.trim()),p)};
    explore=[{title:'漫蛙漫画',type:'multiPartPage',load:async()=>{
        const r=await this.page('/'),doc=new HtmlDocument(r.html);
        try{
            const parts=[];
            for(const head of doc.querySelectorAll('.manga-list-title')){
                const block=head.nextElementSibling;
                if(!block)continue;
                const comics=this.parseList(block,r.base);
                if(!head||!comics.length)continue;
                const title=head.text.replace(/更多/g,'').trim(),href=head.querySelector('a')?.attributes.href;
                const part={title,comics:comics.slice(0,6)};
                if(href&&/^\/(?:update|rank|booklist)(?:[/?]|$)/.test(href))part.viewMore={page:'category',attributes:{category:title,param:href}};
                parts.push(part);
            }
            if(!parts.length)throw new Error('漫蛙首页分区结构已变化。');
            return parts;
        }finally{doc.dispose();}
    }}];
    category={title:'漫蛙漫画',enableRankingPage:false,parts:[
        {name:'浏览',type:'fixed',itemType:'category',categories:['最近更新','排行榜','全部漫画'],categoryParams:['/update','/rank','/booklist']},
        {name:'题材',type:'fixed',itemType:'category',categories:['全彩','日漫','韩漫','大女主','悬疑','都市','职场'],categoryParams:['全彩','日漫','韩漫','大女主','悬疑','都市','职场']}
    ]};
    categoryComics={optionList:[{options:['-全部地区','2-韩国','3-日本','4-国漫','5-台漫','6-其他']},{options:['-全部进度','2-连载中','1-完结']},{options:['latest-最新','oldest-最旧','favorite-收藏']}],load:async(c,param,o,p)=>{
        const filter='&area='+encodeURIComponent(o[0]||'')+'&end='+encodeURIComponent(o[1]||'')+'&sort='+({latest:'-1',oldest:'0',favorite:'1'}[o[2]]||'-1');
        if(String(param).startsWith('/')){
            if(!/^\/(?:update|rank|booklist)(?:\?[^#\s]*)?$/.test(param))throw new Error('未知漫蛙分类。');
            return this.list(param+(param.startsWith('/booklist')?(param.includes('?')?filter:'?'+filter.slice(1)):''),p);
        }
        return this.list('/booklist?tag='+encodeURIComponent(param)+filter,p);
    }};
    comic={
        loadInfo:async id=>{
            if(!/^\d+$/.test(id))throw new Error('无效漫画 ID。');
            const r=await this.page('/book/'+id),doc=new HtmlDocument(r.html);
            try{
                const title=doc.querySelector('.detail-main-info-title')?.text.trim(),img=doc.querySelector('.detail-main-cover img');
                if(!title||!img)throw new Error('未找到漫蛙漫画详情，可能需要登录。');
                const chapters={};
                for(const a of doc.querySelectorAll('.chapteritem')){
                    const match=(a.attributes.href||a.querySelector('a')?.attributes.href||'').match(/\/chapter\/(\d+)/);
                    if(match)chapters['ep_'+match[1]]=a.text.trim();
                }
                if(!Object.keys(chapters).length)throw new Error('漫蛙目录为空，可能需要登录或网站已改版。');
                return new ComicDetails({title,cover:this.absolute(img.attributes['data-original']||img.attributes.src,r.base),description:doc.querySelector('.detail-main-info-content')?.text.trim()||'',chapters});
            }finally{doc.dispose();}
        },
        loadEp:async(id,ep)=>{
            const chapter=String(ep).replace(/^ep_/,'');if(!/^\d+$/.test(chapter))throw new Error('无效章节 ID。');
            const r=await this.page('/chapter/'+chapter),doc=new HtmlDocument(r.html);
            try{
                const images=doc.querySelectorAll('img.content-img').map(img=>img.attributes['data-r-src']).filter(Boolean).map(url=>this.absolute(url,r.base));
                if(!images.length)throw new Error('漫蛙章节无图片，请检查登录状态或阅读权限。');
                return {images:images.map(url=>url+'#venera-manwa-ref='+encodeURIComponent(r.base))};
            }finally{doc.dispose();}
        },
        onImageLoad:async image=>{
            const pieces=String(image).split('#venera-manwa-ref='),url=pieces[0];
            const base=pieces[1]?this.cleanBase(decodeURIComponent(pieces[1])):(this.activeBase||await this.resolve());
            return {url,headers:{Referer:base+'/'},onResponse:bytes=>{
            const src=new Uint8Array(bytes);
            if((src[0]===255&&src[1]===216)||(src[0]===137&&src[1]===80)||(src[0]===82&&src[1]===73&&src[8]===87))return bytes;
            if(!src.length||src.length%16!==0)throw new Error('漫蛙图片响应异常，可能返回了验证页面。');
            const key=Convert.encodeUtf8('my2ecret782ecret');
            const plain=new Uint8Array(Convert.decryptAesCbc(bytes,key,key)),n=plain[plain.length-1];
            if(n<1||n>16||plain.slice(-n).some(b=>b!==n))throw new Error('漫蛙图片解码失败，请更新漫画源。');
            return plain.slice(0,-n).buffer;
        }};},
        onThumbnailLoad:url=>({url,headers:{Referer:(this.activeBase||'https://manwark.cc')+'/'}})
    };

    _checkedComic = this.comic;
    comic = {...this._checkedComic, loadInfo:async id=>{
        const info=await this._checkedComic.loadInfo(id);
        if(!info.tags)info.tags={};
        if(info.tags instanceof Map)info.tags=Object.fromEntries(info.tags);
        return info;
    }};

}
