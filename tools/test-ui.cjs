// Source contract regressions. No account, network, browser or comic payload required.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
function source(file){
 const requests=[],code=fs.readFileSync(root+'/sources/'+file+'.js','utf8');
 class ComicSource{loadSetting(){}loadData(){}saveData(){}deleteData(){}}
 class EmptyDocument{querySelectorAll(){return [];}querySelector(){return null;}dispose(){}}
 const Network={get:async url=>{requests.push(url);return{status:200,body:file==='baozi'?'"unused"':'<html></html>'};},getCookies:()=>[]};
 const context=vm.createContext({ComicSource,Comic:class{constructor(o){Object.assign(this,o);}},ComicDetails:class{},HtmlDocument:EmptyDocument,Network,UI:{},console});
 const name=code.match(/class\s+(\w+)\s+extends ComicSource/)[1],instance=vm.runInContext(code+';new '+name+'()',context);
 return{instance,requests};
}
(async()=>{
 const all=JSON.parse(fs.readFileSync(root+'/all.json','utf8'));
 for(const item of all){const {instance:s}=source(path.basename(item.fileName,'.js'));assert.equal(s.explore.length,1);assert.equal(s.explore[0].type,'multiPartPage');assert.equal(s.explore[0].title,item.name);assert.equal(s.category.title,item.name);for(const p of s.category.parts)assert.equal(p.categories.length,p.categoryParams.length);}
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
 }
 console.log('PASS: 8 single discovery pages; category mapping; combined filters preserve genre/region/status/year; real pagination sizes; completed query; ranking boundary.');
})().catch(e=>{console.error(e);process.exitCode=1;});
