import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
test('every HUD and dialog binding exists in the HTML',async()=>{
  const html=await readFile(new URL('index.html',root),'utf8'),js=await readFile(new URL('src/main.js',root),'utf8');
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'duplicate IDs');
  for(const match of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(match[1]),`Missing #${match[1]}`);
});
test('all offline precache resources and install icons exist',async()=>{
  const worker=await readFile(new URL('sw.js',root),'utf8');
  const list=worker.match(/const ASSETS = \[(.+)\];/)[1];
  for(const match of list.matchAll(/'([^']+)'/g))await access(new URL(match[1],root));
  const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
  for(const icon of manifest.icons)await access(new URL(icon.src,root));
  assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');
});
