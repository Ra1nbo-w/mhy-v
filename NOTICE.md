# 来源与修改说明

本仓库整理此前制作的 VeneraNext 漫画源，保留原有源 key。2026-10-20 首次仓库发布时统一版本为 2.1.0，并配置在线更新地址。

- `sources/baozi.js`：基于 [venera-app/venera-configs/baozi.js](https://github.com/venera-app/venera-configs/blob/main/baozi.js) 修改，保留上游站点解析代码，增加同主机网页登录、验证检查和发现页分区。
- `sources/mycomic.js`：基于 [venera-app/venera-configs/mycomic.js](https://github.com/venera-app/venera-configs/blob/main/mycomic.js) 修改，调整发现页、排序选项和多组目录读取。
- `sources/komiic.js`：以网站公开查询和图片票据接口实现；分类 ID 参考 [komiic.js](https://github.com/venera-app/venera-configs/blob/main/komiic.js)。
- 其他源为根据公开站点页面及 VeneraNext 接口编写的适配文件。

上游作者保留其代码权利；这里的来源说明不构成对上游代码的额外许可，也不为整个仓库擅自指定统一许可证。使用或再分发时应核对相应上游授权。

源代码不附带网站账号、固定验证 Cookie、漫画正文或对网站验证成功的保证。
