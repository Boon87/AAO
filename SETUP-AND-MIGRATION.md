# AAO 竞品分析工具 — 完整安装 & 迁移指南

> 这份文档记录了**整个系统的所有部件**,方便:① 以后出问题恢复 ② 换电脑运行 ③ 迁移到另一个账户(如 Boon87-5)。
> 里程碑标签:**`v1.0-complete`**（五平台全通 + 1688 反爬攻克）、**`v1.1-merchant`**（商家版:爆款榜+成本定价）。回到某版本：`git checkout <标签名>`。

---

## 0. ⚠️ 代码放哪里 —— OneDrive 血泪教训（2026-07-08）

**铁律:代码跨电脑靠 GitHub,不靠 OneDrive。**

OneDrive 同步 git 仓库会:云端化搞坏 `.git`（仓库直接报废）、把文件回滚成旧版、生成 `-Boon` 冲突副本。这些全都真实发生过。

| 东西 | 放哪 |
|------|------|
| **本机活代码（git 仓库）** | `C:\Users\User\aao-price-tool`（本地,OneDrive 管不到） |
| **Chrome 加载的扩展** | `C:\Users\User\aao-extension`（本地） |
| **静态备份**（zip、aao-extension-LATEST） | OneDrive ✅（静态文件放 OneDrive 没问题） |

用 Claude Code 时,在 `C:\Users\User\aao-price-tool` 打开项目。旧的 OneDrive `aao-price-tool` 文件夹已退役（里面有告示文件）,可整个删除。

---

## 1. 系统由 4 个部件组成

