'use strict';
/* Une el motor probado con la página: node build.js */
const fs = require('fs'), path = require('path');
const dir = __dirname;
const engine = fs.readFileSync(path.join(dir, 'engine.js'), 'utf8')
  .replace(/^'use strict';\n/, '')
  .replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
const src = fs.readFileSync(path.join(dir, 'page.src.html'), 'utf8');
if (!src.includes('/*__ENGINE__*/')) throw new Error('falta el marcador del motor');
fs.writeFileSync(path.join(dir, 'laboratorio-des.html'), src.replace('/*__ENGINE__*/', () => "'use strict';\n" + engine));
console.log('laboratorio-des.html', fs.statSync(path.join(dir, 'laboratorio-des.html')).size, 'bytes');
