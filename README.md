# github-connector

**面向 GitHub 仓库操作的 ChatGPT App（MCP connector）**

![version](https://img.shields.io/badge/version-1.0.0-blue) ![platform](https://img.shields.io/badge/platform-Vercel-black) ![built with](https://img.shields.io/badge/built%20with-TypeScript%20%2B%20Express-3178c6) ![auth](https://img.shields.io/badge/auth-OAuth%202.1-green)

[中文](README.md) | [English](README.en.md)

列出文件、读取文件、创建/更新文件、管理 issue、管理 pull request —— 每个 ChatGPT 使用者用自己的 GitHub 账号登录授权。

## 部署步骤

1. `npm install`
2. 复制 `.env.example` 为 `.env` 并填写：
   - `GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET`（来自一个 GitHub OAuth App：github.com → Settings → Developer settings → OAuth Apps）。
   - `MCP_ISSUER_URL` —— 本服务自身的公网 base URL（必须和 OAuth App 的回调地址域名 + `/callback` 一致）。
   - `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` —— Upstash Redis 凭证（通过 Vercel Marketplace 集成添加；请核对实际注入的变量名）。
3. `npm run build` 做类型检查。
4. `npm test` 跑单元测试。
5. 部署到 Vercel；把 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`MCP_ISSUER_URL`、`KV_REST_API_URL`、`KV_REST_API_TOKEN` 设置为 Vercel 项目环境变量。
6. 在 ChatGPT 中配置 connector，Server URL 填 `https://<your-deployment>.vercel.app/mcp`，Authentication 选 **OAuth**。ChatGPT 会通过服务端的 `.well-known` 元数据自动发现授权端点，无需手动配置任何 header。

## 线上部署

- 生产环境：https://github-connector.jason1105.uk/mcp
