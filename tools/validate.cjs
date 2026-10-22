const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const RAW = "https://raw.githubusercontent.com/Ra1nbo-w/mhy-v/main/";
const PRIVATE = /C:[\\/]|PHPSESSID=[a-zA-Z0-9]{8}|github_pat_|ghp_[a-zA-Z0-9]{20}/;

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));

// 仓库只对外提供一个索引入口，所有源都在 index.json 里；all.json 保留为同内容的兼容别名。
const entries = readJson("index.json");
assert(Array.isArray(entries), "index.json 必须是数组");
assert.equal(
  entries.length,
  fs.readdirSync(path.join(root, "sources")).filter((f) => f.endsWith(".js")).length,
  "index.json 条目数应等于 sources/ 下的脚本数",
);

const all = readJson("all.json");
assert(Array.isArray(all), "all.json 必须是数组");
assert.equal(all.length, entries.length, "all.json 条目数应与 index.json 一致");
assert.deepEqual(all, entries, "all.json 必须与 index.json 完全一致（兼容别名）");

const declared = new Set();
for (const item of entries) {
  const where = item.fileName || item.key;
  assert(/^\w+$/.test(item.key), `${where}: key 只能由字母、数字、下划线组成`);
  assert(/^\d+\.\d+\.\d+$/.test(item.version), `${where}: version 必须是 x.y.z`);
  assert.equal(typeof item.fileName, "string", `${where}: fileName 必填`);
  assert(/^sources\/[\w.-]+\.js$/.test(item.fileName), `${where}: fileName 必须是 sources/ 下的 .js 文件`);
  assert(item.url === RAW + item.fileName, `${where}: url 必须指向 main 分支的同名文件`);
  assert(!declared.has(item.fileName), `${where}: 同一个脚本被重复登记`);
  declared.add(item.fileName);

  const file = path.join(root, item.fileName);
  assert(fs.existsSync(file), `${where}: 脚本不存在`);
  const code = fs.readFileSync(file, "utf8");
  new vm.Script(code, { filename: item.fileName }); // 语法检查

  const pos = code.search(/class\s+\w+\s+extends\s+ComicSource/);
  assert(pos >= 0, `${where}: 找不到 class X extends ComicSource`);
  const body = code.slice(pos);
  for (const [field, value] of [
    ["name", item.name],
    ["key", item.key],
    ["version", item.version],
    ["url", item.url],
  ]) {
    const match = body.match(new RegExp("\\b" + field + "\\s*=\\s*([\"'])([^\"']*)\\1"));
    assert(match && match[2] === value, `${where}: ${field} 与索引不一致`);
  }

  const minApp = body.match(/\bminAppVersion\s*=\s*["']([^"']+)["']/);
  assert(minApp, `${where}: 缺少 minAppVersion`);
  assert(/^\d+\.\d+\.\d+$/.test(minApp[1]), `${where}: minAppVersion 必须是 x.y.z`);

  // 契约要求 tags/chapters 用普通对象、错误用 Error；这两类问题会静默出错，直接拦住。
  assert(!/\bnew\s+Map\s*\(/.test(code), `${where}: 契约不允许用 Map 存 tags/chapters`);
  assert(!/\bthrow\s+["'`]/.test(code), `${where}: 请抛 Error 实例，不要抛字符串`);

  assert(!PRIVATE.test(code), `${where}: 包含本机路径、Cookie 或令牌，禁止提交`);
}

// 反向检查：sources/ 下不允许有未登记的孤儿脚本。
const orphans = fs
  .readdirSync(path.join(root, "sources"))
  .filter((f) => f.endsWith(".js"))
  .map((f) => "sources/" + f)
  .filter((f) => !declared.has(f));
assert.equal(orphans.length, 0, `存在未登记的脚本: ${orphans.join(", ")}`);

console.log(
  `PASS: ${entries.length} scripts, single index.json, ` +
    "metadata/update URLs aligned, unique keys, syntax valid."
);
