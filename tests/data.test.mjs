import test from 'node:test';
import assert from 'node:assert/strict';
import {distance,total,groups,validate,backup,csv,migrate,inProgress,finishTrip} from '../js/data.js';
const data={vehicles:[{id:'v1',name:'Fourgon',plate:'ABC'},{id:'v2',name:'Auto',plate:''}],events:[{id:'e1',name:'Ancien',date:'2026-01-01',place:''},{id:'e2',name:'Récent',date:'2026-02-01',place:'Liège'}],trips:[{id:'t1',vehicle:'v1',event:'e2',date:'2026-02-02',start:100,end:125,note:'Bonjour; "Excel"\nLigne 2'},{id:'t2',vehicle:'v2',event:'e2',date:'2026-02-03',start:50,end:70,note:''},{id:'t3',vehicle:'v1',event:'e1',date:'2026-01-01',start:0,end:10,note:''}]};
test('distances nulles et totaux',()=>{assert.equal(distance({start:10,end:10}),0);assert.equal(total(data.trips),55);});
test('hiérarchie événement / véhicule / trajets, dates décroissantes et totaux',()=>{const g=groups(data);assert.deepEqual(g.map(g=>g.event.id),['e2','e1']);assert.equal(g[0].total,45);assert.deepEqual(g[0].vehicles.map(v=>[v.vehicle.id,v.total,v.trips.length]),[['v1',25,1],['v2',20,1]]);});
test('sauvegarde JSON complète sans perte',()=>assert.deepEqual(validate(JSON.parse(backup(data))),validate({version:1,data})));
test('validation : format, références, doublons, dates, distances et compteurs',()=>{
 for(const mutate of [x=>x.version=3,x=>x.data.trips[0].end=99,x=>x.data.trips[0].start=-1,x=>x.data.trips[0].start=1.5,x=>x.data.trips[0].vehicle='absent',x=>x.data.events[0].date='2026-02-30',x=>x.data.vehicles.push(x.data.vehicles[0]),x=>delete x.data.events,x=>x.data.vehicles[0].name='  ']){const x=JSON.parse(backup(data));mutate(x);assert.throws(()=>validate(x));}
});
test('CSV Excel : BOM, séparateur, échappement, accents et formules neutralisées',()=>{const d=structuredClone(data);d.events[1].name='=CMD';const text=csv(d);assert.ok(text.startsWith('\uFEFF'));assert.ok(text.includes('"\'=CMD"'));assert.ok(text.includes('"Bonjour; ""Excel""\nLigne 2"'));assert.equal(text.split('\r\n').length,4);});
test('migration du prototype : trajets conservés et date événement inférée',()=>{const legacy=structuredClone(data);delete legacy.events[1].date;delete legacy.events[1].place;const migrated=migrate(legacy);assert.equal(migrated.events[1].date,'2026-02-03');assert.deepEqual(migrated.trips,validate({version:1,data}).trips);});
const active = (id,vehicle='v1') => ({id,vehicle,event:'e2',date:'2026-02-04',start:200,end:null,note:'À terminer',status:'in-progress'});
test('anciens trajets et sauvegardes V1 normalisés comme terminés sans perte',()=>{
 const normalized=validate({version:1,data});
 assert.ok(normalized.trips.every(t=>t.status==='completed'));
 assert.deepEqual(normalized.trips.map(({status,...t})=>t),data.trips);
});
test('plusieurs trajets en cours, un seul par véhicule ; contrôle aussi en modification/import',()=>{
 const d=structuredClone(data);d.trips.push(active('a'),active('b','v2'));
 const valid=validate({version:2,data:d});assert.equal(valid.trips.filter(inProgress).length,2);
 d.trips.push(active('c'));assert.throws(()=>validate({version:2,data:d}),/Un seul trajet/);
 d.trips.pop();d.trips.at(-1).vehicle='v1';assert.throws(()=>validate({version:2,data:d}),/Un seul trajet/);
});
test('trajets en cours visibles dans la hiérarchie, exclus de tous les totaux et CSV explicite',()=>{
 const d=structuredClone(data);d.trips.push(active('a'));
 assert.equal(distance(d.trips.at(-1)),0);assert.equal(total(d.trips),55);
 const g=groups(d)[0];assert.equal(g.total,45);assert.equal(g.vehicles[0].total,25);assert.equal(g.vehicles[0].trips.length,2);
 const text=csv(d);assert.ok(text.includes('"200";"";"";"En cours"'));assert.ok(text.includes('"Terminé"'));
});
test('terminer un trajet valide l’arrivée, conserve ses données et libère le véhicule',()=>{
 const d=structuredClone(data);d.trips.push(active('a'));
 for(const end of [199,-1,NaN,Infinity,200.5,null,'250'])assert.throws(()=>finishTrip(d,'a',end));
 const done=finishTrip(d,'a',225);assert.equal(done.trips.at(-1).status,'completed');assert.equal(total(done.trips),80);
 assert.deepEqual(done.trips.at(-1),{...active('a'),status:'completed',end:225});
 assert.equal(d.trips.at(-1).end,null);assert.equal(distance(finishTrip(d,'a',200).trips.at(-1)),0);
 assert.throws(()=>finishTrip(done,'a',250));assert.throws(()=>finishTrip(d,'absent',250));
 done.trips.push(active('b'));assert.doesNotThrow(()=>validate({version:2,data:done}));
});
test('JSON V2 : aller-retour des deux statuts et rejet des états incohérents',()=>{
 const d=structuredClone(data);d.trips.push(active('a'));
 const saved=JSON.parse(backup(d));assert.equal(saved.version,2);assert.deepEqual(validate(saved),validate({version:2,data:d}));
 for(const change of [t=>t.status='unknown',t=>t.end=210,t=>t.start=-1,t=>t.vehicle='absent',t=>delete t.end,t=>t.status='completed']){
 const bad=structuredClone(saved);change(bad.data.trips.at(-1));assert.throws(()=>validate(bad));
 }
});
