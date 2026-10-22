const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
function source(name){
 const state={open:0,created:0,fail:false,status:200,images:null};
 class ComicSource{loadData(){}saveData(){}deleteData(){}loadSetting(key){return this.settings[key]?.default;}}
 class Document{
  constructor(){state.open++;state.created++;this.closed=false;}
  querySelector(){if(state.fail)throw new Error('parser failure');return null;}
  querySelectorAll(){if(state.fail)throw new Error('parser failure');return state.images||[];}
  dispose(){assert(!this.closed);this.closed=true;state.open--;}
 }
 const context={ComicSource,HtmlDocument:Document,Comic:class{constructor(x){Object.assign(this,x)}},ComicDetails:class{constructor(x){Object.assign(this,x)}},APP:{platform:'windows'},UI:{},Network:{get:async()=>({status:state.status,body:'<html></html>'}),deleteCookies(){}}};
 const code=fs.readFileSync(path.join(__dirname,'../sources',name+'.js'),'utf8');
 const cls=code.match(/class\s+(\w+)\s+extends ComicSource/)[1];
 return{s:vm.runInNewContext(code+';new '+cls+'()',context),state};
}
(async()=>{
 for(const name of ['mycomic','baozi']){
  const {s,state}=source(name);
  const actions=name==='mycomic'?[
   ...s.originalExplore.map(part=>()=>part.load(1)),()=>s.originalCategoryComics.load('','',[],1),
   ()=>s.categoryComics.ranking.load('views',1),()=>s.search.load('test',[],1),
   ()=>s.comic.loadInfo('1'),()=>s.comic.loadEp('1','1')
  ]:[()=>s.upstreamExplore[0].load(),()=>s.search.load('test',[],1),()=>s.favorites.loadComics(1),()=>s.comic.loadInfo('1'),()=>s.comic.loadEp('1','1')];
  for(const fail of [false,true])for(const action of actions){
   state.fail=fail;const count=state.created;
   await action().catch(()=>{});
   assert.equal(state.created,count+1,name+' parser must run');assert.equal(state.open,0,name+' leaked document');
  }
 }
 {
  const {s,state}=source('mycomic');state.status=404;
  // 旧 loadInfo 已删除：列表解析只保留 readChapterGroups 一条路径，避免两套逻辑漂移。
  assert.equal(typeof s.originalComic.loadInfo,'undefined','原 loadInfo 必须已删除');
  await assert.rejects(s.comic.loadInfo('1'),/HTTP 404/);assert.equal(state.created,0);
 }
 {
  const {s,state}=source('baozi');
  state.images=[{querySelector:()=>({attributes:{'data-src':'//cdn.example.test/acomic/book/page.jpg'}})}];
  const result=await s.comic.loadEp('1','1');assert.equal(result.images[0],'https://cdn.example.test/w640/acomic/book/page.jpg');assert.equal(state.open,0);
  state.images=[];await assert.rejects(s.comic.loadEp('1','1'),/未取得图片/);assert.equal(state.open,0);
 }
 {
  const {s}=source('manwa');let url;s.list=async path=>{url=path;return{comics:[]};};
  await s.categoryComics.load('更多','/booklist?tag=%E6%82%AC%E7%96%91&area=2&page=9',[],2);
  const u=new URL('https://example.test'+url);assert.equal(u.pathname,'/booklist');assert.equal(u.searchParams.get('tag'),'悬疑');assert.equal(u.searchParams.get('area'),'2');assert(!u.searchParams.has('page'));
 }
 {
  const {s}=source('komiic');const pending=[];
  s.query=()=>new Promise(resolve=>pending.push(resolve));
  const ticket={kid:'fixture',url:'/fixture',ticket:'synthetic-test-only',expiresAt:Date.now()+60000};
  const old=s.ticket('fixture'),joined=s.ticket('fixture');assert.equal(pending.length,1);
  const oldRejected=assert.rejects(old,/登录状态已变化/),joinedRejected=assert.rejects(joined,/登录状态已变化/);
  s.account.logout();const fresh=s.ticket('fixture');assert.equal(pending.length,2);
  pending[0]({getImageTicket:ticket});await Promise.all([oldRejected,joinedRejected]);
  assert(s.ticketRequests.fixture);assert(!s.tickets.fixture);
  pending[1]({getImageTicket:ticket});await fresh;assert(s.tickets.fixture);
  s.account.logout();assert.equal(Object.keys(s.tickets).length,0);
  const chapter=s.comic.loadEp('1','ep_1'),chapterRejected=assert.rejects(chapter,/登录状态已变化/);
  s.account.logout();pending[2]({imageTicketsByChapterId:[ticket]});await chapterRejected;assert.equal(Object.keys(s.tickets).length,0);
 }
 console.log('PASS: document disposal on success/failure, HTTP errors, image URLs, category links and account-change ticket races.');
})().catch(error=>{console.error(error);process.exitCode=1});
