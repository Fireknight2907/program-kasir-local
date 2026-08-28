const fs = require('fs');
const pageCode = fs.readFileSync('./src/app/page.js', 'utf8');
const parser = require('next/dist/compiled/babel/parser');

const base = pageCode.trim();

const suffixes = [
  '}',
  ');\n}',
  '</div>\n);\n}',
  '}\n</div>\n);\n}',
  ')}\n</div>\n);\n}',
  '};',
  '})()',
  '}'
];

for (let s of suffixes) {
  try {
    parser.parse(base + '\n' + s, { sourceType: 'module', plugins: ['jsx'] });
    console.log('MATCHED SUFFIX:', JSON.stringify(s));
  } catch (err) {
    // console.log('Suffix failed:', JSON.stringify(s), err.message);
  }
}
