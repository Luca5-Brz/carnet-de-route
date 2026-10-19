export const empty = () => ({vehicles: [], events: [], trips: []});
export const distance = t => t.end - t.start;
export const total = trips => trips.reduce((sum, t) => sum + distance(t), 0);
const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
export function validate(input) {
    if (!input || input.version !== 1 || !input.data) throw Error('Format de sauvegarde non reconnu (version 1 requise).');
    const d = input.data;
    for (const type of ['vehicles','events','trips']) {
        if (!Array.isArray(d[type])) throw Error(`Liste ${type} manquante.`);
        const ids = new Set();
        for (const x of d[type]) {
            if (!x || typeof x.id !== 'string' || !x.id || ids.has(x.id)) throw Error('Identifiant absent ou dupliqué.');
            ids.add(x.id);
            if (type !== 'trips' && (typeof x.name !== 'string' || !x.name.trim())) throw Error('Nom obligatoire.');
            if (type === 'vehicles' && typeof x.plate !== 'string') throw Error('Immatriculation invalide.');
            if (type === 'events' && (!validDate(x.date) || typeof x.place !== 'string')) throw Error('Date ou lieu de l’événement invalide.');
            if (type === 'trips' && (!validDate(x.date) || !Number.isSafeInteger(x.start) || !Number.isSafeInteger(x.end) || x.start < 0 || x.end < x.start || typeof x.note !== 'string')) throw Error('Date, compteurs ou remarque du trajet invalides.');
        }
    }
    for (const t of d.trips) if (!d.vehicles.some(v => v.id === t.vehicle) || !d.events.some(e => e.id === t.event)) throw Error('Un trajet référence un véhicule ou événement absent.');
    return structuredClone({vehicles:d.vehicles.map(({id,name,plate})=>({id,name,plate})),events:d.events.map(({id,name,date,place})=>({id,name,date,place})),trips:d.trips.map(({id,vehicle,event,date,start,end,note})=>({id,vehicle,event,date,start,end,note}))});
}
export function groups(d) {
    return [...d.events].sort((a,b)=>b.date.localeCompare(a.date)||a.name.localeCompare(b.name)).map(event=>{
        const trips = d.trips.filter(t=>t.event===event.id);
        return {event,total:total(trips),vehicles:d.vehicles.map(vehicle=>{
            const rows=trips.filter(t=>t.vehicle===vehicle.id).sort((a,b)=>b.date.localeCompare(a.date));
            return {vehicle,trips:rows,total:total(rows)};
        }).filter(v=>v.trips.length)};
    });
}
export const backup = d => JSON.stringify({version:1,exportedAt:new Date().toISOString(),data:d},null,2);
export function csv(d) {
    const cell = value => '"' + String(value).replace(/^[=+\-@\t\r\n]/,"'$&").replaceAll('"','""') + '"';
    const rows=[['Événement','Date événement','Lieu','Véhicule','Immatriculation','Date trajet','Départ (km)','Arrivée (km)','Distance (km)','Remarque']];
    for (const g of groups(d)) for (const v of g.vehicles) for (const t of v.trips) rows.push([g.event.name,g.event.date,g.event.place,v.vehicle.name,v.vehicle.plate,t.date,t.start,t.end,distance(t),t.note]);
    return '\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n');
}
export function migrate(old) {
    const d = structuredClone(old);
    d.vehicles = d.vehicles.map(v=>({...v,plate:v.plate||''}));
    d.events = d.events.map(e=>({...e,date:e.date||d.trips.filter(t=>t.event===e.id).map(t=>t.date).sort().at(-1)||new Date().toISOString().slice(0,10),place:e.place||''}));
    return validate({version:1,data:d});
}
