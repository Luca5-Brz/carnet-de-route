const CACHE = 'carnet-route-shell-v1.1.1';
const ASSETS = ['./','./index.html','./css/style.css','./js/app.js','./js/data.js','./js/storage.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{
    event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
    event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('carnet-route-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
    if(event.request.method!=='GET')return;
    const url=new URL(event.request.url);
    if(url.origin!==self.location.origin || !url.href.startsWith(self.registration.scope))return;
    event.respondWith(caches.open(CACHE).then(async cache=>{
        const cached=await cache.match(event.request);
        if(cached)return cached;
        try{return await fetch(event.request);}catch(error){
            if(event.request.mode==='navigate')return cache.match('./index.html');
            throw error;
        }
    }));
});
