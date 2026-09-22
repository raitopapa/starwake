import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
const root = fileURLToPath(new URL('..', import.meta.url)), dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true }); await mkdir(dist, { recursive: true });
for (const name of ['index.html','style.css','portal.js','manifest.webmanifest','sw.js','vertical','horizontal','shared','assets']) await cp(`${root}/${name}`, new URL(name, dist), { recursive: true });
await mkdir(new URL('tests/', dist), { recursive: true });
await cp(`${root}/tests/responsive.html`, new URL('tests/responsive.html', dist));
await writeFile(new URL('.nojekyll', dist), '');
// Small, closed module wrappers prevent duplicate names between independent modules.
for (const mode of ['vertical','horizontal']) {
  const modules = [['collision','shared/collision.js'], ['engine',`${mode}/src/engine.js`], ['render',`${mode}/src/render.js`], ['audio','shared/audio.js'], ['input',`${mode}/src/input.js`], ['storage',`${mode}/src/storage.js`], ['main',`${mode}/src/main.js`]];
  const chunks = [];
  for (const [name, file] of modules) {
    let code = await readFile(`${root}/${file}`, 'utf8');
    const names = [...code.matchAll(/^export (?:const|function|class) (\w+)/gm)].map(match => match[1]);
    code = code.replace(/^import \{([^}]+)\} from ['"]([^'"]+)['"];?/gm, (_, imports, path) => `const {${imports}} = __${path.split('/').pop().replace('.js','')};`).replace(/^export /gm, '');
    chunks.push(`const __${name} = (() => {\n${code}\nreturn {${names.join(',')}};\n})();`);
  }
  const code = chunks.join('\n'), css = await readFile(`${root}/${mode}/style.css`, 'utf8');
  new Script(code, {filename:`${mode}-standalone.js`});
  let html = await readFile(`${root}/${mode}/index.html`, 'utf8');
  html = html.replace('<link rel="stylesheet" href="./style.css">', () => `<style>${css}</style>`)
    .replace('<script type="module" src="./src/main.js"></script>', () => `<script type="module">${code.replaceAll('</script','<\\/script')}</script>`)
    .replace(/  <link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>\n/g, '')
    .replace('class="brand" href="../"', 'class="brand" href="./index.html"');
  // Standalone files opened over HTTP also should not register a worker outside their directory.
  html = html.replace("register('../sw.js',{scope:'../'})", "register('./sw.js')");
  await writeFile(new URL(`starwake-${mode}-standalone.html`, dist), html);
}
console.log('Built dist/: ARCADE portal, independent ZENITH + HORIZON games, and two standalone HTML files.');
