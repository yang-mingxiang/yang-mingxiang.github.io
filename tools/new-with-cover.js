const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const layout = process.argv[2];
const title = process.argv[3];
const coverInput = process.argv[4];

const root = process.cwd();
const postsDir = path.join(root, 'source', '_posts');

function usage() {
  console.log('Usage:');
  console.log('  npm run blog:new -- "文章标题" "D:\\\\path\\\\cover.png"');
  console.log('  npm run essay:new -- "随笔标题" "D:\\\\path\\\\cover.png"');
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  usage();
  process.exit(1);
}

function listMarkdownFiles() {
  if (!fs.existsSync(postsDir)) return new Set();
  return new Set(
    fs.readdirSync(postsDir)
      .filter(name => name.toLowerCase().endsWith('.md'))
      .map(name => path.join(postsDir, name))
  );
}

function resolveInputFile(input) {
  const resolved = path.isAbsolute(input) ? input : path.resolve(root, input);
  if (!fs.existsSync(resolved)) {
    fail(`Cover image not found: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    fail(`Cover path is not a file: ${resolved}`);
  }
  return resolved;
}

function newestMarkdownFile(candidates) {
  return candidates
    .map(file => ({ file, mtime: fs.statSync(file).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.file;
}

function readFrontMatterValue(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : '';
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readFrontMatterValueWithRetry(file, key) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const content = fs.readFileSync(file, 'utf8');
    const value = readFrontMatterValue(content, key);
    if (value) return { content, value };
    sleep(100);
  }
  return { content: fs.readFileSync(file, 'utf8'), value: '' };
}

function updateCover(content, coverPath) {
  if (/^cover:\s*.*$/m.test(content)) {
    return content.replace(/^cover:\s*.*$/m, `cover: ${coverPath}`);
  }
  return content.replace(/^---\s*\r?\n/, `---\ncover: ${coverPath}\n`);
}

if (!['post', 'essay'].includes(layout)) {
  fail('Layout must be post or essay.');
}

if (!title || !coverInput) {
  fail('Title and cover image path are required.');
}

const coverSource = resolveInputFile(coverInput);
const before = listMarkdownFiles();

execFileSync(
  process.execPath,
  [path.join(root, 'node_modules', 'hexo', 'bin', 'hexo'), 'new', layout, title],
  { cwd: root, stdio: 'inherit' }
);

const after = listMarkdownFiles();
const created = [...after].filter(file => !before.has(file));
const postFile = created.length === 1 ? created[0] : newestMarkdownFile(created);

if (!postFile) {
  fail('Could not find the newly created Markdown file.');
}

const baseName = path.basename(postFile, '.md');
const assetDir = path.join(postsDir, baseName);
fs.mkdirSync(assetDir, { recursive: true });

const coverTarget = path.join(assetDir, 'cover.png');
fs.copyFileSync(coverSource, coverTarget);

let { content, value: abbrlink } = readFrontMatterValueWithRetry(postFile, 'abbrlink');

if (!abbrlink) {
  fail(`Could not find abbrlink in ${postFile}.`);
}

const coverUrl = `/posts/${abbrlink}/cover.png`;
content = updateCover(content, coverUrl);
fs.writeFileSync(postFile, content, 'utf8');

console.log('');
console.log(`Created: ${path.relative(root, postFile)}`);
console.log(`Cover:   ${path.relative(root, coverTarget)}`);
console.log(`URL:     ${coverUrl}`);
console.log('');
console.log('Next: edit the Markdown file, then run npm run build.');
