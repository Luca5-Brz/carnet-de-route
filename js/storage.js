import {empty, migrate, validate} from './data.js';
let db;
export async function open() {
    db = await new Promise((resolve,reject)=>{
        const request=indexedDB.open('carnet-route',1);
        request.onupgradeneeded=()=>request.result.createObjectStore('state');
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
        request.onblocked=()=>reject(Error('Fermez les autres onglets pour ouvrir la base.'));
    });
    const existing = await new Promise((resolve,reject)=>{
        const r=db.transaction('state').objectStore('state').get('data');
        r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
    });
    if (existing) return validate({version:2,data:existing});
    const legacy=localStorage.getItem('carnet-route-demo-v1');
    const data=legacy ? migrate(JSON.parse(legacy)) : empty();
    await write(data); // Retain the legacy copy until the user chooses to remove it.
    return data;
}
export function write(data) {
    const clean=validate({version:2,data});
    return new Promise((resolve,reject)=>{
        const tx=db.transaction('state','readwrite');
        tx.objectStore('state').put(clean,'data');
        tx.oncomplete=()=>resolve(clean);
        tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error||Error('Enregistrement interrompu.'));
    });
}
