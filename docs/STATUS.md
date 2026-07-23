# STATUS · AAO 竞品分析工具（一页断点卡,≤80行）

> 更新:2026-07-23 · 最新提交:`389979f` · 规则见根目录 `AGENTS.md`(resume-rules 段)

## 这是什么
AAO 竞品分析 / 选品工具(Next.js + Supabase),五平台比价 + 1688 反爬已通,含商家版(爆款榜 + 成本定价)+ chrome-extension 目录。
里程碑 tag:`v1.0-complete`(五平台全通)、`v1.1-merchant`(商家版)。全套部件说明在 `SETUP-AND-MIGRATION.md`(大文件,按需 Grep,别整读)。

## 账号链(ds 切 Boon87 = 一条龙)
GitHub `Boon87/AAO` · Vercel/Supabase 用 GitHub 登录 · 本仓库 git user.email = `gheeboonting@gmail.com`(已设,勿改)。
秘密文件:`.env.local`(不在 git 里,换电脑手动搬)。

## 选品功能全家福(1-5 已齐)
1-2 竞争饱和度(结果页) + 到岸净利计算器(compare 页) · 3 Watchlist 趋势复查 · 4 爆款评论挖掘 → 改良款角度 ·
5 **机会分**:Watchlist 每个候选品 0-100 分 + A/B/C/D 排序(`src/lib/opportunity-score.ts`,纯本地算,复查越多越准)。

## 最近做了什么(2026-07-23)
- 插件独立版已上 GitHub:**`Boon87/aao-extension`**(私有),本地新家 `C:\Coding\aao-extension`(OneDrive 那份只当备份)。
- Feature 5 机会分上线(`389979f`)。

## 下一步
- 待用户指派;版本回退用 `git checkout <tag>`。
- 顺手活(不急):Next.js 16 提示 `middleware.ts` 约定弃用,要改名 `proxy`(见 nextjs.org/docs/messages/middleware-to-proxy)。

## 坑
- 本项目 Vercel 认 `gheeboonting@gmail.com`(和 LifeOS 相反!LifeOS 要 hotmail)。commit 邮箱错了部署会 BLOCKED 假死。
- 别在 OneDrive 旧目录(`Coding Assignment 1 - AAO`)干活,git 会卡死;那里只当历史备份。
