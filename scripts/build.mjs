import {build} from 'esbuild';
import {mkdir,cp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Fingerprint application source. Vercel rewrites its hosting manifest; verify deployed headers separately.
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;out.push(...(e.isDirectory()?await files(p):[p]))}return out}
const names=[...(await files('public')),...(await files('lib')),...(await files('api')), ...(await files('scripts')),...(await files('supabase/functions')),...(await files('supabase/migrations')),'supabase/config.toml','package.json','package-lock.json'].sort();
const sourceFiles={};const hash=createHash('sha256');for(const p of names){hash.update(p+'\0');const bytes=await readFile(p);hash.update(bytes);sourceFiles[p]=createHash('sha256').update(bytes).digest('hex');hash.update('\0')}
const pkg=JSON.parse(await readFile('package.json','utf8'));
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
await build({entryPoints:['public/app.js'],bundle:true,format:'esm',target:'es2022',outfile:'dist/app.js',minify:true});
await writeFile('dist/release.json',JSON.stringify({version:pkg.version,sourceFingerprint:hash.digest('hex'),sourceFiles}));
