/**
 * strip-bom.js — Strip UTF-8 BOM from all .json files under a directory.
 * NapCat Shell ships JSON files with BOM; JSON.parse() rejects them.
 * Usage: node strip-bom.js [dir]
 */
import fs from 'fs'; import path from 'path';
const target = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let fixed = 0;
function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d,{withFileTypes:true})) {
    const f = path.join(d, e.name);
    if (e.isDirectory() && e.name!=='node_modules' && e.name!=='static') walk(f);
    else if (e.name.endsWith('.json')) {
      try {
        let c = fs.readFileSync(f, 'utf8');
        if (c.charCodeAt(0) === 0xFEFF) { fs.writeFileSync(f, c.slice(1), 'utf8'); fixed++; }
      } catch {}
    }
  }
}
walk(target);
console.log('strip-bom: ' + fixed + ' files fixed');
process.exit(0);