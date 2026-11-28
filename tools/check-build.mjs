import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('dist'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/Loggin/);assert.doesNotMatch(html,/(?:src|href)="\/(?!\/)/,'build must also work under a repository subpath');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
 const url=match[1];if(/^(?:https?:|data:)/.test(url))continue;
 assert.ok(fs.existsSync(path.join(root,url)),`Missing entry asset: ${url}`);
}
for(const file of ['pennant/outfitter-day.webp','pennant/outfitter-night.webp','changelog/working-birch.webp','changelog/running-grip.webp','changelog/directional-cuts.webp','changelog/directional-cuts.mp4','changelog/woodland-workwear.webp','changelog/fireside-kit.webp','changelog/shoulder-aim.webp','changelog/held-axe.webp','changelog/held-axe.mp4','changelog/interior.webp','changelog/chopping.webp','changelog/camp.webp','changelog/river.webp','figure/starter-man.glb','figure/starter-man-clips.glb','audio/axe-1.wav','audio/axe-2.wav','audio/axe-3.wav','audio/axe-4.wav','audio/trunk-crack.wav','audio/fall-rush.wav','audio/tree-land.wav','LICENSE.txt','LICENCE-NOTES.md','THIRD-PARTY-NOTICES.md']){
 const bytes=fs.readFileSync(path.join(root,file));assert.ok(bytes.length>0,`Missing ${file}`);assert.ok(!bytes.toString('utf8',0,100).includes('git-lfs.github.com/spec'),'release must contain actual assets');
}
console.log('Loggin’ build verified: entry assets, repository-relative URLs, models, sounds and licences.');
