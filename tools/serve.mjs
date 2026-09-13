import http from 'node:http';
import path from 'node:path';
import { stat, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.env.STARWAKE_ROOT || fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer(async (req,res) => {
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let target=path.resolve(root, `.${pathname}`);
    if(!target.startsWith(root+path.sep)&&target!==root)throw new Error('outside root');
    if(path.relative(root,target).split(path.sep).some(part=>part.startsWith('.')))throw new Error('hidden path');
    if((await stat(target)).isDirectory())target=path.join(target,'index.html');
    const bytes=await readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
}).listen(port,'0.0.0.0',()=>console.log(`STARWAKE available at http://localhost:${port}`));
