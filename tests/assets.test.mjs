import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
for(const mode of ['vertical','horizontal']){
  test(`${mode}: HUD bindings, unique IDs and local imports resolve`,async()=>{
    const html=await readFile(new URL(`${mode}/index.html`,root),'utf8'),js=await readFile(new URL(`${mode}/src/main.js`,root),'utf8');
    const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
    for(const match of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(match[1]),`Missing #${match[1]}`);
    for(const name of ['main','engine','render','input','storage']){
      const url=new URL(`${mode}/src/${name}.js`,root),source=await readFile(url,'utf8');
      for(const match of source.matchAll(/from ['"]([^'"]+)['"]/g))await access(new URL(match[1],url));
    }
    const manifest=JSON.parse(await readFile(new URL(`${mode}/manifest.webmanifest`,root),'utf8'));
    assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');
    for(const icon of manifest.icons)await access(new URL(`${mode}/${icon.src}`,root));
  });
}
test('offline cache includes both games, shared audio, portal and covers',async()=>{
  const worker=await readFile(new URL('sw.js',root),'utf8'),list=worker.match(/const ASSETS = \[(.+)\];/)[1];
  for(const match of list.matchAll(/'([^']+)'/g))await access(new URL(match[1],root));
  for(const required of ['./vertical/index.html','./horizontal/index.html','./shared/audio.js','./assets/zenith-cover.png','./assets/horizon-cover.png'])assert.ok(list.includes(required));
  const portal=await readFile(new URL('index.html',root),'utf8');assert.match(portal,/href="\.\/vertical\/"/);assert.match(portal,/href="\.\/horizontal\/"/);
});
