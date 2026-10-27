/**
 * CLI 主流程
 *
 * 设计要点：
 * 1. 交互模式给人用（方向键选择）；
 * 2. 非交互模式给 AI / CI 用（--template / --yes），一次命令生成，不需要 stdin；
 * 3. 模板来源是本包 templates/ 目录，不依赖 clone 仓库或网络模板。
 *
 * @module cli
 */

import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { TEMPLATES, getTemplate } from './templates.js';
import { scaffold } from './scaffold.js';

const HELP = `
create-ljs — 生成 LJS 体系的 Vue3 工程

用法：
  npm create ljs@latest [目录名] [选项]

选项：
  -t, --template <id>   直接指定模板，跳过选择
                        rsbuild | rsbuild2 | h5
  -y, --yes             全部使用默认值（AI / CI 友好，无需交互）
  --h5-entry <mode>     H5 入口方式：miniprogram | standalone（默认 miniprogram）
  -l, --list            列出全部模板
  -h, --help            显示帮助

示例：
  npm create ljs@latest my-admin -t rsbuild2
  npm create ljs@latest my-h5 -t h5 --h5-entry standalone -y
`;

/**
 * 解析命令行参数
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const opts = {
    dirName: null,
    template: null,
    yes: false,
    h5Entry: 'miniprogram',
    list: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-t':
      case '--template':
        opts.template = argv[++i];
        break;
      case '-y':
      case '--yes':
        opts.yes = true;
        break;
      case '--h5-entry':
        opts.h5Entry = argv[++i];
        break;
      case '-l':
      case '--list':
        opts.list = true;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      default:
        if (!arg.startsWith('-') && !opts.dirName) {
          opts.dirName = arg;
        }
    }
  }

  return opts;
}

/**
 * 单选提示（数字键，无需方向键依赖，跨平台稳定）
 * @param {string} message
 * @param {Array<{value:string,label:string,description?:string}>} options
 * @returns {Promise<string>}
 */
async function selectPrompt(message, options) {
  stdout.write(`\n? ${message}\n`);
  options.forEach((opt, i) => {
    stdout.write(`  ${i + 1}) ${opt.label}\n`);
    if (opt.description) {
      stdout.write(`     ${opt.description}\n`);
    }
  });

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await new Promise((resolve) => {
      rl.question(`\n  请输入序号 (1-${options.length}，回车默认 1)：`, resolve);
    });
    const index = Number.parseInt(answer.trim(), 10);
    const picked = Number.isInteger(index) && index >= 1 && index <= options.length
      ? options[index - 1]
      : options[0];
    return picked.value;
  } finally {
    rl.close();
  }
}

/**
 * 文本输入提示
 * @param {string} message
 * @param {string} defaultValue
 * @returns {Promise<string>}
 */
async function inputPrompt(message, defaultValue) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await new Promise((resolve) => {
      rl.question(`\n? ${message}（默认 ${defaultValue}）：`, resolve);
    });
    return answer.trim() || defaultValue;
  } finally {
    rl.close();
  }
}

/**
 * 主入口
 * @param {string[]} argv
 */
export async function run(argv) {
  const opts = parseArgs(argv);

  if (opts.help) {
    stdout.write(HELP);
    return;
  }

  if (opts.list) {
    stdout.write('\n可用模板：\n\n');
    TEMPLATES.forEach((t) => {
      stdout.write(`  ${t.id.padEnd(12)} ${t.name}\n`);
      stdout.write(`  ${' '.repeat(12)} ${t.description}\n\n`);
    });
    return;
  }

  stdout.write('\n  create-ljs — LJS 体系脚手架\n');

  // 1. 目录名
  const dirName = opts.dirName || (opts.yes ? 'ljs-app' : await inputPrompt('项目目录名', 'ljs-app'));

  // 2. 模板
  let templateId = opts.template;
  if (!templateId) {
    if (opts.yes) {
      templateId = 'rsbuild2';
    } else {
      templateId = await selectPrompt(
        '选择模板',
        TEMPLATES.map((t) => ({ value: t.id, label: t.name, description: t.description }))
      );
    }
  }

  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(
      `未知模板 "${templateId}"，可选：${TEMPLATES.map((t) => t.id).join(' | ')}`
    );
  }

  // 3. 模板附带问题（如 H5 入口方式）
  const answers = {};
  for (const question of template.questions) {
    if (question.key === 'entry') {
      answers.entry = opts.yes ? opts.h5Entry : await selectPrompt(question.message, question.options);
    }
  }

  // 4. 生成
  await scaffold({ dirName, template, answers, cwd: process.cwd() });
}
