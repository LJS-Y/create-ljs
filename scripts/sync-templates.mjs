#!/usr/bin/env node
/**
 * 模板同步脚本：把 ljs-vue3 仓库里的模板工程同步到 create-ljs/templates/
 *
 * 背景
 * ----
 * create-ljs 的 templates/ 是 ljs-vue3 各模板工程的手工拷贝。
 * 手工拷贝会漂移：改了 ljs-vue3 忘记拷过来，用户 `npm create ljs` 拿到的就是旧代码。
 * 本脚本把「拷贝」变成可重复执行的一条命令，并在同步后做一致性校验。
 *
 * 用法
 * ----
 *   node scripts/sync-templates.mjs            # 同步全部模板
 *   node scripts/sync-templates.mjs --dry-run  # 只看会改什么，不写盘
 *   node scripts/sync-templates.mjs --check    # 只校验是否一致，不一致则以非 0 退出（CI 用）
 *
 * 约定
 * ----
 * 1. 源目录：环境变量 LJS_VUE3_ROOT，默认与本仓库同级（../ljs-vue3）
 * 2. 排除：依赖、构建产物、git 元数据、锁文件见下 SKIP
 * 3. 同步是「镜像」语义：源有的覆盖，目标多出来的（源已删）一并删除
 *
 * @module sync-templates
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES } from '../src/templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES_ROOT = path.join(ROOT, 'templates');

/** ljs-vue3 仓库根目录 */
const SOURCE_ROOT = path.resolve(
  process.env.LJS_VUE3_ROOT || path.join(ROOT, '..', 'ljs-vue3'),
);

/**
 * 不同步的条目
 * - node_modules / dist                               依赖与产物
 * - .git / .github                                    版本控制
 * - .DS_Store / Thumbs.db                             系统垃圾
 * - *.local / *.log*                                  本地配置与日志
 *
 * package-lock.json 的处理是特例，见 KEEP_LOCAL：
 * 它在 templates/ 里是「有意保留」的（生成时由 scaffold 改写 name），
 * 但不应从源仓库覆盖（源仓库的锁文件面向模板工程自身，版本可能不同）。
 */
const SKIP_NAMES = new Set([
  'node_modules',
  'dist',
  'dist-ssr',
  '.git',
  '.github',
  '.DS_Store',
  'Thumbs.db',
  '.cache',
  'coverage',
]);

/** 保留在目标、不随源同步、也不因源缺失而删除的条目 */
const KEEP_LOCAL = new Set(['package-lock.json']);

function shouldSkip(name) {
  if (SKIP_NAMES.has(name)) return true;
  if (name.endsWith('.local')) return true;
  if (/\.log(\.|$)/.test(name)) return true;
  return false;
}

/** 该条目是否「保留在目标、不参与同步」 */
function isKeepLocal(rel) {
  return KEEP_LOCAL.has(path.basename(rel));
}

/**
 * 递归收集目录下所有文件的相对路径
 * @param {string} dir
 * @param {string} base
 * @returns {Promise<string[]>}
 */
