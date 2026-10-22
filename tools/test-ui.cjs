// Source contract regressions. No account, network, browser or comic payload required.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
function source(file,DocumentClass){
 const requests=[],code=fs.readFileSync(root+'/sources/'+file+'.js','utf8');
 class ComicSource{loadSetting(){}loadData(){}saveData(){}deleteData(){}}
 class EmptyDocument{querySelectorAll(){return [];}querySelector(){return null;}dispose(){}}
 const Network={get:async url=>{requests.push(url);return{status:200,body:file==='baozi'?'"unused"':'<html></html>'};},getCookies:()=>[]};
 const context=vm.createContext({ComicSource,Comic:class{constructor(o){Object.assign(this,o);}},ComicDetails:class{},HtmlDocument:DocumentClass||EmptyDocument,Network,UI:{},console});
 const name=code.match(/class\s+(\w+)\s+extends ComicSource/)[1],instance=vm.runInContext(code+';new '+name+'()',context);
 return{instance,requests};
}
(async()=>{
 const all=JSON.parse(fs.readFileSync(root+'/all.json','utf8'));
 for(const item of all){const {instance:s}=source(path.basename(item.fileName,'.js'));assert.equal(s.explore.length,1);assert.equal(s.explore[0].type,'multiPartPage');assert.equal(s.explore[0].title,item.name);assert.equal(s.category.title,item.name);for(const p of s.category.parts){assert.notEqual(p.name,'常用');assert.equal(p.categories.length,p.categoryParams.length);}}
 {
  const {instance:s,requests}=source('copy_manga');
  await s.categoryComics.load('冒险','maoxian',['popular','0','1'],3);let u=new URL(requests.pop());
  assert.equal(u.searchParams.get('theme'),'maoxian');assert.equal(u.searchParams.get('region'),'0');assert.equal(u.searchParams.get('status'),'1');assert.equal(u.searchParams.get('ordering'),'-popular');assert.equal(u.searchParams.get('offset'),'100');
  await s.categoryComics.load('日本','region:0',['updated','',''],1);u=new URL(requests.pop());assert.equal(u.searchParams.get('region'),'0');assert(!u.searchParams.has('theme'));
  await s.categoryComics.load('全新上架','/newest',[],2);u=new URL(requests.pop());assert.equal(u.pathname,'/newest');assert.equal(u.searchParams.get('offset'),'60');assert.equal(u.searchParams.get('limit'),'60');
  const count=requests.length;assert.equal((await s.categoryComics.ranking.load('Day',2)).comics.length,0);assert.equal(requests.length,count);
 }
 {
  const {instance:s,requests}=source('mheee');await s.categoryComics.load('冒险','13',['5','56','64','1'],2);assert.equal(new URL(requests.pop()).pathname,'/m/list-13-5-64-56-0-1-2');
  await s.categoryComics.load('完结精选','progress:64',['0','0','0','1'],1);assert.equal(new URL(requests.pop()).pathname,'/m/list-0-0-64-0-0-1-1');
 }
 {
  const {instance:s,requests}=source('mycomic');await s.categoryComics.load('爱情','tag:aiqing',['update','japan','shaonv','0','2025'],2);const u=new URL(requests.pop());
  for(const [key,value]of Object.entries({tag:'aiqing',country:'japan',audience:'shaonv',end:'0',year:'2025'}))assert.equal(u.searchParams.get('filter['+key+']'),value);assert.equal(u.searchParams.get('sort'),'-update');assert.equal(u.searchParams.get('page'),'2');
 }
 {
  const {instance:s,requests}=source('baozi');s.getChecked=async url=>{requests.push(url);return{status:200,body:'{"items":[],"next":false}'};};
  await s.categoryComics.load('日本','region:jp',['all','pub','digits'],2);const u=new URL(requests.pop());assert.equal(u.searchParams.get('type'),'all');assert.equal(u.searchParams.get('region'),'jp');assert.equal(u.searchParams.get('state'),'pub');assert.equal(u.searchParams.get('filter'),'0-9');assert.equal(u.searchParams.get('page'),'2');
 }
 {
  const {instance:s}=source('komiic');let variables;s.query=async(q,v)=>{variables=v;return{comicByCategories:[]};};await s.list('completed',1,[]);assert.equal(variables.pagination.status,'END');assert.equal(variables.categoryId.length,0);
  assert.equal(s.category.parts.length,7);
  const labels=s.category.parts.map(part=>part.name);assert.deepEqual(labels,['类型','关系','设定','题材','氛围','客群','形式']);
  const item=s.category.parts[0],index=item.categories.indexOf('黑暗奇幻');assert.equal(item.categoryParams[index],'57');
  await s.categoryComics.load('黑暗奇幻','57',[],1);assert.equal(variables.categoryId[0],'57');
  s.list=async()=>({comics:[]});assert.deepEqual((await s.explore[0].load()).map(part=>part.title),['最近更新','本月热门','人气漫画']);
 }
 {
  const {instance:s,requests}=source('manwa');s.page=async path=>{requests.push(path);return{base:'https://manwark.cc',html:''};};
  await s.categoryComics.load('韩国','area:2',['','2','newest','0'],2);
  let u=new URL('https://manwark.cc'+requests.pop());assert.equal(u.searchParams.get('area'),'2');assert.equal(u.searchParams.get('end'),'2');assert.equal(u.searchParams.get('gender'),'0');assert.equal(u.searchParams.get('sort'),'2');assert.equal(u.searchParams.get('page'),'2');
  await s.categoryComics.load('全彩','全彩',[],1);u=new URL('https://manwark.cc'+requests.pop());assert.equal(u.searchParams.get('tag'),'全彩');assert.equal(u.searchParams.get('gender'),'-1');
 }
 {
  const {instance:s}=source('mheee');s.list=async()=>({comics:[]});assert.deepEqual((await s.explore[0].load()).map(part=>part.title),['最近更新','最高评分']);
 }
 {
  class HomeDocument{
   querySelectorAll(selector){if(selector!=="a[href*='/cn/comics/']")return[];return Array.from({length:18},(_,i)=>({attributes:{href:'/cn/comics/'+(i+1)},querySelector:part=>part==='img'?{attributes:{src:'https://biccam.com/comics/'+(i+1)+'.jpg',alt:'Book '+(i+1)}}:null}));}
   dispose(){}
  }
  const {instance:s,requests}=source('mycomic',HomeDocument),parts=await s.explore[0].load();
  assert.deepEqual(parts.map(part=>part.title),['首页精选','推荐给你','最近更新','最新上架']);
  assert.equal(parts[0].comics[0].id,'1');assert.equal(parts[1].comics[0].id,'13');assert.equal(requests.length,3);
  s.originalExplore[0].load=async()=>{throw new Error('listing blocked');};
  assert.deepEqual((await s.explore[0].load()).map(part=>part.title),['首页精选','推荐给你','最近更新']);
 }
 console.log('PASS: '+all.length+' single discovery pages; no common groups; Komiic taxonomy and discovery; Manwa filters; category mapping and pagination.');
})().catch(e=>{console.error(e);process.exitCode=1;});

