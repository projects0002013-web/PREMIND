import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = await readdir("dist/assets");
const index = await readFile("dist/index.html");
const version = createHash("sha256").update(index).digest("hex").slice(0, 12);
const assets = [
  "./",
  "./index.html",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./manifest.webmanifest",
  ...files.map((f) => "./assets/" + f),
];
await writeFile(
  "dist/sw.js",
  `const CACHE='premind-${version}';const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('premind-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request,{ignoreVary:true}).then(cached=>cached||fetch(e.request).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):Response.error())))});
`,
);
