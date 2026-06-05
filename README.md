# Mingxiang Yang Blog

个人技术博客与 AI 工程师个人网站，基于 Hexo + Butterfly 构建。

站点地址：https://yang-mingxiang.github.io

## 本地开发

```bash
npm install
npm run server
```

默认本地预览地址：

```text
http://localhost:4000
```

## 构建

```bash
npm run build
```

## 内容目录

- `source/_posts/`：博客文章
- `source/about/`：关于我页面
- `source/projects/`：项目展示页面
- `_config.yml`：Hexo 主配置
- `_config.butterfly.yml`：Butterfly 主题配置

## 评论系统

评论系统预留为 Giscus。需要在 https://giscus.app 生成：

- `repo_id`
- `category_id`

然后填入 `_config.butterfly.yml` 的 `giscus` 配置。
