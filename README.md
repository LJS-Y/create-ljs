# create-ljs

LJS 体系脚手架：一条命令生成可运行的中后台 / H5 工程。

底层是 Vue3 + Rsbuild + ljs-tools 的完整工程，不是「空壳模板」——生成即可开发，业务代码、路由、状态管理、请求封装、国密、权限都已就位。

## 快速开始

```bash
npm create ljs@latest
```

按提示选择即可。也可以直接指定：

```bash
# 生成中后台（Rsbuild 2.x）
npm create ljs@latest my-admin -t rsbuild2

# 生成 H5（微信小程序 web-view 内嵌）
npm create ljs@latest my-h5 -t h5 --h5-entry miniprogram

# 生成 H5（独立应用，带登录页）
npm create ljs@latest my-h5 -t h5 --h5-entry standalone
```

## 模板

| id | 名称 | 技术栈 | 适用场景 |
| --- | --- | --- | --- |
| `rsbuild` | 中后台（Rsbuild 1.x） | Vue 3.5 + Rsbuild 1.x + Element Plus + Vuex | 求稳定、依赖版本保守的中后台项目 |
| `rsbuild2` | 中后台（Rsbuild 2.x） | Vue 3.5 + Rsbuild 2.x + Vue Router 5 + Element Plus | 新项目首选，跟进最新生态 |
| `h5` | H5 移动端 | Vue 3.5 + Rsbuild 2.x + Vant | 移动端页面；可内嵌小程序或独立部署 |

> **rsbuild 与 rsbuild2 怎么选？** 两者业务结构一致，区别在构建器大版本与路由版本。新项目选 `rsbuild2`；要和老项目保持一致选 `rsbuild`。

## 命令行选项

```
用法：npm create ljs@latest [目录名] [选项]

选项：
  -t, --template <id>   指定模板，跳过选择（rsbuild | rsbuild2 | h5）
  -y, --yes             全部使用默认值，无需任何交互（AI / CI 友好）
  --h5-entry <mode>     H5 入口方式：miniprogram（默认）| standalone
  -l, --list            列出全部模板
  -h, --help            显示帮助
```

> **关于参数传递**：`npm create` 会丢掉 `-` 开头的参数。本 CLI 已做容错——裸值
> `rsbuild`/`rsbuild2`/`h5` 会被识别为模板，`miniprogram`/`standalone` 识别为 H5 入口，
> 所以 `npm create ljs@latest my-app h5 standalone` 也能用。需要绝对明确时用 `--` 分隔：
> `npm create ljs@latest my-app -- -t h5 --h5-entry standalone`。

## H5 的两种入口

`h5` 模板会追问一个问题：**这个页面从哪里进入？**

| 选项 | 生成结果 |
| --- | --- |
| `miniprogram` | 不生成登录页。`checkToken()` 从 URL 参数取 token；国密密钥由小程序侧拼在 URL 上经 `smSwitch`/`ljs_a`/`ljs_b` 下发。 |
| `standalone` | 保留完整登录页与登录流程，token 由登录接口获取。 |

生成后仍想切换：补回或删除 `src/views/login` 目录，并调整路由配置即可。

## 生成后

```bash
cd my-app
npm install
npm run dev
```

项目里会带两份说明：

- **`AGENTS.md`** — 写给 AI 协作者的项目约定（技术栈、目录约定、常见任务手册、红线）。用 AI 写代码前让它先读这份。
- **`README.md`** — 写给人类的项目说明。

## 与 ljs-tools 的关系

生成的工程已内置 [ljs-tools](https://www.npmjs.com/package/ljs-tools)（Vue3 工具库 + 常用组件）。

- 工具以 `$LJSxxx` 挂在全局：`this.$LJSbase.fieldCheck(v)`、`this.$LJSsession.getSS(k)`
- 组件可直接用：`<Pagination>`、`<DictTag>`、`<DateRange>`
- API 文档：https://ljs-y.github.io/ljs-vue3

## 许可

MIT
