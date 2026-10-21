const fs = require('fs'), vm = require('vm'), assert = require('assert');
const code = fs.readFileSync(require('path').join(__dirname, '../sources/baozi.js'), 'utf8');
function make(platform, session, manual, host='www.baozimh.com') {
  const requests = [];
  const data = {_webviewSession:session, settings:host?{loginHost:host}:{}}, messages=[];
  let construction=true;
  class ComicSource {
    loadSetting(key) {
      if(construction) throw new Error('Bad state: Setting not found: '+key);
      return key === 'browserUA' ? manual : key === 'loginHost' ? host : undefined;
    }
    loadData(key) { return data[key]; }
    saveData(key, value) { data[key]=value; }
    deleteData(key) { delete data[key]; }
  }
  const Network = {getCookies:()=>[], get: async (url, headers) => {
    requests.push({url, headers});
    return {status: 200, body: '<div class="comics-card">example</div>'};
  }};
  const context = vm.createContext({ComicSource, Network, APP:{platform}, UI:{showMessage: message => messages.push(message)}});
  const source=vm.runInContext(code + ';new Baozi()', context);
  // VeneraNext parses account URLs before registering the new settings schema.
  // SourceConstructionReads permits data snapshots but settings may be absent.
  const parsedLoginUrl=source.account.loginWithWebview.url;
  assert(parsedLoginUrl.endsWith('/user/my_bookshelf'));
  construction=false;
  return {source, requests, Network, data, messages};
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
      await assert.rejects(s.checkWebsiteAccount(), /网站账号尚未同步/);
      assert.equal(messages.length, 0);
    }
    Network.get = async () => {throw new Error('connection timeout');};
    await assert.rejects(s.checkWebsiteAccount(), /connection timeout/);
    // Saving the captured browser session must not wait for a new app HTTP
    // request, which may be blocked on the direct route.
    success();
    assert.equal(messages.length, 1);
    for (const body of ['<a href="/user/logout">退出登录</a>', '<button><span>登出</span></button>', '<a>修改密碼</a>']) {
      Network.get = async () => ({status:200, body});
      await s.checkWebsiteAccount();
    }
    assert.equal(messages.length, 1);
    Network.get = async () => ({status:200, body:'<title>Just a moment</title>'});
    await assert.rejects(s.getChecked(s.baseUrl), /被拦截/);
    Network.get = async () => ({status:403, body:'Forbidden'});
    await assert.rejects(s.getChecked(s.baseUrl), /被拦截/);
  }
  const {source:legacy} = make('android');
  assert.equal(make('android', null, legacy.legacyBrowserUA).source.browserUA, '');
  assert.equal(make('android', {origin:legacy.baseUrl, platform:'windows', userAgent:'wrong'}).source.browserUA, '');
  assert.equal(make('windows', {origin:'https://other.test', platform:'windows', userAgent:'wrong'}).source.browserUA, '');
  assert.equal(make('windows', null, 'actual manual UA').source.browserUA, 'actual manual UA');
  for (const platform of ['android', 'windows']) {
    for (const host of ['cn.bzmgcn.com', 'www.baozimh.com']) {
      const origin='https://'+host;
      const {source:s, data, requests, Network, messages}=make(platform, {origin, platform, userAgent:platform+' UA'}, undefined, host);
      assert.equal(s.baseUrl, origin);
      assert.equal(s.account.loginWithWebview.url, origin+'/user/my_bookshelf');
      const check=s.account.loginWithWebview.checkStatus;
      for (const title of ['我的书架 - 包子漫画','我的書架 - 包子漫畫']) {
        assert(check(origin+'/user/my_bookshelf?tab=all',title));
        assert.equal(data._baoziWebLogin.origin,origin);
      }
      for (const url of [origin+'.evil.test/user/my_bookshelf','http://'+host+'/user/my_bookshelf',origin+'/user/signin',origin+'/classify',origin+'/user/my_bookshelf-extra']) {
        assert(!check(url,'我的书架 - 包子漫画'));
        assert.equal(data._baoziWebLogin.origin,origin);
      }
      await s.getChecked(s.baseUrl+'/search?q=test');
      assert.equal(requests.at(-1).headers.Referer,origin+'/');
      assert.equal(requests.at(-1).headers['User-Agent'],platform+' UA');
      const redirected=host==='cn.bzmgcn.com'?'https://www.baozimh.com':'https://cn.bzmgcn.com';
      assert(check(redirected+'/user/my_bookshelf','我的书架 - 包子漫画'));
      assert.equal(s.baseUrl,redirected);
      assert.equal(s.browserUA,''); // UA from the previous origin is not reused.
      await s.getChecked(s.baseUrl+'/search?q=test');
      assert.equal(requests.at(-1).url,redirected+'/search?q=test');
      assert.equal(requests.at(-1).headers.Referer,redirected+'/');
      const stale=make(platform,undefined,undefined,host);
      stale.data._baoziWebLogin={origin:redirected,entryHost:'different-entry'};
      assert.equal(stale.source.baseUrl,origin);
      stale.data._baoziWebLogin={origin:'https://evil.test',entryHost:host};
      assert.equal(stale.source.baseUrl,origin);
      Network.getCookies=()=>[
        {name:'TSID',value:'test-only-account-value'},
        {name:'__Host-gk_browser_test',value:'test-only-browser-value'},
        {name:'__Host-gk_clearance_test',value:'test-only-clearance-value'}
      ];
      s.settings.savedSession.callback();
      assert(messages.at(-1).includes('账号 Cookie：已保存'));
      assert(messages.at(-1).includes('验证 Cookie：已保存'));
      assert(!messages.at(-1).includes('test-only-'));
    }
  }
  assert.equal(make('android',undefined,undefined,null).source.baseUrl,'https://cn.bzmgcn.com');
  const upgrade=make('windows',undefined,undefined,null);
  upgrade.data.settings={domains:'baozimh.com',language:'cn'};
  assert.equal(upgrade.source.account.loginWithWebview.url,'https://cn.bzmgcn.com/user/my_bookshelf');
  upgrade.data.settings.loginHost='www.baozimh.com';
  assert.equal(upgrade.source.account.loginWithWebview.url,'https://www.baozimh.com/user/my_bookshelf');
  upgrade.data.settings.loginHost='evil.test';
  assert.equal(upgrade.source.account.loginWithWebview.url,'https://cn.bzmgcn.com/user/my_bookshelf');
  console.log('PASS: first-install/upgrade schema construction, Android/Windows landing capture, same-origin requests, nonblocking return, cookie status privacy and challenge rejection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
