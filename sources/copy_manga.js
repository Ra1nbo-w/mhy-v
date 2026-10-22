// 拷贝漫画公开网页接口适配；两条线路共享作品/章节 ID。
class CopyWeb extends ComicSource {
    name='拷贝漫画'; key='copy_web_routes'; version = "2.3.1"; minAppVersion='1.16.0'; url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/copy_manga.js";
    get base(){return this.loadSetting('line')==='mangacopy'?'https://www.mangacopy.com':'https://www.copy4000.com';}
    settings={line:{title:'线路选择',type:'select',options:[{value:'copy4000',text:'copy4000.com'},{value:'mangacopy',text:'mangacopy.com（需自行确认网络可达）'}],default:'copy4000'},website:{title:'当前网站',type:'callback',buttonText:'打开网站',callback:()=>UI.launchUrl(this.base)}};
    // 不把应用版本写死：升级 VeneraNext 后 UA 会立即失真。
    headers(base){const version=(typeof APP!=='undefined'&&APP.version)||'unknown';return{'User-Agent':'VeneraNext/'+version,'Referer':base+'/'};}
    async get(path,base,extra={}){const r=await Network.get(base+path,{...this.headers(base),...extra});if(r.status!==200||/Just a moment|正在验证|Sorry, you have been blocked/i.test(r.body||''))throw new Error('拷贝漫画请求失败：HTTP '+r.status+'。请检查所选线路网络或在网站完成验证。');return r.body;}
    parseList(root){
        const seen={},comics=[];
        for(const a of root.querySelectorAll('a')){
            const m=(a.attributes.href||'').match(/^\/comic\/([a-zA-Z0-9_-]+)\/?$/),img=a.querySelector('img');
            if(!m||!img||seen[m[1]])continue;
            const title=(a.attributes.title||img.attributes.alt||a.querySelector('p')?.attributes.title||a.querySelector('p')?.text||a.text.trim()||a.parent?.parent?.querySelector('.comicRank-txt-p a')?.text||'').trim();
            const cover=img.attributes['data-src']||img.attributes.src;if(!title||!cover||cover.startsWith('data:'))continue;
            seen[m[1]]=true;comics.push(new Comic({id:m[1],title,cover}));
        }return comics;
    }
    decode(payload,key){
        if(typeof payload!=='string'||payload.length<48||!/^.{16}[0-9a-f]+$/i.test(payload)||((payload.length-16)%32))throw new Error('拷贝加密数据格式已变化。');
        const hex=payload.slice(16),bytes=new Uint8Array(hex.length/2);
        for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(hex.slice(i*2,i*2+2),16);
        const plain=new Uint8Array(Convert.decryptAesCbc(bytes.buffer,Convert.encodeUtf8(key),Convert.encodeUtf8(payload.slice(0,16))));
        const n=plain[plain.length-1];if(n<1||n>16||plain.slice(-n).some(b=>b!==n))throw new Error('拷贝解码失败，请更新漫画源。');
        return JSON.parse(Convert.decodeUtf8(plain.slice(0,-n).buffer));
    }
    async list(param,page,options=[]){
        if(param==='/rank')return this.categoryComics.ranking.load('Day',page);
        const limit=['/recommend','/newest'].includes(param)?60:50;
        const base=this.base,ordering=options[0]==='popular'?'-popular':'-datetime_updated';
        let path='/comics?ordering='+encodeURIComponent(ordering)+'&offset='+((page-1)*limit)+'&limit='+limit+(param?'&theme='+encodeURIComponent(param):'');
        const filters={region:options[1]||'',status:options[2]||''};
        if(param?.startsWith('region:')){filters.region=param.slice(7);path=path.replace(/&theme=[^&]*/,'');}
        if(param?.startsWith('status:')){filters.status=param.slice(7);path=path.replace(/&theme=[^&]*/,'');}
        for(const key of ['region','status'])if(filters[key]!=='')path+='&'+key+'='+encodeURIComponent(filters[key]);
        if(['/recommend','/newest'].includes(param))path=param+'?offset='+((page-1)*limit)+'&limit='+limit;
        const doc=new HtmlDocument(await this.get(path,base));
        try{
            let maxPage=page;for(const a of doc.querySelectorAll('a')){const n=Number((a.attributes.href||'').match(/[?&]offset=(\d+)/)?.[1]);if(Number.isFinite(n))maxPage=Math.max(maxPage,Math.floor(n/limit)+1);}
            return{comics:this.parseList(doc),maxPage};
        }finally{doc.dispose();}
    }
    search={optionList:[],load:async(keyword,options,page)=>{
        const base=this.base,path='/api/kb/web/searchcl/comics?platform=2&limit=20&offset='+((page-1)*20)+'&q_type=name&q='+encodeURIComponent(keyword.trim());
        const json=JSON.parse(await this.get(path,base));if(json.code!==200||!json.results?.list)throw new Error('拷贝搜索接口异常。');
        return{comics:json.results.list.map(row=>new Comic({id:row.path_word,title:row.name,cover:row.cover,subtitle:(row.author||[]).map(a=>a.name).join(' / ')})),maxPage:Math.max(1,Math.ceil(json.results.total/20))};
    }};
    explore=[{title:'拷贝漫画',type:'multiPartPage',load:async()=>{
        const base=this.base,doc=new HtmlDocument(await this.get('/',base));
        try{
            const parts=[];
            // 首页各分区的容器由站点 heading 所在 container 确定。
            for(const head of doc.querySelectorAll('h4.index-all-icon-left-txt')){
                let container=head.parent;
                for(let i=0;i<4&&container;i++,container=container.parent){
                    const comics=this.parseList(container);
                    if(comics.length){
                        const title=head.text.replace(/\s+/g,'').trim(),part={title,comics:comics.slice(0,6)};
                        const link=container.querySelectorAll('a').find(a=>['/recommend','/comics','/newest','/rank'].includes(a.attributes.href));
                        if(link)part.viewMore={page:'category',attributes:{category:title,param:link.attributes.href==='/comics'?'':link.attributes.href}};
                        parts.push(part);break;
                    }
                }
            }
            if(!parts.length)throw new Error('拷贝漫画首页结构已变化。');return parts;
        }finally{doc.dispose();}
    }}];
    category={"title":"拷贝漫画","enableRankingPage":true,"parts":[{"name":"题材","type":"fixed","itemType":"category","categories":["愛情","歡樂向","冒險","奇幻","百合","校园","科幻","東方","耽美","格鬥","TL","生活","轻小说","其他","悬疑","萌系","神鬼","职场","治愈","节操","四格","搞笑","長條","竞技","魔幻","舰娘","伪娘","热血","惊悚","美食","性转换","励志","後宮","音乐舞蹈","侦探","彩色","AA","异世界","历史","穿越","机战","战争","都市","重生","C102","恐怖","生存","C103","C104","武侠","C100","C101","C99","C97","C105","宅系","C106","C96","C107","转生","C98","C95","C108","FATE","無修正","仙侠","LoveLive","雜誌附贈寫真集"],"categoryParams":["aiqing","huanlexiang","maoxian","qihuan","baihe","xiaoyuan","kehuan","dongfang","danmei","gedou","teenslove","shenghuo","qingxiaoshuo","qita","xuanyi","mengxi","shengui","zhichang","zhiyu","jiecao","sige","gaoxiao","changtiao","jingji","mohuan","jianniang","weiniang","rexue","jingsong","meishi","xingzhuanhuan","lizhi","hougong","yinyuewudao","zhentan","COLOR","aa","yishijie","lishi","chuanyue","jizhan","zhanzheng","dushi","chongsheng","comiket102","kongbu","shengcun","comiket103","comiket104","wuxia","comiket100","comiket101","comiket99","comiket97","comiket105","zhaixi","comiket106","comiket96","comiket107","zhuansheng","C98","comiket95","comiket108","fate","Uncensored","xianxia","loveLive","zazhifuzengxiezhenji"]},{"name":"地区","type":"fixed","itemType":"category","categories":["日本","韩国","欧美"],"categoryParams":["region:0","region:1","region:2"]}]};
    categoryComics={optionList:[{notShowWhen:["漫画推荐","漫畫推薦","全新上架","漫画排行榜","漫畫排行榜"],options:['updated-最近更新','popular-人气']},{notShowWhen:["漫画推荐","漫畫推薦","全新上架","漫画排行榜","漫畫排行榜"],options:['-全部地区','0-日本','1-韩国','2-欧美']},{notShowWhen:["漫画推荐","漫畫推薦","全新上架","漫画排行榜","漫畫排行榜"],options:['-全部状态','0-连载中','1-已完结','2-短篇']}],load:async(c,p,o,page)=>this.list(p,page,o),
        ranking:{options:['Day-日榜','Week-周榜','Month-月榜','Total-总榜'],load:async(period,page)=>{
            // 首页的真实排行榜分栏；不伪造分页或未公开的接口。
            if(page>1)return{comics:[],maxPage:1};if(!['Day','Week','Month','Total'].includes(period))period='Day';
            const doc=new HtmlDocument(await this.get('/',this.base));try{
                const comics=[],covers={},seen={};for(const comic of this.parseList(doc))covers[comic.id]=comic.cover;
                for(const gender of ['Man','Woman']){const node=doc.querySelector('#rank'+period+'Comic'+gender);if(!node)continue;
                    for(const a of node.querySelectorAll('a')){const id=(a.attributes.href||'').match(/^\/comic\/([\w-]+)\/?$/)?.[1],title=a.text.trim();if(id&&title&&!seen[id]){seen[id]=true;comics.push(new Comic({id,title,cover:covers[id]||''}));}}
                }return{comics,maxPage:1};
            }finally{doc.dispose();}
        }}};
    comic={
        loadInfo:async id=>{
            if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('无效漫画 ID。');
            const base=this.base,html=await this.get('/comic/'+id,base),doc=new HtmlDocument(html);
            try{
                const title=doc.querySelector('.comicParticulars-title h6')?.text.trim(),img=doc.querySelector('.comicParticulars-left-img img');
                const key=html.match(/var ccz\s*=\s*['"]([^'"]+)['"]/)?.[1];
                if(!title||!key)throw new Error('拷贝详情格式已变化。');
                const directory=JSON.parse(await this.get('/comicdetail/'+id+'/chapters',base,{dnts:doc.querySelector('#dnt')?.attributes.value||''}));
                if(directory.code!==200)throw new Error(directory.message||'拷贝目录加载失败。');
                const decoded=this.decode(directory.results,key),chapters={};
                // 顺序沿用接口返回；站点若改为新→旧，需实机核对后再决定是否反转。
                for(const group of Object.values(decoded.groups||{})){
                    if(!Array.isArray(group.chapters)||group.chapters.length<Number(group.count||0))throw new Error('拷贝目录不完整，请勿下载；等待更新源。');
                    for(const row of group.chapters)chapters['ep_'+row.id]=(group.name==='默認'||group.name==='默认'?'':group.name+' / ')+row.name;
                }
                if(!Object.keys(chapters).length)throw new Error('拷贝没有返回章节。');
                return new ComicDetails({title,cover:img?.attributes['data-src']||img?.attributes.src||'',description:doc.querySelector('.intro')?.text.trim()||'',chapters});
            }finally{doc.dispose();}
        },
        loadEp:async(id,ep)=>{
            const chapter=String(ep).replace(/^ep_/,'');if(!/^[a-zA-Z0-9_-]+$/.test(id)||!/^[-a-f0-9]{36}$/i.test(chapter))throw new Error('无效章节 ID。');
            const base=this.base,html=await this.get('/comic/'+id+'/chapter/'+chapter,base);
            const key=html.match(/var cct\s*=\s*['"]([^'"]+)['"]/)?.[1],payload=html.match(/var contentKey\s*=\s*['"]([^'"]+)['"]/)?.[1];
            if(!key||!payload)throw new Error('拷贝未返回章节数据，请检查阅读权限。');
            const rows=this.decode(payload,key),images=rows.map(r=>typeof r==='string'?r:r.url);
            if(!images.length||images.some(u=>!/^https?:\/\//.test(u)))throw new Error('拷贝章节图片格式已变化。');return{images};
        },
        onImageLoad:url=>({url,headers:this.headers(this.base)}),onThumbnailLoad:url=>({url,headers:this.headers(this.base)})
    };

    _checkedComic = this.comic;
    comic = {...this._checkedComic, loadInfo:async id=>{
        const info=await this._checkedComic.loadInfo(id);
        if(!info.tags)info.tags={};
        if(info.tags instanceof Map)info.tags=Object.fromEntries(info.tags);
        return info;
    }};

}

