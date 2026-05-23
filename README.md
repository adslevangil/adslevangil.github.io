# Eason Game

个人 GitHub Pages 站点源码，对应域名：[www.easongame.com](https://www.easongame.com)。

## 当前内容

- 首页作品入口：`index.html`
- 虚界之心独立设定页：`xujiezhixin.html`
- 鬼畜修仙传大世界地图：`guichu-xiuxian-map.html`
- 躲避小游戏：`game.html`
- LaLaLaBuy 购物灵感项目：`lalalabuy/`
- 项目素材资源：`assets/projects/`

## 技术栈

- 纯静态 HTML / CSS / JavaScript
- GitHub Pages 部署
- 自定义域名通过 `CNAME` 配置

## 本地预览

在仓库根目录启动一个静态文件服务即可，例如：

```powershell
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 维护约定

- 首页项目卡片由 `index.html` 里的 `projects` 数组驱动，新增项目时优先补配置而不是复制整块 HTML。
- 图片素材统一放在 `assets/projects/`，方便后续继续扩展新的概念页和封面。
- 页面目前不依赖构建工具，适合快速发布单页原型。

## 下一步建议

- 给“虚界之心”和“巴比伦”补独立介绍页，替换首页的开发中占位状态。
- 为地图页增加剧情入口、区域筛选或城市事件。
- 继续扩展小游戏，例如增加音效、排行榜或第二关卡。
