const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'..');const lists=['index.json','optional.json','all.json'];
const all=JSON.parse(fs.readFileSync(root+'/all.json','utf8'));
assert.equal(all.length,8);assert.equal(new Set(all.map(e=>e.key)).size,8);
for(const list of lists){const items=JSON.parse(fs.readFileSync(root+'/'+list,'utf8'));assert(Array.isArray(items));for(const item of items){
 assert(/^\w+$/.test(item.key));assert(/^\d+\.\d+\.\d+$/.test(item.version));
 const code=fs.readFileSync(root+'/'+item.fileName,'utf8');new vm.Script(code,{filename:item.fileName});
 const pos=code.search(/class\s+\w+\s+extends\s+ComicSource/);assert(pos>=0);const body=code.slice(pos);
 for(const [field,value]of [['name',item.name],['key',item.key],['version',item.version],['url',item.url]]){
 const match=body.match(new RegExp('\\b'+field+'\\s*=\\s*([\"\'])'+'([^\"\']*)'+'\\1'));assert(match&&match[2]===value,item.fileName+': '+field);
 }
 assert(item.url==='https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/'+item.fileName);
 assert(!/C:[\\/]|PHPSESSID=[a-zA-Z0-9]{8}|github_pat_|ghp_[a-zA-Z0-9]{20}/.test(code),'Unexpected private data');
}}
assert.equal(JSON.parse(fs.readFileSync(root+'/index.json')).length,5);assert.equal(JSON.parse(fs.readFileSync(root+'/optional.json')).length,3);
console.log('PASS: 8 scripts, 3 catalogs, metadata/update URLs aligned, unique keys, syntax valid.');
