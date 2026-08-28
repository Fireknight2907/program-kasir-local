const fs = require('fs');
const pageCode = fs.readFileSync('./src/app/page.js', 'utf8');

const lines = pageCode.split('\n');
let curly = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let inString = false;
  let strChar = '';
  const prevC = curly;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if ((ch === '"' || ch === "'" || ch === '`') && (j === 0 || line[j-1] !== '\\')) {
      if (!inString) {
        inString = true;
        strChar = ch;
      } else if (strChar === ch) {
        inString = false;
      }
    }
    if (!inString) {
      if (ch === '{') curly++;
      if (ch === '}') curly--;
    }
  }
  if (i > 220 && i < 480) {
    console.log(`L${i + 1} (curly:${curly}): ${line}`);
  }
}
