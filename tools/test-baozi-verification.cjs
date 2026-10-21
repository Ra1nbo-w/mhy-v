const fs = require('fs'), vm = require('vm'), assert = require('assert');
const code = fs.readFileSync(require('path').join(__dirname, '../sources/baozi.js'), 'utf8');
function make(platform, session, manual) {
  const requests = [];
  const data = {_webviewSession:session}, messages=[];
  class ComicSource {
    loadSetting(key) { return key === 'browserUA' ? manual : undefined; }
    loadData(key) { return data[key]; }
    saveData(key, value) { data[key]=value; }
    deleteData(key) { delete data[key]; }
  }
  const Network = {get: async (url, headers) => {
    requests.push({url, headers});
    return {status: 200, body: '<div class="comics-card">example</div>'};
  }};
  const context = vm.createContext({ComicSource, Network, APP:{platform}, UI:{showMessage: message => messages.push(message)}});
  return {source: vm.runInContext(code + ';new Baozi()', context), requests, Network, data, messages};
}
(async () => {
  for (const platform of ['android', 'windows']) {
    const ua = platform + ' actual WebView';
    const {source:s, requests, Network, data, messages} = make(platform, {
      origin:'https://www.baozimh.com', platform, userAgent:ua
    });
    await s.getChecked('https://www.baozimh.com/classify');
    assert.equal(requests[0].headers['User-Agent'], ua);
    assert.equal(requests[0].headers['cache-time'], 'no');
    await s.getChecked('https://appcn.baozimh.com/chapter');
    assert.equal(requests[1].headers['User-Agent'], undefined);
    const check = s.account.loginWithWebview.checkStatus;
    assert.equal(s.account.loginWithWebview.url, s.baseUrl+'/user/my_bookshelf');
    for (const path of ['/user/my_bookshelf', '/user/my_bookshelf/?page=1#books']) {
      assert(check('https://www.baozimh.com' + path, '我的書架 - 包子漫畫'));
    }
    for (const title of ['正在验证浏览器', 'Just a moment', '登录 - 包子漫画', '']) {
      assert(!check('https://www.baozimh.com/user/my_bookshelf', title));
    }
    for (const url of ['https://www.baozimh.com.evil.test/user/my_bookshelf', 'http://www.baozimh.com/user/my_bookshelf', 'https://www.baozimh.com/user/login', 'https://www.baozimh.com/', 'https://www.baozimh.com/classify']) {
      assert(!check(url, '我的书架 - 包子漫画'));
    }
    assert(!check(s.baseUrl+'/user/my_bookshelf', '分类 - 包子漫画'));
    const success = s.account.loginWithWebview.onLoginSuccess;
    for (const body of [
      '<title>分类 - 包子漫画</title><div class="comics-card"></div>',
      '<title>我的书架 - 包子漫画</title><script>const text="退出登录";</script>',
      '<!-- <a>登出</a> --><p>退出登录</p><a>登录</a>',
      '<a>说明</a>退出登录<a>首页</a>',
      '<input type="password"><button>退出登录</button>',
    ]) {
      Network.get = async () => ({status:200, body});
      data.account='ok';
      await assert.rejects(success(), /网站账号尚未同步/);
      assert.equal(data.account, undefined);
      assert.equal(messages.length, 0);
    }
    Network.get = async () => {throw new Error('connection timeout');};
    data.account='ok';
    await assert.rejects(success(), /connection timeout/);
    assert.equal(data.account, undefined);
    for (const body of ['<a href="/user/logout">退出登录</a>', '<button><span>登出</span></button>', '<a>修改密碼</a>']) {
      Network.get = async () => ({status:200, body});
      data.account='ok';
      await success();
      assert.equal(data.account, 'ok');
    }
    assert.equal(messages.length, 3);
    Network.get = async () => ({status:200, body:'<title>Just a moment</title>'});
    await assert.rejects(s.getChecked(s.baseUrl), /网页会话尚未通过/);
    Network.get = async () => ({status:403, body:'Forbidden'});
    await assert.rejects(s.getChecked(s.baseUrl), /网页会话尚未通过/);
  }
  const {source:legacy} = make('android');
  assert.equal(make('android', null, legacy.legacyBrowserUA).source.browserUA, '');
  assert.equal(make('android', {origin:legacy.baseUrl, platform:'windows', userAgent:'wrong'}).source.browserUA, '');
  assert.equal(make('windows', {origin:'https://other.test', platform:'windows', userAgent:'wrong'}).source.browserUA, '');
  assert.equal(make('windows', null, 'actual manual UA').source.browserUA, 'actual manual UA');
  console.log('PASS: Android/Windows session UA, account vs public pages, failed login rollback, authenticated bookshelf, origin isolation and challenge rejection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