| 部件 | 位置 | 作用 |
|------|------|------|
| **前端网站** | 本仓库(Next.js 15）→ GitHub `Boon87/AAO` → Vercel 部署 | 界面、搜索编排、AI 推荐、真实性评分 |
| **Chrome 扩展** | 本仓库 `chrome-extension/` 文件夹（运行时从 `C:\Users\User\aao-extension` 加载） | 在后台弹窗里抓取 Shopee/Lazada/淘宝/拼多多/1688 数据 |
| **Supabase** | 项目 ref `bcgjpxfrhcnqwowdzach`（名字叫 *floorpro-quotation*，但这就是 AAO 的真后端） | 员工登录（Auth）。免费版闲置会自动暂停 → 网站 504，需去后台恢复 |
| **Vercel** | 项目 `aao-price-tool` | 托管前端,`main` 分支一推自动部署（1–3 分钟） |

> ⚠️ 前端改动要 `git push` 才会上线;扩展改动只需在 `chrome://extensions` **重载**,不用部署。

---

## 2. 在另一台电脑上运行

### 情况 A:只是「使用」AAO（5 分钟,不需要代码！）

网站跑在 Vercel 云端,新电脑只要装扩展:
1. 把扩展文件夹拷到那台电脑的**本地路径**(如 `C:\Users\<用户名>\aao-extension`,**别放 OneDrive/桌面**)。扩展来源任选:OneDrive 里的 `aao-extension-LATEST`、备份 zip 里的 `chrome-extension/`、或 GitHub 仓库里的 `chrome-extension/`
2. Chrome → `chrome://extensions` → 开「开发者模式」→「加载已解压的扩展程序」→ 选那个本地文件夹
3. 打开 **aao-price-tool.vercel.app** → 用员工账号登录
4. 在 Chrome 里登录 **淘宝、拼多多、1688**（搜索结果多、不易被拦）
5. 完事,直接用

### 情况 B:要在新电脑「开发/改代码」

先装好:[Git](https://git-scm.com/download/win) 和 [Node.js](https://nodejs.org)（都下一步到底即可）,然后:
```bash
# clone 到本地路径,不要 clone 进 OneDrive！
cd C:\Users\<用户名>
git clone https://github.com/Boon87/AAO.git aao-price-tool
cd aao-price-tool
npm install
```
第一次 push 时 Git 会弹出 GitHub 登录窗口,用 **Boon87** 账号登录一次即可。

改完代码的日常循环:`git add -A` → `git commit -m "说明"` → `git push`（Vercel 自动部署）。回到旧电脑先 `git pull` 再继续改 —— 两台电脑永远通过 GitHub 保持同步。
新建 `.env.local`（这个文件不在 git 里,含密钥）,填入 Supabase 的值（去 Supabase 后台 → Project Settings → API 复制）:
```
NEXT_PUBLIC_SUPABASE_URL=https://bcgjpxfrhcnqwowdzach.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<在 Supabase 后台 API 页复制 anon public key>
# 可选（拍照识别用,没有也能用文字搜索）:
# ANTHROPIC_API_KEY=...
# GEMINI_API_KEY=...
```
本地跑:`npm run dev` → 打开 http://localhost:3000

### Chrome 扩展（每台电脑都要装一次）
1. 把仓库里的 `chrome-extension/` 文件夹**复制到一个稳定路径**（别放 OneDrive/桌面 —— OneDrive 会挪动它导致 Chrome 禁用扩展）。推荐:`C:\Users\<你的用户名>\aao-extension`
2. `chrome://extensions` → 开「开发者模式」→「加载已解压的扩展程序」→ 选那个文件夹
3. 用扩展前,在 Chrome 里**登录拼多多**一次(手机号,拼多多要求登录才给搜索结果)

---

## 3. 迁移到另一个账户（例如 Boon87-5）

要换账户,4 个部件都要转。以下是**你本人**要做的（涉及登录/建账户,我无法代做）:

### ① GitHub 仓库
选一种:
- **转移所有权**:`Boon87/AAO` → Settings → 底部 *Transfer ownership* → 转给 `Boon87-5`,或
- **Fork/新建**:用 Boon87-5 登录 GitHub,`git remote set-url origin https://github.com/Boon87-5/AAO.git` 后 `git push`,或
- **加协作者**:Settings → Collaborators → 加 `Boon87-5`(最简单,不用真迁移)

### ② Vercel
1. 用 Boon87-5 登录 Vercel
2. *Add New → Project* → 选上面那个 GitHub 仓库 → 部署
3. 在 Vercel 项目 *Settings → Environment Variables* 里,把 `.env.local` 那两个变量(`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`)填进去 → 重新部署

### ③ Supabase(登录后端）
> 如果想让 Boon87-5 有**自己独立**的登录数据库:
1. 用 Boon87-5 登录 Supabase → 新建一个 project
2. 复制新项目的 URL + anon key,更新 `.env.local` 和 Vercel 环境变量
3. 若原来的账号/数据要保留:在旧 Supabase 项目 *Database → Backups* 导出,导入到新项目(或让员工重新注册即可,数据不多时最省事）
>
> 如果**继续共用**现在这个 Supabase(`bcgjpxfrhcnqwowdzach`),就不用动,只要新 Vercel 填同样的 env 即可。

### ④ Chrome 扩展
扩展是本地加载的,和账户无关 —— 在新账户/新电脑上按第 2 节「Chrome 扩展」重装一次即可。

---

## 4. 常见问题速查（都在这份代码里彻底修过）

| 症状 | 原因 & 解决 |
|------|------------|
| 网站打不开 / 504 `MIDDLEWARE_INVOCATION_TIMEOUT` | Supabase 项目暂停了 → Supabase 后台点 *Restore* 唤醒（1–2 分钟） |
| 搜索全 0 件 + 「需要 AAO 扩展」 | 扩展掉线（多半是 OneDrive 挪了文件夹）→ 从稳定路径重载扩展 |
| 拼多多 0 件 | 拼多多要登录 → 在弹窗里用手机号登录一次,之后保持 |
| 淘宝/1688 弹「异常流量」 | 平台临时限流 → 换网络或过几分钟;遇真人验证会自动弹窗给你过 |
| 1688 抓不到 | 已用「读 React 内部数据(fiber)」攻克;若又坏,检查字段名 `priceInfo.price`/`title`/`offerId` 是否被改 |
| git push 报 403 | 凭据缓存了错账户 → `printf "protocol=https\nhost=github.com\n\n" \| git credential reject` 后重推 |

---

*本文件随 `v1.0-complete` 一起存档。整个系统的完整代码都在这个仓库里（前端 + `chrome-extension/`）。*
