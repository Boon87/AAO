# ⚡ RESUME — 断点续接卡（新会话只读这一页就能开工）

> 🔄 **换机 / 新会话开工——用户只需说「继续」。收到后 Claude 先自动做完这套，不用用户碰 git：**
> ① `git fetch --all --prune` → ② 确认在 `main`（本项目只有一条分支；不在就 `git checkout main`）→ ③ `git pull` → ④ 再从本卡「下一步」继续。
> **收工只需说「收尾」**：Claude 更新本卡（当前状态/下一步，**保持 ≤80 行**，只写"现在"——历史看 `git log`）+ `git commit` + `git push`（GitHub 是三机主同步）。
> ⚠️ 若 `git pull` 报「未提交改动」= 这台机有没「收尾」的活，先说「收尾」处理掉，别硬拉。**用户全程零 git。**

> **给 Claude 的硬性纪律：读完本卡即可开工，不要再读任何其它文件。**
> ⛔ 禁止整读 `SETUP-AND-MIGRATION.md`（大文件）/ 扫目录 / 开大文件——需要细节只用 Grep 搜关键词。

## 这是什么

AAO 竞品分析 / 选品工具（Next.js + Supabase）：五平台比价 + 1688 反爬已通，含商家版（爆款榜 + 成本定价）。
里程碑 tag：`v1.0-complete`（五平台全通）、`v1.1-merchant`（商家版）。

## 当前状态（2026-07-26）

- **选品功能 1-5 全齐**：1-2 竞争饱和度（结果页）+ 到岸净利计算器（compare 页）· 3 Watchlist 趋势复查 · 4 爆款评论挖掘 → 改良款角度 · 5 机会分（Watchlist 候选品 0-100 分 + A/B/C/D 排序，`src/lib/opportunity-score.ts`，纯本地算，复查越多越准）。
- **插件独立版已上 GitHub**：`Boon87/aao-extension`（私有），本地新家 `C:\Coding\aao-extension`（OneDrive 那份只当备份）。
- Supabase 睡着时 middleware 优雅降级，不再裸 504。

## 下一步

- 待用户指派；版本回退用 `git checkout <tag>`。

## 环境速查（事实，不用再翻别处）

| 项 | 值 |
|---|---|
| 分支 | 只有 `main`（无 feature 分支流程） |
| 生产域名 | `aao-price-tool.vercel.app` |
| 账号链 | GitHub `Boon87/AAO` · Vercel/Supabase 用 GitHub 登录 = **Boon87**（`ds` 先切）|
| git 邮箱 | `gheeboonting@gmail.com`（已设，勿改）|
| Supabase 项目 | `bcgjpxfrhcnqwowdzach` |
| 秘密文件 | `.env.local`（不在 git 里，换电脑手动搬）：ANTHROPIC_API_KEY / Supabase 三件 / SHOPEE_* 六件 cookie |
| 插件仓库 | `Boon87/aao-extension`（私有）→ 本地 `C:\Coding\aao-extension` |

## 操作铁律

1. commit 邮箱必须是 `gheeboonting@gmail.com`——错了 Vercel 部署会 BLOCKED 假死（**和 LifeOS 相反**！LifeOS 要 hotmail）。
2. 生产部署要用户明确说「确认部署」。
3. 别在 OneDrive 旧目录（`Coding Assignment 1 - AAO`）干活，git 会卡死；那里只当历史备份。正宗工作区 = `C:\Coding\aao-price-tool`（三台电脑同一路径）。
4. 改代码必须 `npx tsc --noEmit` + `npm run build` 过再提交；commit 尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
5. PowerShell 5.1：没有 `&&`，用 `if ($?)`；`curl` 要用 `curl.exe`。

## 遗留小事（不急，遇到再办）

- Next.js 16 提示 `middleware.ts` 约定弃用 → 要改名 `proxy`（nextjs.org/docs/messages/middleware-to-proxy）。
- 本机 `.env.local` 没有 `GEMINI_API_KEY`——本地跑 super-analyze 会直接走 Claude 兜底（生产在 Vercel env 里有）。

## 需要深挖时的地图（先 Grep，别整读）

- 全套部件/搭建/迁移 → `SETUP-AND-MIGRATION.md`（按关键词 Grep）
- 历史（做过什么/为什么）→ `git log --oneline`
- 换电脑/搬家流程 → OneDrive `Desktop\Coding\Coding Assignment 2 - Grace\项目搬家说明书\`
