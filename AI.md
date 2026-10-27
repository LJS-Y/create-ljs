# AI.md — create-ljs

> 面向 AI 编码助手的机器可读说明。人类阅读请看 README.md。

## 一句话定位

LJS 体系脚手架。用一条命令生成一个**已集成 ljs-tools 的完整 Vue3 工程**，生成即可开发，不是空壳模板。

## 何时用 / 何时不用

**用**：
- 用户要新建中后台管理页面、移动端 H5，且愿意用 Vue3 + Rsbuild 技术栈
- 用户明确提到 LJS、ljs-tools、若依风格中后台
- 需要一个「开箱有路由/状态/请求封装/权限/国密」的起点，而不是从 `npm create vite` 空目录开始

**不用**：
- 已有工程（本工具只负责新建，不做增量集成）
- 非 Vue3 项目、或明确不用 Rsbuild 的项目
- 只要一个组件或一个函数（那应该装 `ljs-tools` 而不是建工程）

## 安装与调用

无需安装，直接用 npm create：

```bash
npm create ljs@latest <目录名> -t <模板>
```

**AI 调用约定（重要）**：始终加 `-t` 指定模板。指定模板后 CLI 自动进入非交互模式，不会等待 stdin 而卡住。

### ⚠️ npm create 的参数过滤陷阱

`npm create` 会**丢掉 `-` 开头的参数**。因此：

```bash
npm create ljs@latest my-app -t h5 -y
# 实际只传给 CLI：my-app h5 （-t 和 -y 都被吞了）
```

CLI 已做容错：裸值 `rsbuild` / `rsbuild2` / `h5` 会被识别为模板，
`miniprogram` / `standalone` 会被识别为 H5 入口。所以上面这行**依然可用**。

若需要绝对明确，用 `--` 显式分隔（推荐给脚本 / CI）：

```bash
npm create ljs@latest my-app -- -t h5 --h5-entry standalone -y
```

## 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| 目录名（位置参数） | string | × | `ljs-app` | 目标目录，不能是已存在的非空目录 |
| `-t, --template` | string | × | `rsbuild2`（`-y` 时） | `rsbuild` \| `rsbuild2` \| `h5` |
| `-y, --yes` | flag | × | false | 全部取默认值，不交互 |
| `--h5-entry` | string | × | `miniprogram` | 仅 `h5` 模板有效：`miniprogram` \| `standalone` |
| `-l, --list` | flag | × | false | 列出模板后退出 |
| `-h, --help` | flag | × | false | 显示帮助后退出 |

## 模板清单

| id | 技术栈 | 产物特点 |
| --- | --- | --- |
| `rsbuild` | Vue 3.5 + `@rsbuild/core` 1.x + Vue Router 4 + Vuex 4 + Element Plus | 含 AGENTS.md / CLAUDE.md |
| `rsbuild2` | Vue 3.5 + `@rsbuild/core` 2.x + Vue Router 5 + Vuex 4 + Element Plus | 含 AGENTS.md / CLAUDE.md |
| `h5` | Vue 3.5 + `@rsbuild/core` 2.x + Vue Router 5 + Vuex 4 + Vant | **无 AGENTS.md**（见已知坑） |

## 生成后的工程结构（三模板共通）

```
<项目>/
├─ src/
│  ├─ api/          axios 封装 + 按模块拆的接口（axios.js 里挂了 requestEncrypt）
│  ├─ components/   ExcelImport、FileUpload、Footer 等
│  ├─ router/       index.js（路由表）+ callback.js（守卫）
│  ├─ store/        Vuex 4，modules/permission.js 负责动态路由
│  ├─ tools/        base.js（工具别名）、common.js（checkToken 等）
│  └─ views/        业务页面，页面三件套：index.vue + index.js + index.scss
├─ public/
│  └─ config.js     运行时配置（window.g），部署时可改而不重新构建
├─ .env .env.development .env.production .env.test
├─ AGENTS.md        AI 项目约定包（rsbuild / rsbuild2 有）
└─ rsbuild.config.mjs
```

## 环境变量约定

**Rsbuild 模板用 `PUBLIC_` 前缀**（这是 Rsbuild 规则，与 Vite 的 `VITE_` 不同）：

| 变量 | 用途 |
| --- | --- |
| `PUBLIC_API_URL` | 接口地址 |
| `PUBLIC_SM_CRYPTO` | 国密开关，`'1'` 开 |
| `PUBLIC_SM_API_PREFIX` | 国密加解密 URL 前缀门，默认 `/api/` |
| `PUBLIC_CURRENTMODE` | 运行模式：development / test / production |

读取方式：`import.meta.env.PUBLIC_API_URL`。

## H5 两种入口的差异

| | `miniprogram` | `standalone` |
| --- | --- | --- |
| `src/views/login/` | **不生成** | 保留 |
| token 来源 | URL 参数（小程序拼在链接上） | 登录接口返回 |
| 国密密钥来源 | URL 参数 `smSwitch` / `ljs_a` / `ljs_b` | 登录接口 `encryptKeys.KPAPu` / `KPBPr` |
| `common.js` | 顶部加 `// [create-ljs]` 说明横幅 | 原样 |

## 已知坑

- **三个模板都带 AGENTS.md**：`rsbuild` / `rsbuild2` / `h5` 均含 `AGENTS.md` 与 `CLAUDE.md`（字节一致的副本）。让 AI 在生成工程里写代码前，先让它读 `AGENTS.md`。
- **模板内 `package-lock.json` 是源仓库的锁文件**：生成后建议删掉重新 `npm install`，避免锁文件与项目名不符造成困惑。
- **生成目录不能非空**：目标已存在且非空时直接报错退出，不会覆盖。需用户自行清理或换名。
- **`npm create ljs` 指向的包名是 `create-ljs`**：npm 的 create 语法会自动补 `create-` 前缀，因此包名必须是 `create-ljs`，命令写作 `npm create ljs@latest`。
- **本工具不联网**：模板随包分发，离线可用。但 `npm install` 依赖仍需网络。
- **Windows 换行**：模板文件随包以 LF 发布，检出后由用户本机 git 配置决定；本包不含 .gitattributes。

## 典型调用（给 AI 的抄写样本）

```bash
# 新中后台项目
npm create ljs@latest admin-web -t rsbuild2 -y
cd admin-web && npm install && npm run dev

# 小程序内嵌 H5
npm create ljs@latest h5-page -t h5 --h5-entry miniprogram -y

# 独立 H5（要登录页）
npm create ljs@latest h5-app -t h5 --h5-entry standalone -y
```
