import {readFile,writeFile,copyFile} from 'node:fs/promises';
const index=await readFile('public/index.html','utf8');
await writeFile('dist/fixture.html',index.replace('<script type="module" src="/app.js"></script>','<script type="module" src="/fixture.js"></script>'));
for(const file of ['fixture.js','matrix.html','matrix.js'])await copyFile('tests/ui/'+file,'dist/'+file);

for(const [src,dst] of [['tests/media/square.mp4','qa-square.mp4'],['tests/media/portrait.mp4','qa-portrait.mp4']])await copyFile(src,'dist/'+dst);
