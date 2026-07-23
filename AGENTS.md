<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:resume-rules -->
# Claude 工作规则（三台电脑通用，2026-07-08 起）

1. ⚡ **新会话第一步（也是唯一一步）：只读 [`docs/STATUS.md`](docs/STATUS.md)**（一页断点卡），读完即可开工。
2. ⛔ 没有当前任务明确需要，**不要**整读 `SETUP-AND-MIGRATION.md` / 扫目录 / 开大文件 —— 会烧爆 token。深挖用 Grep 搜关键词。
3. 开工先 `git pull`；用户说「**收尾**」= 更新 `docs/STATUS.md`（**保持 ≤80 行**，只写"现在"，不写历史 —— 历史看 `git log`）+ commit + push。
4. **本仓库身份（勿改）**：`git config user.email` = `gheeboonting@gmail.com`；GitHub / Vercel / Supabase 全链 = **Boon87** 账号（`ds` 先切）。生产部署要用户明确说「确认部署」。
5. 正宗工作区 = **`C:\Coding\aao-price-tool`**（三台电脑同一路径）。OneDrive 只放 zip 备份，**不在 OneDrive 里干活**（会锁 .git、卡 git status）。
<!-- END:resume-rules -->
