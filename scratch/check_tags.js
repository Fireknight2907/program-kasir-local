const fs = require('fs');
const pageCode = fs.readFileSync('./src/app/page.js', 'utf8');

const voidElements = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
const lines = pageCode.split('\n');
const tagStack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const matches = line.matchAll(/<\/?([A-Za-z0-9.]+)[^>]*\/?>/g);
  for (let match of matches) {
    const full = match[0];
    const tagName = match[1].toLowerCase();
    if (full.endsWith('/>') || full.startsWith('<?') || voidElements.has(tagName)) continue;
    if (full.startsWith('</')) {
      if (tagStack.length > 0 && tagStack[tagStack.length - 1].name === tagName) {
        tagStack.pop();
      } else {
        console.log(`L${i + 1} Mismatch closing </${tagName}>, expected top:`, tagStack[tagStack.length - 1]);
      }
    } else {
      tagStack.push({ name: tagName, line: i + 1 });
    }
  }
}

console.log('Unclosed tags at end:', tagStack);
