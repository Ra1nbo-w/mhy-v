// 漫自由：文件目录型源。本站提供 ePub/MOBI，非普通在线分话图片站。
// VeneraNext 源 archive 下载当前面向 ZIP，本源不伪装 EPUB 为章节图片。
class Mheee extends ComicSource {
    name='漫自由'; key='mheee_catalog'; version = "2.2.0"; minAppVersion='1.16.0'; url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mheee.js"; base='https://mheee.com';
    absolute(path){if(/^https?:\/\//.test(path||''))return path;if(String(path).startsWith('//'))return'https:'+path;return this.base+'/'+String(path||'').replace(/^\//,'');}
    async html(path){const r=await Network.get(this.base+path,{Referer:this.base+'/'});if(r.status!==200||/Just a moment|正在验证|Sorry, you have been blocked/.test(r.body||''))throw new Error('漫自由请求失败或需要浏览器验证：HTTP '+r.status);return r.body;}
    parseList(root){const seen={},comics=[];
        for(const a of root.querySelectorAll('a')){
            const m=(a.attributes.href||'').match(/^\/comic\/([a-zA-Z0-9_-]+)\/?$/),img=a.querySelector('img');
            if(!m||!img||seen[m[1]])continue;
            const title=(a.querySelector('.title')?.text||img.attributes.alt||'').trim();if(!title)continue;
            seen[m[1]]=true;comics.push(new Comic({id:m[1],title,cover:this.absolute(img.attributes['data-src']||img.attributes.src),subtitle:'ePub / MOBI 文件目录'}));
        }return comics;
    }
    async list(param,page,sort='0',options=[]){
        const filters={genre:'0',region:options[0]||'0',language:options[1]||'0',progress:options[2]||'0'};
        const pair=String(param).split(':');if(pair.length===2&&pair[0] in filters)filters[pair[0]]=pair[1];else filters.genre=param;
        const path='/m/list-'+filters.genre+'-'+filters.region+'-'+filters.progress+'-'+filters.language+'-0-'+sort+'-'+page,doc=new HtmlDocument(await this.html(path));
        try{let maxPage=page;for(const a of doc.querySelectorAll('.pagination a')){const n=Number((a.attributes.href||'').match(/-(\d+)$/)?.[1]);if(n>maxPage)maxPage=n;}return{comics:this.parseList(doc),maxPage};}finally{doc.dispose();}
    }
    search={optionList:[],load:async(k,o,p)=>{
        const doc=new HtmlDocument(await this.html('/m/comic/search?q='+encodeURIComponent(k.trim())+'&page='+p));
        try{let maxPage=p;for(const a of doc.querySelectorAll('.pagination a')){const n=Number((a.attributes.href||'').match(/[?&]page=(\d+)/)?.[1]);if(n>maxPage)maxPage=n;}return{comics:this.parseList(doc),maxPage};}finally{doc.dispose();}
    }};
    explore=[{title:'漫自由',type:'multiPartPage',load:async()=>{
        const parts=[];for(const [title,param,sort]of [['最近更新','0','0'],['最高评分','0','1'],['完结精选','progress:64','1']]){
            const r=await this.list(param,1,sort);parts.push({title,comics:r.comics.slice(0,6),viewMore:{page:'category',attributes:{category:title,param,options:['0','0','0',sort]}}});
        }return parts;
    }}];
    category={"title":"漫自由","enableRankingPage":false,"parts":[{"name":"常用","type":"fixed","itemType":"category","categories":["全部漫画","完结精选"],"categoryParams":["0","progress:64"]},{"name":"题材","type":"fixed","itemType":"category","categories":["全部","愛情","幽默","冒險","校園","少女","生活","熱血","科幻","競技","格鬥","恐怖","生存","懸疑","偵探","歷史","戰爭","勵志","職場","美食","機戰","魔幻","魔法","奇幻","神鬼","武俠","仙俠","治癒","萌系","宅系","青年","少年","後宮","百合","偽娘","耽美","童話","東方","四格","繪本","藝術","雜誌","連環畫"],"categoryParams":["0","3","2","13","22","39","20","11","27","10","12","14","15","16","17","18","19","21","23","24","26","28","29","30","31","32","33","34","35","36","37","38","40","41","42","44","45","46","47","48","49","50","52"]},{"name":"地区","type":"fixed","itemType":"category","categories":["日本","歐美","港臺","大陸","韓國"],"categoryParams":["region:5","region:6","region:7","region:8","region:9"]},{"name":"语言","type":"fixed","itemType":"category","categories":["繁體","简体","日語","英文"],"categoryParams":["language:55","language:56","language:57","language:58"]},{"name":"进度","type":"fixed","itemType":"category","categories":["完結","連載","停更"],"categoryParams":["progress:64","progress:65","progress:66"]}]};
    categoryComics={optionList:[{options:['0-全部地区','5-日本','6-欧美','7-港台','8-大陆','9-韩国']},{options:['0-全部语言','55-繁体','56-简体','57-日语','58-英文']},{options:['0-全部进度','64-完结','65-连载','66-停更']},{options:['0-最近更新','1-最高评分']}],load:async(c,p,o,page)=>{
        if(!/^(?:(?:region|language|progress):)?\d+$/.test(p))throw new Error('未知分类。');return this.list(p,page,o[3]||'0',o);
    }};
    comic={
        loadInfo:async id=>{
            if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('无效作品 ID。');
            const doc=new HtmlDocument(await this.html('/comic/'+id));
            try{
                const title=(doc.querySelector('.detail h1')||doc.querySelector('.detail h5'))?.text.trim();if(!title)throw new Error('漫自由未找到作品。');
                const img=doc.querySelector('.detail img'),volumes=doc.querySelectorAll('.vol-item-no').map(n=>n.text.trim());
                this.saveData('lastComic',id);
                return new ComicDetails({title,subtitle:'EPUB / MOBI 文件站 · 网页下载',cover:this.absolute(img?.attributes.src||''),description:'本站提供 EPUB / MOBI 文件，不是在线分话图片源。\n点“下载”后展开“Archive / 压缩包”，选择卷条目可打开网站下载页；不会创建软件内图片下载任务。也可到源设置打开最近查看的作品。网页登录与额度以网站为准。\n\n卷目录：\n'+volumes.join('\n'),chapters:{}});
            }finally{doc.dispose();}
        },
        loadEp:async()=>{throw new Error('漫自由提供 ePub / MOBI 文件，不支持普通分话图片阅读。请从源设置打开最近作品下载页。');},
        onThumbnailLoad:url=>({url,headers:{Referer:this.base+'/'}}),
        archive:{
            getArchives:async id=>{
                if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('无效作品 ID。');
                const doc=new HtmlDocument(await this.html('/comic/'+id));
                try{
                    const items=[];
                    for(const node of doc.querySelectorAll('.vol-item')){
                        const input=node.querySelector('input'),name=node.querySelector('.vol-item-no')?.text.trim();
                        const vol=input?.attributes.value;
                        if(name&&/^\d+$/.test(vol||''))items.push({id:vol,title:name+'（网页文件下载）',description:'EPUB / MOBI；选择后打开网站，需在网页登录下载。'});
                    }
                    if(!items.length)throw new Error('未找到文件卷目录，请从源设置打开网站查看。');return items;
                }finally{doc.dispose();}
            },
            getDownloadUrl:async(id,vol)=>{
                if(!/^[a-zA-Z0-9_-]+$/.test(id)||!/^\d+$/.test(vol))throw new Error('无效作品或文件 ID。');
                UI.launchUrl(this.base+'/comic/'+id+'#vol'+vol);
                // 不返回 EPUB URL 给只支持 ZIP 图片归档的下载器。
                throw new Error('已打开所选卷的网页，请在网站登录后点击下载。本源不启动软件内图片下载。');
            }
        }
    };
    settings={website:{title:'文件下载入口',type:'callback',buttonText:'打开最近查看的作品',callback:()=>{const id=this.loadData('lastComic');UI.launchUrl(this.base+(id?'/comic/'+id:'/'));}},notice:{title:'阅读方式',type:'callback',buttonText:'查看说明',callback:()=>UI.showMessage('漫自由是 ePub / MOBI 文件站，本源支持搜索和目录；请在网站下载后使用兼容阅读器打开。')}};
    account={loginWithWebview:{url:'https://mheee.com/m/user/login',checkStatus:(url,title)=>/^https:\/\/mheee\.com\/(?:m\/user\/(?:center|index)|$)/.test(url||'')&&/漫自由/.test(title||'')},logout:()=>Network.deleteCookies(this.base)};

    _checkedComic = this.comic;
    comic = {...this._checkedComic, loadInfo:async id=>{
        const info=await this._checkedComic.loadInfo(id);
        if(!info.tags)info.tags={};
        if(info.tags instanceof Map)info.tags=Object.fromEntries(info.tags);
        return info;
    }};

}
