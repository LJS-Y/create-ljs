/**
 * 冒烟测试：验证每个模板都能生成，且产物结构完整。
 *
 * 只做「生成 + 结构校验」，不跑 npm install / build（那属于集成测试，
 * 成本高且依赖网络，另由人工或 CI 执行）。
 *
 * 运行：node scripts/smoke.mjs
 */

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'index.js');

/** 必需文件（所有模板共通） */
const REQUIRED = ['package.json', 'index.html', 'rsbuild.config.mjs', 'src'];

/** 各模板额外要求 */
const CASES = [
  { id: 'rsbuild', dir: 't-smoke-rsbuild', args: ['-t', 'rsbuild', '-y'], extra: ['AGENTS.md'] },
  { id: 'rsbuild2', dir: 't-smoke-rsbuild2', args: ['-t', 'rsbuild2', '-y'], extra: ['AGENTS.md'] },
  {
    id: 'h5 miniprogram',
    dir: 't-smoke-h5-mp',
    args: ['-t', 'h5', '--h5-entry', 'miniprogram', '-y'],
    extra: [],
    // 小程序模式不应有登录页
    absent: ['src/views/login'],
  },
  {
    id: 'h5 standalone',
    dir: 't-smoke-h5-sa',
    args: ['-t', 'h5', '--h5-entry', 'standalone', '-y'],
    extra: ['src/views/login'],
  },
  {
    // npm create 会过滤 - 开头的参数，只剩裸值。此处模拟该场景，
    // 验证不带 -t 也能按位置参数识别模板并进入非交互模式。
    id: 'bare args（模拟 npm create 过滤）',
    dir: 't-smoke-bare',
    args: ['rsbuild2'],
    extra: ['AGENTS.md'],
  },
];

let passed = 0;
let failed = 0;

const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'create-ljs-smoke-'));

try {
  for (const testCase of CASES) {
    const target = path.join(tmpRoot, testCase.dir);
    const label = `[${testCase.id}]`;

    try {
      execFileSync(process.execPath, [CLI, testCase.dir, ...testCase.args], {
        cwd: tmpRoot,
        stdio: 'pipe',
      });

      const problems = [];

      for (const rel of [...REQUIRED, ...testCase.extra]) {
        const exists = await fs
          .access(path.join(target, rel))
          .then(() => true)
          .catch(() => false);
        if (!exists) problems.push(`缺少 ${rel}`);
      }

      for (const rel of testCase.absent || []) {
        const exists = await fs
          .access(path.join(target, rel))
          .then(() => true)
          .catch(() => false);
        if (exists) problems.push(`不应存在 ${rel}`);
      }

      // package.json 的 name 应被改写为目录名
      const pkg = JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf8'));
      if (pkg.name !== testCase.dir) {
        problems.push(`package.json name 未改写（期望 ${testCase.dir}，实际 ${pkg.name}）`);
      }

      // package-lock.json 的 name 也应同步（否则 install 时名字不符）
      const lockRaw = await fs
        .readFile(path.join(target, 'package-lock.json'), 'utf8')
        .catch(() => null);
      if (lockRaw) {
        const lock = JSON.parse(lockRaw);
        if (lock.name !== testCase.dir) {
          problems.push(`lock 顶层 name 未改写（实际 ${lock.name}）`);
        }
        if (lock.packages?.['']?.name !== testCase.dir) {
          problems.push(`lock packages[""].name 未改写（实际 ${lock.packages?.['']?.name}）`);
        }
      }

      // 不应带入 node_modules / dist
      for (const skip of ['node_modules', 'dist']) {
        const exists = await fs
          .access(path.join(target, skip))
          .then(() => true)
          .catch(() => false);
        if (exists) problems.push(`不应带入 ${skip}`);
      }

      if (problems.length === 0) {
        console.log(`✅ ${label} 通过`);
        passed += 1;
      } else {
        console.log(`❌ ${label} 失败：${problems.join('；')}`);
        failed += 1;
      }
    } catch (error) {
      console.log(`❌ ${label} 执行失败：${error?.message || error}`);
      failed += 1;
    }
  }
} finally {
  await fs.rm(tmpRoot, { recursive: true, force: true });
}

console.log(`\n结果：${passed} 通过 / ${failed} 失败（共 ${CASES.length} 项）`);
process.exit(failed === 0 ? 0 : 1);
