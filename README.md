# 辩论赛计时器

本仓库包含两套实现：

- 静态版（零依赖，直接打开浏览器使用）
- React 现代版（Vite + React + TypeScript + Tailwind + Zustand）

---

## 静态版（零依赖）

- 直接打开：双击根目录 `index.html` 用浏览器打开即可。
- 或本地服务器（可选）：在项目目录运行 `python3 -m http.server 8080`，浏览器访问 `http://localhost:8080/`。

功能：阶段管理、计时控制、提示音、快捷键、本地存储、多预警点、导入导出、全屏等。

---

## React 现代版（web/）

- 位置：`web/`
- 技术：Vite + React + TypeScript + TailwindCSS + Zustand
- 功能：覆盖静态版所有能力，并更易扩展与维护。

开发：

```bash
# 进入 web 目录后安装依赖（任选其一）
# pnpm i   |  yarn   |  npm i

# 启动开发服务器（默认 5173 端口）
pnpm dev

# 构建与本地预览
pnpm build
pnpm preview
```

> 注：若本机没有 Node，请先安装（nvm/Node.js LTS/或 brew）。

---

## 开源与工程化

- 协议：MIT（见 `LICENSE`）
- 代码规范：提供 ESLint + Prettier 配置（web/）
- CI：GitHub Actions（Node + pnpm 构建与测试）
- 测试：Vitest（示例位于 `web/src/utils/time.test.ts`）
- 预设：示例 JSON 位于 `web/presets/standard.json`

---

## 目录结构（关键）

- 静态版：`index.html`, `app.js`, `README.md`
- 现代版：`web/`（`src/`: `App.tsx`, `store.ts`, `utils/`）
- 工程化：`.github/workflows/ci.yml`, `.editorconfig`, `LICENSE`, `.gitignore`

---

## 反馈与定制

如需适配特定赛制（阶段/时长/多预警点/到时策略/展示屏样式/远程控制等），欢迎提交 Issue 或 PR。
