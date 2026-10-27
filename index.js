#!/usr/bin/env node

/**
 * create-ljs — LJS 体系脚手架入口
 *
 * 用法：
 *   npm create ljs@latest                 # 交互式选择
 *   npm create ljs@latest my-app          # 指定目录名
 *   npm create ljs@latest my-app -- -t rsbuild -y   # 全非交互（AI / CI 友好）
 *
 * @module create-ljs
 */

import { run } from './src/cli.js';

run(process.argv.slice(2)).catch((error) => {
  console.error('\n✖ 生成失败：', error?.message || error);
  process.exit(1);
});
