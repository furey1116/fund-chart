# 基金净值查询系统

一个基于Next.js开发的基金净值查询和曲线绘制系统，通过天天基金网API获取数据，并使用ECharts展示基金净值走势图。

## 功能特点

- 基金搜索：根据基金代码或名称搜索基金
- 基金详情：显示基金的基本信息和涨幅数据
- 净值曲线：绘制基金净值走势图
- 时间范围选择：支持选择不同时间范围的净值数据
- ETF网格操作：提供ETF基金的网格交易策略和回测
- 基金操作记录：记录用户的基金买入卖出操作
- 数据分析：展示基金与同类平均的对比

## 技术栈

- **前端框架**：Next.js 14
- **UI组件库**：Ant Design 5
- **图表库**：ECharts
- **样式方案**：Tailwind CSS
- **数据请求**：Axios
- **时间处理**：Day.js
- **数据存储**：Vercel Blob / localStorage

## 快速开始

确保已安装Node.js环境（推荐v18或更高版本）。

1. 先运行天天基金API服务

```bash
cd path/to/TiantianFundApi
npm install
npm start
```

2. 启动基金净值查询系统

```bash
cd fund-chart-app
npm install
npm run dev
```

3. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 使用说明

1. 在搜索框中输入基金代码或名称进行搜索
2. 点击搜索结果选择需要查看的基金
3. 系统将自动加载并显示基金详情和净值走势图
4. 使用时间范围选择器可以查看不同时间段的净值数据
5. 点击"ETF网格操作"标签可以设计网格交易策略
6. 点击"基金操作"标签可以记录买入卖出操作

## API文档

系统使用天天基金网的API获取数据，主要包括：

- 基金搜索API
- 基金详情API
- 基金历史净值API
- 基金涨幅数据API

详细API文档请参考：[天天基金网API文档](https://kouchao.github.io/TiantianFundApi/)

## 注意事项

- 本项目需要先启动天天基金API服务才能正常工作
- 默认API服务地址为`http://localhost:3000`，如有不同请修改`src/api/fund.ts`中的`API_BASE_URL`
- 由于天天基金网的限制，部分基金可能无法获取完整的净值数据

## 环境变量配置

本应用支持在不同环境下部署，通过环境变量控制数据存储方式：

1. 在 Vercel 环境中运行时：
   - 使用 Vercel Blob 存储服务记录基金操作数据
   - 需要配置 `BLOB_READ_WRITE_TOKEN` 环境变量
   
2. 在本地环境中运行时：
   - 默认使用浏览器 localStorage 存储数据
   - 不需要额外配置

### Vercel 环境配置

如果在 Vercel 上部署，请在 Vercel 项目设置中添加以下环境变量：

```
BLOB_READ_WRITE_TOKEN=你的Vercel Blob令牌
```

> 注意: 在 Vercel 平台部署时，请确保在 Vercel 项目的环境变量设置中添加此变量，而不只是在 .env 文件中设置。

可以通过以下命令生成新的 Blob 令牌：

```bash
npx vercel blob generate-read-write-token
```

### 本地环境配置

本地开发不需要特殊配置，应用会自动检测并使用 localStorage 作为存储。

## 基金操作功能使用说明

本应用增加了基金操作记录功能，允许用户记录自己的基金买卖操作：

1. 在搜索并查看基金后，点击"基金操作"标签
2. 可以看到当前持仓摘要，包括持有份额和市值
3. 填写操作表单记录买入或卖出操作
4. 操作记录会显示在底部的表格中

操作记录数据会根据部署环境不同存储在：
- Vercel 环境：Vercel Blob 存储服务中
- 本地环境：浏览器 localStorage 中 