// 漫自由：文件目录型源。本站提供 ePub/MOBI，非普通在线分话图片站。
// archive 走站点 /m/vol/download_add 换取真实文件地址（需登录），由宿主下载 EPUB/MOBI。
class Mheee extends ComicSource {
    name='漫自由'; key='mheee_catalog'; version = "2.3.4"; minAppVersion='1.16.0'; url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/mheee.js"; base='https://mheee.com';
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
        const pair=String(param).split(':');
        // hasOwnProperty：`'__proto__' in filters` 也为真，不能用来校验用户参数。
        if(pair.length===2&&Object.prototype.hasOwnProperty.call(filters,pair[0]))filters[pair[0]]=pair[1];else filters.genre=param;
        const path='/m/list-'+filters.genre+'-'+filters.region+'-'+filters.progress+'-'+filters.language+'-0-'+sort+'-'+page,doc=new HtmlDocument(await this.html(path));
        try{let maxPage=page;for(const a of doc.querySelectorAll('.pagination a')){const n=Number((a.attributes.href||'').match(/-(\d+)$/)?.[1]);if(n>maxPage)maxPage=n;}return{comics:this.parseList(doc),maxPage};}finally{doc.dispose();}
    }
    search={optionList:[],load:async(k,o,p)=>{
        const doc=new HtmlDocument(await this.html('/m/comic/search?q='+encodeURIComponent(k.trim())+'&page='+p));
        try{let maxPage=p;for(const a of doc.querySelectorAll('.pagination a')){const n=Number((a.attributes.href||'').match(/[?&]page=(\d+)/)?.[1]);if(n>maxPage)maxPage=n;}return{comics:this.parseList(doc),maxPage};}finally{doc.dispose();}
    }};
    explore=[{title:'漫自由',type:'multiPartPage',load:async()=>{
        const parts=[];for(const [title,param,sort]of [['最近更新','0','0'],['最高评分','0','1']]){
            const r=await this.list(param,1,sort);parts.push({title,comics:r.comics.slice(0,6),viewMore:{page:'category',attributes:{category:title,param,options:['0','0','0',sort]}}});
        }return parts;
    }}];
    category={"title":"漫自由","enableRankingPage":false,"parts":[{"name":"题材","type":"fixed","itemType":"category","categories":["全部","愛情","幽默","冒險","校園","少女","生活","熱血","科幻","競技","格鬥","恐怖","生存","懸疑","偵探","歷史","戰爭","勵志","職場","美食","機戰","魔幻","魔法","奇幻","神鬼","武俠","仙俠","治癒","萌系","宅系","青年","少年","後宮","百合","偽娘","耽美","童話","東方","四格","繪本","藝術","雜誌","連環畫"],"categoryParams":["0","3","2","13","22","39","20","11","27","10","12","14","15","16","17","18","19","21","23","24","26","28","29","30","31","32","33","34","35","36","37","38","40","41","42","44","45","46","47","48","49","50","52"]},{"name":"地区","type":"fixed","itemType":"category","categories":["日本","歐美","港臺","大陸","韓國"],"categoryParams":["region:5","region:6","region:7","region:8","region:9"]},{"name":"语言","type":"fixed","itemType":"category","categories":["繁體","简体","日語","英文"],"categoryParams":["language:55","language:56","language:57","language:58"]},{"name":"进度","type":"fixed","itemType":"category","categories":["完結","連載","停更"],"categoryParams":["progress:64","progress:65","progress:66"]}]};
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
                // 记录最近作品供源设置使用；值未变化时不重复写盘。
                if(this.loadData('lastComic')!==id)this.saveData('lastComic',id);
                // 无封面时必须返回空串：absolute('') 会得到站点根地址，不是图片。
                const coverSrc=img?.attributes['data-src']||img?.attributes.src||'';
                return new ComicDetails({title,subtitle:'EPUB / MOBI 文件站',cover:coverSrc?this.absolute(coverSrc):'',description:'漫自由是 EPUB / MOBI 下载站，不是在线分话图片源，下载后请用兼容阅读器打开。\n登录网站账号后，点「下载」→ 展开「归档」→ 选卷，即可在软件内直接下载（本作共 '+volumes.length+' 卷）。',
                    // 文件站详情页只有卷目录、没有题材/作者标签；显式给空对象，缺 tags 会被宿主判为 Invalid data。
                    tags:{},chapters:null});
            }finally{doc.dispose();}
        },
        loadEp:async()=>{throw new Error('漫自由只有 EPUB / MOBI 文件，不能分话阅读；请点「下载」→ 展开「归档」选卷下载。');},
        onThumbnailLoad:url=>({url,headers:{Referer:this.base+'/'}}),
        archive:{
            getArchives:async id=>{
                if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('无效作品 ID。');
                const doc=new HtmlDocument(await this.html('/comic/'+id));
                try{
                    const items=[];
                    for(const node of doc.querySelectorAll('.vol-item')){
                        const input=node.querySelector('input'),name=(node.querySelector('.vol-item-no')?.text||'').trim(),vol=input?.attributes.value;
                        if(!name||!/^\d+$/.test(vol||''))continue;
                        // 站点给每卷两个体积（EPUB / MOBI）和页数，摊平成一行副标题，列表才像普通章节列表一样干净。
                        let mobi='',epub='',pages='';
                        for(const info of node.querySelectorAll('.vol-item-info')){
                            const cls=String(info.attributes.class||''),text=(info.text||'').trim();
                            if(!text)continue;
                            if(cls.indexOf('ext-mobi')>=0)mobi=text;
                            else if(cls.indexOf('ext-epub')>=0)epub=text;
                            else pages=text.replace(/^[（(]|[)）]$/g,'');
                        }
                        const meta=[];
                        // 站点文案本身带「頁」，别再拼一次，否则会出现「41頁頁」。
                        if(pages)meta.push(/頁$/.test(pages)?pages:pages+'頁');
                        if(epub||mobi)meta.push('EPUB '+(epub||'-')+' · MOBI '+(mobi||'-'));
                        items.push({id:vol,title:name,description:meta.join(' · ')});
                    }
                    if(!items.length)throw new Error('未找到文件卷目录，请从源设置打开网站查看。');return items;
                }finally{doc.dispose();}
            },
            getDownloadUrl:async(id,vol)=>{
                if(!/^[a-zA-Z0-9_-]+$/.test(id)||!/^\d+$/.test(vol))throw new Error('无效作品或文件 ID。');
                const ext=this.downloadFormat();
                // 站点前端 fileDownload() 就是 POST 这个地址，返回 {result:[{url,file_name}]}；
                // 它依赖登录 Cookie，未登录返回 4001002。
                const body='ids[]='+encodeURIComponent(vol)+'&ext='+encodeURIComponent(ext);
                const res=await Network.post(this.base+'/m/vol/download_add',{'Referer':this.base+'/comic/'+id,'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest','Accept':'application/json, text/javascript, */*; q=0.01'},body);
                let json;
                try{json=JSON.parse(res.body||'{}');}catch(_){throw new Error('漫自由下载接口返回异常（HTTP '+res.status+'）。');}
                const first=Array.isArray(json.result)?json.result[0]:null,url=first?String(first.url||''):'';
                if(url)return url+(url.indexOf('?')>=0?'&':'?')+'filename='+encodeURIComponent(first.file_name||(id+'_'+vol+'.'+ext));
                const code=json.code,message=json.message||'';
                if(code===4001002)throw new Error('请先在源设置的「登录」里登录漫自由网站账号，登录后再选该卷下载。');
                throw new Error('漫自由下载失败：'+(message||('返回码 '+(code||res.status)))+'。');
            }
        }
    };
    // 站点默认 epub，用户可在源设置里切成 mobi；只影响「归档」下载的文件格式。
    downloadFormat(){const v=this.loadSetting('format');return v==='mobi'?'mobi':'epub';}
    settings={format:{title:'下载格式',type:'select',options:[{value:'epub',text:'EPUB'},{value:'mobi',text:'MOBI'}],default:'epub'},website:{title:'文件下载入口',type:'callback',buttonText:'打开最近查看的作品',callback:()=>{const id=this.loadData('lastComic');UI.launchUrl(this.base+(id?'/comic/'+id:'/'));}},notice:{title:'阅读方式',type:'callback',buttonText:'查看说明',callback:()=>UI.showMessage('漫自由是 EPUB / MOBI 下载站。点「下载」→ 展开「归档」→ 选卷，登录网站账号后即可在软件内下载；下载完成后请用兼容阅读器打开。')}};
    // 未登录时 /m/user/index 与 /m/user/login 返回的是同一张登录表单（标题里带「登录」），
    // 所以不能只看 URL：必须要求标题不含 登录/注册/404，否则网页刚打开就会被误判为登录成功。
    account={
        loginWithWebview:{
            url:'https://mheee.com/m/user/login',
            checkStatus:(url,title)=>{
                if(!/^https:\/\/mheee\.com\/m\/user\/(?:index|login)(?:\/|[?#]|$)/.test(url||''))return false;
                if(!/漫自由/.test(title||''))return false;
                return !/登录|登入|登陆|注册|註冊|验证|驗證|404/i.test(title||'');
            },
            // 宿主允许异步：回到个人中心再确认一次，避免把「只是打开了网页」当成已登录。
            onLoginSuccess:async()=>{
                try{
                    const r=await Network.get(this.base+'/m/user/index',{Referer:this.base+'/'});
                    if(r.status!==200)throw new Error('HTTP '+r.status);
                    if(/<input[^>]+name=["']password["']/i.test(r.body||''))throw new Error('页面仍是登录表单');
                    UI.showMessage('漫自由账号已登录：接下来在网站里下载 EPUB / MOBI 会带上这份 Cookie。');
                }catch(e){
                    UI.showMessage('网页已返回，但没有确认到登录状态（'+e.message+'）。下载前请先确认网站右上角已显示账号。');
                }
            }
        },
        logout:()=>Network.deleteCookies('https://mheee.com')
    };

}

