/**
 * 模板注册表
 *
 * 每个模板一个条目，cli 按此渲染选择和写入。新增模板只需在 templates/
 * 放目录并在本文件登记，无需改 cli 逻辑。
 *
 * @module templates
 */

export const TEMPLATES = [
  {
    id: 'rsbuild',
    name: '中后台（Rsbuild 1.x）',
    dir: 'ljs-vue3-rsbuild',
    description: '若依分离版风格中后台：Vue3 + Rsbuild 1.x + Element Plus + Vuex。稳定优先，依赖版本保守。',
    requires: ['element-plus'],
    questions: [],
  },
  {
    id: 'rsbuild2',
    name: '中后台（Rsbuild 2.x）',
    dir: 'ljs-vue3-rsbuild2',
    description: '同上，构建器升级到 Rsbuild 2.x + vue-router 5。新项目建议选它，跟进最新生态。',
    requires: ['element-plus'],
    questions: [],
  },
  {
    id: 'h5',
    name: 'H5 移动端（Rsbuild 2.x）',
    dir: 'ljs-h5',
    description: '移动端 H5：Vue3 + Rsbuild 2.x + Vant。可作为微信小程序 web-view 内嵌页，也可独立部署。',
    requires: ['vant'],
    // H5 的入口方式决定是否保留登录页与路由守卫逻辑
    questions: [
      {
        key: 'entry',
        type: 'select',
        message: '这个 H5 页面从哪里进入？',
        options: [
          {
            value: 'miniprogram',
            label: '微信小程序 web-view 内嵌（token 由小程序传入）',
            description: '不生成登录页；checkToken 从 URL 参数取 token，并接收小程序下发的国密密钥。',
          },
          {
            value: 'standalone',
            label: '独立 H5 应用（需要登录页）',
            description: '保留完整登录页与登录流程，token 由登录接口获取。',
          },
        ],
      },
    ],
  },
];

/**
 * 按 id 取模板
 * @param {string} id
 * @returns {object|undefined}
 */
export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id);
}
