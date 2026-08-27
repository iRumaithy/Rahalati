const BUILD_VERSION='3.2.2';
const CACHE=`rahalati-shell-v${BUILD_VERSION}`;
const CORE=['./','./index.html','./app.css','./config.js','./app.js','./release-bridge.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rahalati-shell-v')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET')return;
  if(url.hostname.includes('supabase.co')||url.hostname.includes('jsdelivr.net')){event.respondWith(fetch(req).catch(()=>caches.match(req)));return}
  if(url.origin===self.location.origin){event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res}).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));}
});

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?.json?.()||{}}catch{try{data={body:event.data?.text?.()||''}}catch{}}
  const title=data.title||'رحلاتي';
  const options={
    body:data.body||'لديك إشعار جديد في رحلاتي.',
    icon:'./icon-192.png',
    badge:'./icon-192.png',
    tag:data.tag||`rahalati-${Date.now()}`,
    renotify:true,
    data:{url:data.url||'./',kind:data.kind||'general',version:data.version||''}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification?.data?.url||'./',self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      try{if('focus' in client){await client.focus();if('navigate' in client)await client.navigate(target);return}}catch{}
    }
    if(self.clients.openWindow)return self.clients.openWindow(target);
  })());
});
