// 拷贝漫画公开网页接口适配；两条线路共享作品/章节 ID。
class CopyWeb extends ComicSource {
    name='拷贝漫画'; key='copy_web_routes'; version = "2.1.0"; minAppVersion='1.16.0'; url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/copy_manga.js";
    get base(){return this.loadSetting('line')==='mangacopy'?'https://www.mangacopy.com':'https://www.copy4000.com';}
    settings={line:{title:'线路选择',type:'select',options:[{value:'copy4000',text:'copy4000.com'},{value:'mangacopy',text:'mangacopy.com（需自行确认网络可达）'}],default:'copy4000'},website:{title:'当前网站',type:'callback',buttonText:'打开网站',callback:()=>UI.launchUrl(this.base)}};
    headers(base){return{'User-Agent':'VeneraNext/v1.18.0','Referer':base+'/'};}
    async get(path,base,extra={}){const r=await Network.get(base+path,{...this.headers(base),...extra});if(r.status!==200||/Just a moment|正在验证|Sorry, you have been blocked/i.test(r.body||''))throw new Error('拷贝漫画请求失败：HTTP '+r.status+'。请检查所选线路网络或在网站完成验证。');return r.body;}
    parseList(root){
        const seen={},comics=[];
        for(const a of root.querySelectorAll('a')){
            const m=(a.attributes.href||'').match(/^\/comic\/([a-zA-Z0-9_-]+)\/?$/),img=a.querySelector('img');
            if(!m||!img||seen[m[1]])continue;
            const title=(a.attributes.title||img.attributes.alt||a.querySelector('p')?.attributes.title||a.querySelector('p')?.text||a.text).trim();
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
        const base=this.base,ordering=options[0]==='popular'?'-popular':'-datetime_updated';
        const path='/comics?ordering='+encodeURIComponent(ordering)+'&offset='+((page-1)*50)+'&limit=50'+(param?'&theme='+encodeURIComponent(param):'');
        const doc=new HtmlDocument(await this.get(path,base));
        try{
            let maxPage=page;for(const a of doc.querySelectorAll('a')){const n=Number((a.attributes.href||'').match(/[?&]offset=(\d+)/)?.[1]);if(Number.isFinite(n))maxPage=Math.max(maxPage,Math.floor(n/50)+1);}
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
                    if(comics.length){parts.push({title:head.text.replace(/\s+/g,'').trim(),comics:comics.slice(0,6)});break;}
                }
            }
            if(!parts.length)throw new Error('拷贝漫画首页结构已变化。');return parts;
        }finally{doc.dispose();}
    }}];
    category={title:'拷贝漫画',enableRankingPage:false,parts:[{name:'题材',type:'fixed',itemType:'category',categories:['全部漫画','冒险','爱情','校园','搞笑','科幻','悬疑','奇幻','生活','职场','治愈'],categoryParams:['','maoxian','aiqing','xiaoyuan','gaoxiao','kehuan','xuanyi','qihuan','shenghuo','zhichang','zhiyu']}]};
    categoryComics={optionList:[{options:['updated-最近更新','popular-人气']}],load:async(c,p,o,page)=>this.list(p,page,o)};
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
