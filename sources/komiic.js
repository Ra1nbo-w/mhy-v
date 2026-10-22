// Komiic.cc；以站点当前公开 GraphQL 接口和图片票据协议适配。
// 分类 ID 参考 venera-app/venera-configs/komiic.js；本地定制版。
class KomiicCC extends ComicSource {
    name='Komiic漫画'; key='komiic_cc'; version = "2.3.3"; minAppVersion='1.16.0'; url = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/sources/komiic.js";
    base='https://komiic.cc'; tickets={}; ticketRequests={}; ticketEpoch=0;
    resetTickets(){this.ticketEpoch++;this.tickets={};this.ticketRequests={};}
    fields='id title imageUrl authors {id name} categories {id name} dateUpdated';
    async query(query,variables={}) {
        const headers={'Content-Type':'application/json','Referer':this.base+'/'};
        const token=this.loadData('token');if(token)headers.Authorization='Bearer '+token;
        const r=await Network.post(this.base+'/api/query',headers,JSON.stringify({query,variables}));
        if(r.status===402)throw new Error('Komiic 图片额度不足，请在网站查看额度或登录账号。');
        if(r.status===429)throw new Error('Komiic 请求过于频繁，请稍后重试。');
        if(r.status!==200)throw new Error('Komiic 请求失败：HTTP '+r.status+'；如需验证，请使用本源网页登录入口。');
        let json;try{json=JSON.parse(r.body);}catch(_){throw new Error('Komiic 返回非 JSON 数据，请完成浏览器验证后重试。');}
        if(json.errors?.length)throw new Error(json.errors.map(e=>e.message).join('；'));
        if(!json.data)throw new Error('Komiic 接口没有返回数据。');
        return json.data;
    }
    parse(row){return new Comic({id:String(row.id),title:row.title,cover:row.imageUrl,subtitle:(row.authors||[]).map(a=>a.name).join(' / '),tags:(row.categories||[]).map(c=>c.name)});}
    // 追更只接受 YYYY-MM-DD；接口偶尔返回带时间的 ISO 串，直接透传会被应用判为无效日期。
    dateOnly(value){const m=String(value||'').match(/^\d{4}-\d{2}-\d{2}/);return m?m[0]:undefined;}
    async list(param,page=1,options=[]){
        const hot=param==='hot'||param==='views',recent=param==='recent';
        const fn=hot?'hotComics':recent?'recentUpdate':'comicByCategories';
        const variables={pagination:{limit:30,offset:(page-1)*30,orderBy:hot?(param==='hot'?'MONTH_VIEWS':'VIEWS'):(options[0]||'DATE_UPDATED'),asc:false,status:param==='completed'?'END':(options[1]||'')}};
        if(!hot&&!recent)variables.categoryId=param==='0'||param==='completed'?[]:[String(param)];
        const declaration=hot||recent?'$pagination: Pagination!':'$categoryId: [ID!]!, $pagination: Pagination!';
        const args=hot||recent?'pagination:$pagination':'categoryId:$categoryId,pagination:$pagination';
        const data=await this.query('query('+declaration+'){'+fn+'('+args+'){'+this.fields+'}}',variables);
        const comics=data[fn].map(row=>this.parse(row));
        return {comics,maxPage:comics.length===30?page+1:page};
    }
    search={optionList:[],load:async(keyword,options,page)=>{
        if(page>1)return{comics:[],maxPage:1};
        const data=await this.query('query($keyword:String!){searchComicsAndAuthors(keyword:$keyword){comics{'+this.fields+'}}}',{keyword:keyword.trim()});
        return{comics:data.searchComicsAndAuthors.comics.map(r=>this.parse(r)),maxPage:1};
    }};
    explore=[{title:'Komiic漫画',type:'multiPartPage',load:async()=>{
        const parts=[];
        for(const [title,param] of [['最近更新','recent'],['本月热门','hot'],['人气漫画','views']]){
            const data=await this.list(param,1);
            parts.push({title,comics:data.comics.slice(0,6),viewMore:{page:'category',attributes:{category:title,param}}});
        }
        return parts;
    }}];
    // 分类 ID 来自网站 allCategory 接口；网页分组可随网站更新，更新源时重新核对。
    categoryGroups=[
        ['类型','愛情:1 搞笑:5 劇情:97 戲劇:58 冒險:8 格鬥:13 動作:64 戰鬥:54 生存:59 武俠:35 魔幻:11 魔法:12 黑暗奇幻:57 科幻:17 機戰:36 賽博龐克:277 懸疑:7 推理:23 偵探:25 犯罪:93 恐怖:9 驚悚:48 策略:60'],
        ['关系','百合:18 耽美:16 友情:92 親情:247 性轉換:70 偽娘:26'],
        ['设定','校園:4 職場:10 生活:6 日常:78 家庭:276 異世界:47 轉生:56 穿越:88 後宮:2 社會:31 政治:61 歷史:32 宮廷:255 戰爭:33'],
        ['题材','美食:27 醫療:85 音樂:37 舞蹈:34 競技:22 體育:40 復仇:55 黑道:42 賭博:114 同人:164'],
        ['氛围','青春:81 熱血:21 勵志:15 成長:184 治癒:19 溫馨:129 萌系:20 神鬼:3 心理:87 黑暗:62 致鬱:86'],
        ['客群','少女:113 青年:246 女性向:123 宅男:14 成人:51'],
        ['形式','四格:28 雜誌:24']
    ];
    category={title:'Komiic漫画',enableRankingPage:false,parts:this.categoryGroups.map(([name,entries])=>{
        const pairs=entries.split(' ').map(entry=>entry.split(':'));
        return{name,type:'fixed',itemType:'category',categories:pairs.map(pair=>pair[0]),categoryParams:pairs.map(pair=>pair[1])};
    })};
    categoryComics={optionList:[{options:['DATE_UPDATED-更新','VIEWS-人气','FAVORITE_COUNT-收藏']},{options:['-全部','ONGOING-连载中','END-完结']}],load:async(c,p,o,page)=>this.list(p,page,o)};
    async ticket(kid){
        const saved=this.tickets[kid];
        if(saved&&saved.validUntil>Date.now()+15000)return saved;
        if(this.ticketRequests[kid])return this.ticketRequests[kid];
        const epoch=this.ticketEpoch;
        const pending=(async()=>{
            const data=await this.query('query($kid:String!){getImageTicket(kid:$kid){url ticket kid width height expiresAt}}',{kid});
            if(epoch!==this.ticketEpoch)throw new Error('Komiic 登录状态已变化，请重新打开章节。');
            return this.remember(data.getImageTicket);
        })();
        this.ticketRequests[kid]=pending;
        try{return await pending;}finally{if(this.ticketRequests[kid]===pending)delete this.ticketRequests[kid];}
    }
    remember(t){
        if(!t||!t.kid||!t.ticket||!t.url)throw new Error('Komiic 未发放图片票据，可能已达阅读额度。');
        const raw=typeof t.expiresAt==='number'?t.expiresAt:Number(t.expiresAt);
        const expiry=Number.isFinite(raw)&&raw>0?(raw<1e12?raw*1000:raw):Date.parse(t.expiresAt);
        const value={...t,validUntil:Number.isFinite(expiry)?expiry:Date.now()+45000};
        // 仅运行期缓存，不把短期票据写入文件或日志。
        this.tickets[t.kid]=value;
        const keys=Object.keys(this.tickets);if(keys.length>500)for(const key of keys.slice(0,keys.length-500))delete this.tickets[key];
        return value;
    }
    comic={
        loadInfo:async id=>{
            const data=await this.query('query($ids:[ID]!,$id:ID!){comicByIds(comicIds:$ids){'+this.fields+'} chaptersByComicId(comicId:$id){id serial type size}}',{ids:[String(id)],id:String(id)});
            const row=data.comicByIds[0];if(!row)throw new Error('Komiic 未找到该漫画。');
            const chapters={};
            // 章节 ID 使用站点 id（ep_ 前缀），不随目录位置变化。
            for(const ch of data.chaptersByComicId)chapters['ep_'+ch.id]=(ch.type==='book'?'卷 ':'第 ')+ch.serial;
            return new ComicDetails({title:row.title,cover:row.imageUrl,tags:{作者:(row.authors||[]).map(a=>a.name),题材:(row.categories||[]).map(c=>c.name)},chapters,updateTime:this.dateOnly(row.dateUpdated)});
        },
        loadEp:async(id,ep)=>{
            const epoch=this.ticketEpoch;
            const chapterId=String(ep).replace(/^ep_/, '');
            const data=await this.query('query($chapterId:ID!){imageTicketsByChapterId(chapterId:$chapterId){url ticket kid width height expiresAt}}',{chapterId});
            if(epoch!==this.ticketEpoch)throw new Error('Komiic 登录状态已变化，请重新打开章节。');
            const rows=data.imageTicketsByChapterId;
            if(!rows?.length)throw new Error('Komiic 章节图片为空，可能需要登录或已达额度。');
            return {images:rows.map(t=>{this.remember(t);return this.base+'/api/image/'+t.kid;})};
        },
        onImageLoad:async url=>{
            const kid=String(url).match(/\/api\/image\/([^?#]+)/)?.[1];
            if(!kid)throw new Error('未知 Komiic 图片地址。');
            const t=await this.ticket(kid);
            return{url:t.url.startsWith('/')?this.base+t.url:t.url,headers:{'X-Image-Ticket':t.ticket,'Referer':this.base+'/'}};
        },
        onThumbnailLoad:url=>({url,headers:{'Referer':'https://komiic.cc/'}})
    };
    // 网页登录只能替浏览器过验证、拿 Cookie；GraphQL 用的是 Bearer token，两者不是一回事。
    settings = {
        checkToken:{title:'检查 API 登录状态',type:'callback',buttonText:'检查登录令牌',callback:async()=>{
            if(!this.loadData('token'))throw new Error('还没有保存 token：请用「账号密码」登录，或在「登录」里粘贴 token。');
            const data=await this.query('query{account{id}}');
            if(!data.account)throw new Error('令牌没有通过接口校验。');
            UI.showMessage('API 登录有效（用户 ID '+data.account.id+'）。');
        }}
    };
    account={
        login:async(email,password)=>{
            const account=String(email||'').trim(),pwd=String(password||'');
            if(!account||!pwd)throw new Error('Komiic 登录需要邮箱和密码。');
            const r=await Network.post(this.base+'/api/login',{'Content-Type':'application/json',Referer:this.base+'/'},JSON.stringify({email:account,password:pwd}));
            if(r.status!==200)throw new Error('Komiic 登录失败（HTTP '+r.status+'），请检查账号、密码及网站验证状态。');
            let data;try{data=JSON.parse(r.body);}catch(_){throw new Error('登录返回非 JSON，请先在网站完成验证。');}
            if(!data.token)throw new Error('Komiic 没有返回登录令牌。');
            this.saveData('token',data.token);this.resetTickets();
            // 令牌存下来后立刻验一次：接口对未登录/失效令牌会返回 no token。
            try{await this.query('query{account{id}}');}catch(e){this.deleteData('token');throw new Error('Komiic 登录令牌无效：'+e.message);}
            return 'ok';
        },
        // 网页登录只能替浏览器过验证、拿 Cookie；GraphQL 用的是 Bearer token，两者不是一回事。
        loginWithWebview:{url:'https://komiic.cc/',checkStatus:(url,title)=>/^https:\/\/komiic\.cc(?:\/|$)/.test(url||'')&&/Komiic/i.test(title||'')&&!/验证|驗證|moment|blocked|challenge/i.test(title||''),onLoginSuccess:()=>{
            this.resetTickets();
            const cookies=Network.getCookies('https://komiic.cc')||[];
            UI.showMessage(cookies.length?'Komiic 网页会话已保存（用于过网站验证）。图片与阅读额度仍走 API，请用「账号密码」登录。':'网页已保存，但没有读到 Cookie。若接口提示需要验证，请重开网页登录完成一次验证。');
        }},
        // 兜底：网页登录拿不到 Bearer token 时，可以粘贴网站里的 token。
        loginWithCookies:{fields:['token（网站 F12 → Application → Local Storage → token）'],validate:async values=>{
            const token=((values||[])[0]||'').trim();
            if(!token)return false;
            this.saveData('token',token);
            try{const data=await this.query('query{account{id}}');if(!data.account)throw new Error('空账号');this.resetTickets();return true;}
            catch(_){this.deleteData('token');return false;}
        }},
        logout:()=>{this.resetTickets();this.deleteData('token');Network.deleteCookies(this.base);}
    };

}

