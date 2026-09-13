import { cp, mkdir, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),dist=new URL('../dist/',import.meta.url);
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const name of ['index.html','style.css','manifest.webmanifest','sw.js','src','assets'])await cp(`${root}/${name}`,new URL(name,dist),{recursive:true});
await writeFile(new URL('.nojekyll',dist),'');
// Optional downloadable version: the same source, with no module fetches or CDN.
const modules=['engine','render','audio','input','storage','main'];
const code=(await Promise.all(modules.map(name=>readFile(`${root}/src/${name}.js`,'utf8')))).map(text=>text.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'')).join('\n');
const css=await readFile(`${root}/style.css`,'utf8');
let html=await readFile(`${root}/index.html`,'utf8');
html=html.replace('<link rel="stylesheet" href="./style.css">',`<style>${css}</style>`).replace('<script type="module" src="./src/main.js"></script>',`<script type="module">${code.replaceAll('</script','<\\/script')}</script>`).replace('class="brand" href="./"','class="brand" href="#"').replace(/  <link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>\n/g,'');
await writeFile(new URL('starwake-standalone.html',dist),html);
const total=(await Promise.all(['index.html','style.css','src/engine.js','src/render.js','src/main.js','src/audio.js','src/input.js','src/storage.js'].map(name=>stat(new URL(name,dist))))).reduce((sum,item)=>sum+item.size,0);
console.log(`Built dist/ (${(total/1024).toFixed(1)} KB HTML/CSS/JS, zero runtime dependencies)`);
