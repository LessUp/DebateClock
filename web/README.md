# 辩论赛计时器（React 版）

基于 Vite + React + TypeScript + TailwindCSS + Zustand 的现代前端实现，功能完整、易于扩展与开源协作。

## 开发

1. 安装依赖

```bash
pnpm i # 或 npm i / yarn
```

2. 启动开发服务器

```bash
pnpm dev # 访问 http://localhost:5173
```

3. 构建与预览

```bash
pnpm build
pnpm preview
```

## 功能

- 阶段管理：添加、删除、编辑、上移/下移、点击切换
- 计时控制：开始/暂停、上一/下一、重置、+/-10 秒
- 多预警点：任意配置（逗号分隔），到时自动提示音
- 静音开关：禁用提示音
- 自动切换：到 0 后自动跳到下一阶段
- 导入/导出：JSON 文件（包含阶段与设置）
- 本地持久化：浏览器 LocalStorage
- 全屏：展示用大屏模式
- 快捷键：空格、←/→、+/-、R、F、M

## 目录结构

- `src/store.ts`：Zustand 状态管理与持久化
- `src/App.tsx`：界面与交互
- `src/utils/time.ts`：时间格式化工具
- `index.html`：入口页面

## 数据格式

导出 JSON 示例：

```json
{
  "schema": "debate-timer/v1",
  "stages": [
    { "id": "abc123", "name": "正方立论", "seconds": 180 }
  ],
  "settings": {
    "beepEnabled": true,
    "warnSeconds": [60, 30],
    "autoAdvance": false
  }
}
```

## 许可

本仓库使用 MIT 协议，详见根目录 `LICENSE`。
