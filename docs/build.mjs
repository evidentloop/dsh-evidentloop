// Build the static site in docs/site/ from docs/guide.md (the single source).
// Each "## Title {#slug}" in guide.md becomes one manual page: guide-<slug>.html.
// Output: index.html, guide-*.html, style.css, favicon.svg. Upload docs/site/ to Cloudflare Pages as is.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'site-src');
const out = join(here, 'site');
const require = createRequire(import.meta.url);
const { marked } = require(join(here, '../prototype/vendor/marked@9.1.0.min.js'));
const read = name => readFileSync(join(src, name), 'utf8').trim();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const raw = readFileSync(join(here, 'guide.md'), 'utf8').replace(/\r\n/g, '\n');
const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
const meta = Object.fromEntries((fm ? fm[1] : '').split('\n')
  .map(line => line.match(/^(\w+):\s*(.+)$/)).filter(Boolean).map(m => [m[1], m[2].trim()]));
const body = fm ? raw.slice(fm[0].length) : raw;

// Split into intro (before the first H2) and chapters.
const parts = body.split(/^## /m);
const intro = parts.shift();
const chapters = parts.map(part => {
  const nl = part.indexOf('\n');
  const head = part.slice(0, nl).trim();
  const m = head.match(/^(.*?)\s*\{#([a-z0-9-]+)\}$/);
  if (!m) throw new Error(`chapter heading needs a {#slug}: ${head}`);
  return { title: m[1], slug: m[2], file: `guide-${m[2]}.html`, md: part.slice(nl + 1) };
});
if (chapters.length < 2) throw new Error('guide.md needs at least two chapters');


const render = (md, chapter) => {
  const subs = [];
  const renderer = new marked.Renderer();
  renderer.heading = (text, level) => {
    if (level === 3) { const id = `${chapter.slug}-${subs.length + 1}`; subs.push({ id, text }); return `<h2 id="${id}">${text}</h2>\n`; }
    return `<h${level}>${text}</h${level}>\n`;
  };
  const baseTable = renderer.table.bind(renderer);
  renderer.table = (header, rows) => `<div class="table">${baseTable(header, rows)}</div>`;
  return { html: marked.parse(md, { renderer, gfm: true }), subs };
};

const mark = read('mark.svg');
const shell = ({ title, page, main }) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'self'; media-src 'self'; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'">
<title>${esc(title)}</title>
<meta name="description" content="${esc(meta.description || '')}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="style.css">
</head>
<body>
<header class="bar"><a class="brand" href="index.html">${mark}<span>AI 变更评审</span></a>
<nav aria-label="站点"><a href="index.html"${page === 'home' ? ' aria-current="page"' : ''}>介绍</a><a href="demo.html"${page === 'demo' ? ' aria-current="page"' : ''}>实录</a><a href="${chapters[0].file}"${page === 'guide' ? ' aria-current="page"' : ''}>使用说明</a></nav></header>
${main}
<footer class="site"><span>AI 变更评审 · EvidentLoop · MIT 许可</span><span>${esc(meta.version || '')}</span><span>界面以实际发布的版本为准</span></footer>
</body>
</html>
`;

const home = shell({
  title: 'AI 变更评审 · EvidentLoop',
  page: 'home',
  main: `<main>
<section class="hero">
  <div class="hero-copy">
    <h1>看清 AI 改了什么，<br>再决定要不要合并</h1>
    <p class="lead">AI 写代码越来越快。EvidentLoop 把每批改动整理成可以验收的交付：按功能看懂改动，逐条核对需求，查出带证据的问题；发回会话修改，改完再审。</p>
    <div class="cta"><a class="btn primary" href="${chapters[0].file}">阅读使用说明</a><a class="btn ghost" href="#flow">查看工作流</a></div>
    <p class="note">DeepSeek Harness 插件 · ${esc(meta.version || '')}</p>
  </div>
  ${read('demo.html')}
</section>
<section class="band" id="demo" aria-labelledby="demo-h">
  <h2 id="demo-h">从看懂改动，到发回修改</h2>
  <p>正式插件实录：加载一份真实历史审查记录快照，查看说明和代码，复核审查意见，导出报告，再写入会话草稿。</p>
  ${read('video.html')}
  <p class="note">公开项目 Sopify 的真实记录；本次采集没有重新调用模型。该快照共 34 个变更文件：已实际审查 1 个，24 个待审，9 个按规则跳过。<a href="demo.html">查看浅深主题截图与完整说明 →</a></p>
</section>
<section class="band" id="flow" aria-labelledby="flow-h">
  <h2 id="flow-h">在会话和评审台之间循环</h2>
  <p>你在会话里改，在评审台里看；修改要求发回会话，改完再审，直到可以放心合并。</p>
  <div class="flow"><img class="flow-wide" src="flow-wide.svg" alt="AI 变更评审工作流：手动审查、人工复核、发回修改或导出"><img class="flow-narrow" src="flow-narrow.svg" alt="AI 变更评审工作流：修改、审查、复核与反馈循环"></div>
</section>
<section class="band" aria-labelledby="caps-h">
  <h2 id="caps-h">你会得到什么</h2>
  <div class="caps">
    <div><h3>按功能看懂改动</h3><p>讲清为什么改、怎么改、行为有什么变化，并标明是代码事实还是模型推断。</p></div>
    <div><h3>逐条核对需求</h3><p>会话里提的需求自动收集、逐条核对；被后来的要求改掉的，标为「已调整」，不算没做到。</p></div>
    <div><h3>查出带证据的问题</h3><p>每个问题都引用冻结代码的原文，核对不上的不展示；没审完时写明原因，不会说成没问题。</p></div>
    <div><h3>发回修改，留下记录</h3><p>问题和批注写进会话的输入框，由你确认后发送；每次审查都留档，可以导出。</p></div>
  </div>
</section>
<section class="band" aria-labelledby="why-h">
  <h2 id="why-h">为什么可以放心用</h2>
  <div class="caps">
    <div><h3>没提交的改动也能审</h3><p>AI 改完的代码常常还没提交，不用先提交就能审。</p></div>
    <div><h3>再审只看新改动</h3><p>没变的文件沿用上次的结论，「新改动」筛选只列出这次改过的文件。</p></div>
    <div><h3>只读，不碰你的仓库</h3><p>不改代码、暂存区和提交；审查记录只保存在本机。</p></div>
    <div><h3>开源</h3><p>以 MIT 许可发布。</p></div>
  </div>
</section>
</main>`,
});

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), home);
writeFileSync(join(out, 'demo.html'), shell({
  title: '正式插件实录 · EvidentLoop', page: 'demo',
  main: `<main class="media-page"><header><p class="eyebrow">0.1.0-rc.1 · Beta</p><h1>一次真实审查的复核过程</h1><p class="lead">加载 DeepSeek-V4.1-Flash 真实历史审查记录快照，在正式插件中完成查看、复核、导出与发回草稿。</p></header>${read('video.html')}<p class="note">本次采集新增模型调用为 0。展示源是公开项目 Sopify；该快照共 34 个变更文件：已实际审查 1 个，24 个待审，9 个按规则跳过。画面中的 P2 审查意见在人工复核后标记为非问题，不作为已确认缺陷宣传。批注来自本次演示操作。</p>${read('gallery.html')}</main>`,
}));

// Page 1 lead: the intro paragraph under the H1 in guide.md (the H1 itself is replaced by each chapter's own h1).
const introHtml = marked.parse(intro.replace(/^# .*\n/m, ''), { gfm: true }).replace('<p>', '<p class="lead">');
chapters.forEach((chapter, i) => {
  const { html, subs } = render(chapter.md, chapter);
  const prev = chapters[i - 1];
  const next = chapters[i + 1];
  const toc = chapters.map((c, k) => `<li${k === i ? ' class="on"' : ''}><a href="${c.file}"${k === i ? ' aria-current="page"' : ''}>${c.title}</a>${k === i && subs.length ? `<ul>${subs.map(s => `<li><a href="#${s.id}">${s.text}</a></li>`).join('')}</ul>` : ''}</li>`).join('');
  const page = shell({
    title: `${chapter.title} · AI 变更评审 · EvidentLoop 使用说明`,
    page: 'guide',
    main: `<div class="doc">
<nav class="toc" aria-label="章节"><ol>${toc}</ol></nav>
<details class="chapters"><summary>章节 ${i + 1} / ${chapters.length}：${chapter.title}</summary><ol>${chapters.map((c, k) => `<li><a href="${c.file}"${k === i ? ' aria-current="page"' : ''}>${c.title}</a></li>`).join('')}</ol></details>
<article>
<header class="doc-header"><h1>${chapter.title}</h1>${i === 0 ? introHtml : ''}</header>
${html}
<nav class="pager" aria-label="翻页">${prev ? `<a class="prev" href="${prev.file}"><small>上一章</small>${prev.title}</a>` : '<span></span>'}${next ? `<a class="next" href="${next.file}"><small>下一章</small>${next.title}</a>` : '<span></span>'}</nav>
</article>
</div>`,
  });
  writeFileSync(join(out, chapter.file), page);
  if (i === 0) writeFileSync(join(out, 'guide.html'), page);
});
copyFileSync(join(src, 'style.css'), join(out, 'style.css'));
for (const file of ['flow-wide.svg', 'flow-narrow.svg']) copyFileSync(join(src, file), join(out, file));
copyFileSync(join(here, 'icon.svg'), join(out, 'favicon.svg'));
cpSync(join(src, 'assets'), join(out, 'assets'), { recursive: true });
console.log(`built docs/site: home + ${chapters.length} chapters (${chapters.map(c => c.slug).join(', ')})`);
