const fs = require('fs'), vm = require('vm'), assert = require('assert');
const code = fs.readFileSync(require('path').join(__dirname, '../sources/baozi.js'), 'utf8');
function make(platform, session, manual) {
  const requests = [];
  class ComicSource {
    loadSetting(key) { return key === 'browserUA' ? manual : undefined; }
    loadData(key) { return key === '_webviewSession' ? session : undefined; }
  }
  const Network = {get: async (url, headers) => {
    requests.push({url, headers});
    return {status: 200, body: '<div class="comics-card">example</div>'};
  }};
  const context = vm.createContext({ComicSource, Network, APP:{platform}, UI:{}});
  return {source: vm.runInContext(code + ';new Baozi()', context), requests, Network};
}
(async () => {
  for (const platform of ['android', 'windows']) {
    const ua = platform + ' actual WebView';
    const {source:s, requests, Network} = make(platform, {
      origin:'https://www.baozimh.com', platform, userAgent:ua
    });
    await s.getChecked('https://www.baozimh.com/classify');
    assert.equal(requests[0].headers['User-Agent'], ua);
    assert.equal(requests[0].headers['cache-time'], 'no');
    await s.getChecked('https://appcn.baozimh.com/chapter');
    assert.equal(requests[1].headers['User-Agent'], undefined);
    const check = s.account.loginWithWebview.checkStatus;
    for (const path of ['/', '/classify?type=all', '/user/my_bookshelf']) {
      assert(check('https://www.baozimh.com' + path, '分類 - 包子漫畫'));
    }
    for (const title of ['正在验证浏览器', 'Just a moment', '登录 - 包子漫画', '']) {
      assert(!check('https://www.baozimh.com/classify', title));
    }
    for (const url of ['https://www.baozimh.com.evil.test/', 'http://www.baozimh.com/', 'https://www.baozimh.com/user/login']) {
      assert(!check(url, '包子漫画'));
    }
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
  console.log('PASS: Android/Windows session UA, legacy UA migration, origin isolation, verification completion and challenge rejection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
