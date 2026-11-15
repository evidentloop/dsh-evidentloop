# 网站部署目标

- 正式域名：`https://evidentloop.sanze.dev`。
- 托管：Cloudflare Pages，使用 `sanze.dev` 主站所属账号。
- 构建命令：`node docs/build.mjs`。
- 发布目录：`docs/site/`；生成页的 canonical 与 package homepage 均指向正式域名。

本轮只准备本地内容。Cloudflare 自定义域名绑定、DNS、远端上传及 Release 更新由后续统一发布执行；本地构建成功不代表这些远端步骤已完成。
