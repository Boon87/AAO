# STATUS · AAO 竞品分析工具（一页断点卡,≤80行）

> 更新:2026-07-08 · 最新提交:`2abdd06` · 规则见根目录 `AGENTS.md`(resume-rules 段)

## 这是什么
AAO 竞品分析 / 选品工具(Next.js + Supabase),五平台比价 + 1688 反爬已通,含商家版(爆款榜 + 成本定价)+ chrome-extension 目录。
里程碑 tag:`v1.0-complete`(五平台全通)、`v1.1-merchant`(商家版)。全套部件说明在 `SETUP-AND-MIGRATION.md`(大文件,按需 Grep,别整读)。

## 账号链(ds 切 Boon87 = 一条龙)
GitHub `Boon87/AAO` · Vercel/Supabase 用 GitHub 登录 · 本仓库 git user.email = `gheeboonting@gmail.com`(已设,勿改)。
秘密文件:`.env.local`(不在 git 里,换电脑手动搬)。

## 最近做了什么(2026-07 上旬,另一台电脑)
- 选品工具 1-2:竞争饱和度 + 到岸净利计算器(`59fcc3a`)
- 选品清单 Watchlist + 趋势复查(`89dc567`);爆款评论挖掘 → 改良款角度(`05ff214`)
- Supabase 睡着时 middleware 优雅降级,不再裸 504(`2abdd06`)

## 下一步
- 待用户指派;版本回退用 `git checkout <tag>`。
- aao-extension-LATEST(浏览器插件独立版)**还没上 GitHub** —— 要用时先 git init + 推到 Boon87(见桌面《项目搬家说明书》第4章B)。

## 坑
- 本项目 Vercel 认 `gheeboonting@gmail.com`(和 LifeOS 相反!LifeOS 要 hotmail)。commit 邮箱错了部署会 BLOCKED 假死。
- 别在 OneDrive 旧目录(`Coding Assignment 1 - AAO`)干活,git 会卡死;那里只当历史备份。
