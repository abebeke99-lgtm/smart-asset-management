const fs = require('fs');
const path = require('path');
const root = path.join(process.cwd(), 'src');
const oldPattern = "process.env.REACT_APP_API_URL || 'http://localhost:3000'";
const newPattern = "process.env.REACT_APP_API_URL || ''";
const oldPattern2 = "const API_URL = '';";
const newPattern2 = "const API_URL = process.env.REACT_APP_API_URL || '';";
let patched = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (full.endsWith('.js')) {
      let text = fs.readFileSync(full, 'utf8');
      let updated = text;
      if (text.includes(oldPattern)) updated = updated.split(oldPattern).join(newPattern);
      if (text.includes(oldPattern2) && full.endsWith(path.join('src', 'components', 'DataContext.js'))) updated = updated.split(oldPattern2).join(newPattern2);
      if (updated !== text) {
        fs.writeFileSync(full, updated, 'utf8');
        patched.push(path.relative(process.cwd(), full));
      }
    }
  }
}
walk(root);
console.log('patched', patched.length, 'files');
patched.forEach(f => console.log(f));
