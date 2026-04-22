# Tomato Publisher 🍅

> 基于MCP协议的番茄小说发布工具，支持CLI模式调用与AI系统集成

## 功能特性
- ✅ 番茄小说平台API封装
- ✅ MCP 2.0协议支持（供AI系统调用）
- ✅ 命令行工具支持本地调试
- ✅ 多账号管理与内容审核

## 安装
```bash
# 需要Node.js 18+ 和 pnpm
pnpm install -g @ai-novel/tomato-publisher
```

## 使用方法
### CLI模式
```bash
tomato-cli publish --content "小说内容" --title "章节标题"
```

### MCP集成
1. 启动MCP服务：`node mcp-servers/index.js`
2. 通过HTTP接口 `/mcp/v1/publish` 进行内容发布

## 开发指南
请参考[CONTRIBUTING.md](CONTRIBUTING.md)获取贡献指南