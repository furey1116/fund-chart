# 基金净值查询系统

一个基于Next.js开发的基金净值查询和曲线绘制系统，通过天天基金网API获取数据，并使用ECharts展示基金净值走势图。

## 功能特点

- 基金搜索：根据基金代码或名称搜索基金
- 基金详情：显示基金的基本信息和涨幅数据
- 净值曲线：绘制基金净值走势图
- 时间范围选择：支持选择不同时间范围的净值数据
- 数据分析：展示基金与同类平均的对比

## 技术栈

- **前端框架**：Next.js 14
- **UI组件库**：Ant Design 5
- **图表库**：ECharts
- **样式方案**：Tailwind CSS
- **数据请求**：Axios
- **时间处理**：Day.js

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