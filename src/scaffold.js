/**
 * 工程生成器
 *
 * 职责：
 * 1. 把 templates/<dir> 复制到目标目录（排除 node_modules / dist 等）
 * 2. 按模板名改写 package.json 的 name
 * 3. 按 answers 裁剪（如 H5 的入口方式影响登录页与守卫逻辑）
 * 4. 输出后续操作指引
 *
 * @module scaffold
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_ROOT = path.resolve(__dirname, '..', 'templates');

/** 复制时跳过的目录 / 文件（构建产物、依赖、锁文件按需重装） */
const SKIP = new Set([
  'node_modules',
  'dist',
  'dist-ssr',
  '.git',
  '.DS_Store',
  'Thumbs.db',
]);

/**
 * 递归复制目录
 * @param {string} from
 * @param {string} to
 */
async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });

  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;

    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);

    if (entry.isDirectory()) {
      await copyDir(src, dest);
    } else if (entry.isSymbolicLink()) {
      const link = await fs.readlink(src);
      await fs.symlink(link, dest);
    } else {
      await fs.copyFile(src, dest);
    }
  }
}

/**
 * 把目录名规范成合法的 npm 包名
 * @param {string} name
 */
function toPackageName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ljs-app';
}

/**
 * 读取并改写 package.json
 * @param {string} targetDir
 * @param {string} dirName
 * @param {object} template
 */
async function rewritePackageJson(targetDir, dirName, template) {
  const pkgPath = path.join(targetDir, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
  } catch {
    return; // 模板没有 package.json 就不处理
  }

  pkg.name = toPackageName(dirName);
  pkg.private = true;
  pkg.version = '0.1.0';

  await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

/**
 * 同步改写 package-lock.json 里的项目名
 *
 * 模板自带的锁文件是从源仓库复制的，name 字段是模板名（个别模板还是错的）。
 * 不改写会让生成后的项目 npm install 时出现名字不符，也容易误导排查。
 *
 * @param {string} targetDir
 * @param {string} dirName
 */
async function rewritePackageLock(targetDir, dirName) {
  const lockPath = path.join(targetDir, 'package-lock.json');
  let lock;
  try {
    lock = JSON.parse(await fs.readFile(lockPath, 'utf8'));
  } catch {
    return; // 没有锁文件就跳过
  }

  const nextName = toPackageName(dirName);

  // lock 有两处 name：顶层与 packages[""]
  if (lock.name) lock.name = nextName;
  if (lock.packages && lock.packages['']) {
    lock.packages[''].name = nextName;
    lock.packages[''].version = '0.1.0';
  }

  await fs.writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
}

/**
 * H5 入口方式裁剪：standalone 保留登录页，miniprogram 移除登录页路由与入口
 * @param {string} targetDir
 * @param {string} entry
 */
async function applyH5Entry(targetDir, entry) {
  if (entry !== 'miniprogram') return;

  // 小程序内嵌场景不生成登录页：移除登录视图目录
  const loginDir = path.join(targetDir, 'src', 'views', 'login');
  const existed = await fs
    .access(loginDir)
    .then(() => true)
    .catch(() => false);

  if (existed) {
    await fs.rm(loginDir, { recursive: true, force: true });
  }

  // 在 common.js 的 checkToken 上留说明，避免后来者困惑
  const commonPath = path.join(targetDir, 'src', 'tools', 'common.js');
  const hasCommon = await fs
    .access(commonPath)
    .then(() => true)
    .catch(() => false);

  if (hasCommon) {
    const content = await fs.readFile(commonPath, 'utf8');
    const banner = [
      '// [create-ljs] 本工程按「微信小程序 web-view 内嵌」方式生成：',
      '// token 与国密密钥由小程序侧拼在 URL 上传入，本工程不提供登录页。',
      '// 若后续需要独立登录能力，请补回 src/views/login 与路由配置。',
      '',
    ].join('\n');

    if (!content.startsWith('// [create-ljs]')) {
      await fs.writeFile(commonPath, banner + content, 'utf8');
    }
  }
}

/**
 * 生成工程
 * @param {object} params
 * @param {string} params.dirName 目标目录名
 * @param {object} params.template 模板元信息
 * @param {object} params.answers 模板问题答案
 * @param {string} params.cwd 当前工作目录
 */
export async function scaffold({ dirName, template, answers, cwd }) {
  const sourceDir = path.join(TEMPLATES_ROOT, template.dir);
  const targetDir = path.resolve(cwd, dirName);

  const sourceExists = await fs
    .access(sourceDir)
    .then(() => true)
    .catch(() => false);

  if (!sourceExists) {
    throw new Error(`模板文件缺失：${sourceDir}（包内 templates/${template.dir} 不存在）`);
  }

  const targetExists = await fs
    .access(targetDir)
    .then(() => true)
    .catch(() => false);

  if (targetExists) {
    const entries = await fs.readdir(targetDir);
    if (entries.length > 0) {
      throw new Error(`目标目录已存在且非空：${targetDir}`);
    }
  }

  process.stdout.write(`\n  正在生成 ${template.name} → ${dirName}\n`);

  await copyDir(sourceDir, targetDir);
  await rewritePackageJson(targetDir, dirName, template);
  await rewritePackageLock(targetDir, dirName);

  if (template.id === 'h5' && answers.entry) {
    await applyH5Entry(targetDir, answers.entry);
  }

  const pm = detectPackageManager();
  // npm 不能直接跑脚本（需 run），pnpm / yarn 可以省略 run
  const runPrefix = pm === 'npm' ? 'run ' : '';
  process.stdout.write(`
  ✔ 工程已生成：${targetDir}

  接下来：
    cd ${dirName}
    ${pm} install
    ${pm} ${runPrefix}dev

  项目约定见 AGENTS.md（写给 AI 协作者的项目手册），README.md 为人类阅读版。
`);
}

/**
 * 检测可用的包管理器
 * @returns {string}
 */
function detectPackageManager() {
  const ua = process.env.npm_config_user_agent || '';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';
  return 'npm';
}