async function listFiles(dir, base = dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (shouldSkip(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listFiles(full, base)));
    } else if (e.isFile()) {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

async function readFileOrNull(p) {
  try {
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

/**
 * 同步单个模板
 * @param {{id: string, dir: string, name: string}} template
 * @param {{dryRun: boolean, check: boolean}} opts
 * @returns {Promise<{added: string[], changed: string[], removed: string[], same: number}>}
 */
async function syncOne(template, opts) {
  const srcDir = path.join(SOURCE_ROOT, template.dir);
  const dstDir = path.join(TEMPLATES_ROOT, template.dir);

  const srcExists = await fs.access(srcDir).then(() => true).catch(() => false);
  if (!srcExists) {
    throw new Error(`源目录不存在：${srcDir}`);
  }

  const srcFiles = new Set(await listFiles(srcDir));
  const dstFiles = new Set(await listFiles(dstDir));

  const added = [];
  const changed = [];
  const removed = [];
  let same = 0;

  // 新增 / 变更
  for (const rel of srcFiles) {
    if (isKeepLocal(rel)) continue; // lock 等保留本地，不用源覆盖
    const srcAbs = path.join(srcDir, rel);
    const dstAbs = path.join(dstDir, rel);
    const [srcBuf, dstBuf] = await Promise.all([
      readFileOrNull(srcAbs),
      readFileOrNull(dstAbs),
    ]);
    if (srcBuf === null) continue;
    if (dstBuf === null) {
      added.push(rel);
      if (!opts.dryRun && !opts.check) {
        await fs.mkdir(path.dirname(dstAbs), { recursive: true });
        await fs.writeFile(dstAbs, srcBuf);
      }
    } else if (!srcBuf.equals(dstBuf)) {
      changed.push(rel);
      if (!opts.dryRun && !opts.check) {
        await fs.writeFile(dstAbs, srcBuf);
      }
    } else {
      same++;
    }
  }

  // 删除（源已不存在的）
  for (const rel of dstFiles) {
    if (srcFiles.has(rel)) continue;
    if (isKeepLocal(rel)) continue; // lock 等保留本地，不因源缺失而删
    removed.push(rel);
    if (!opts.dryRun && !opts.check) {
      await fs.rm(path.join(dstDir, rel), { force: true });
      // 顺手清理空目录
      let parent = path.dirname(path.join(dstDir, rel));
      while (parent.startsWith(dstDir) && parent !== dstDir) {
        const left = await fs.readdir(parent).catch(() => ['x']);
        if (left.length === 0) {
          await fs.rmdir(parent).catch(() => {});
          parent = path.dirname(parent);
        } else break;
      }
    }
  }

  return { added, changed, removed, same };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const check = argv.includes('--check');

  console.log('');
  console.log('  create-ljs · 模板同步');
  console.log('  ─'.repeat(35));
  console.log(`  源目录: ${SOURCE_ROOT}`);
  console.log(`  模式  : ${check ? '校验（不写盘）' : dryRun ? '预演（不写盘）' : '同步'}`);
  console.log('');

  const srcRootExists = await fs.access(SOURCE_ROOT).then(() => true).catch(() => false);
  if (!srcRootExists) {
    console.error(`  ✖ 找不到 ljs-vue3 仓库：${SOURCE_ROOT}`);
    console.error('     可用环境变量 LJS_VUE3_ROOT 指定路径。');
    process.exit(1);
  }

  let totalDiff = 0;
  const summary = [];

  for (const t of TEMPLATES) {
    let r;
    try {
      r = await syncOne(t, { dryRun, check });
    } catch (e) {
      console.error(`  ✖ [${t.id}] ${e.message}`);
      process.exitCode = 1;
      continue;
    }
    const diffCount = r.added.length + r.changed.length + r.removed.length;
    totalDiff += diffCount;
    summary.push({ t, r, diffCount });

    const status = diffCount === 0 ? '✔ 一致' : `△ 差异 ${diffCount} 个文件`;
    console.log(`  [${t.id.padEnd(9)}] ${status}  (相同 ${r.same})`);
    for (const f of r.added) console.log(`      + ${f}`);
    for (const f of r.changed) console.log(`      ~ ${f}`);
    for (const f of r.removed) console.log(`      - ${f}`);
  }

  console.log('');
  if (totalDiff === 0) {
    console.log('  ✔ 全部模板与源头一致，无需同步。');
  } else if (check) {
    console.log(`  ✖ 检测到 ${totalDiff} 处不一致（--check 模式，未写盘）。`);
    process.exit(1);
  } else if (dryRun) {
    console.log(`  △ 预演：共 ${totalDiff} 处差异，未写盘。去掉 --dry-run 执行同步。`);
  } else {
    console.log(`  ✔ 同步完成：共处理 ${totalDiff} 个文件。`);
    console.log('');
    console.log('    建议接着执行：');
    console.log('      npm run smoke        # 冒烟测试');
    console.log('      npm run check:tpl    # 确认模板与源头一致');
  }
  console.log('');
}

main().catch((e) => {
  console.error('\n  ✖ 同步失败：', e?.message || e);
  process.exit(1);
});
