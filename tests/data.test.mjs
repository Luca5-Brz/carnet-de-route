import test from 'node:test';
import assert from 'node:assert/strict';
import {distance,total,groups,validate,backup,csv,migrate} from '../js/data.js';
const data={vehicles:[{id:'v1',name:'Fourgon',plate:'ABC'},{id:'v2',name:'Auto',plate:''}],events:[{id:'e1',name:'Ancien',date:'2026-01-01',place:''},{id:'e2',name:'Récent',date:'2026-02-01',place:'Liège'}],trips:[{id:'t1',vehicle:'v1',event:'e2',date:'2026-02-02',start:100,end:125,note:'Bonjour; "Excel"\nLigne 2'},{id:'t2',vehicle:'v2',event:'e2',date:'2026-02-03',start:50,end:70,note:''},{id:'t3',vehicle:'v1',event:'e1',date:'2026-01-01',start:0,end:10,note:''}]};
test('distances nulles et totaux',()=>{assert.equal(distance({start:10,end:10}),0);assert.equal(total(data.trips),55);});
test('hiérarchie événement / véhicule / trajets, dates décroissantes et totaux',()=>{const g=groups(data);assert.deepEqual(g.map(g=>g.event.id),['e2','e1']);assert.equal(g[0].total,45);assert.deepEqual(g[0].vehicles.map(v=>[v.vehicle.id,v.total,v.trips.length]),[['v1',25,1],['v2',20,1]]);});
test('sauvegarde JSON complète sans perte',()=>assert.deepEqual(validate(JSON.parse(backup(data))),data));
test('validation : format, références, doublons, dates, distances et compteurs',()=>{
 for(const mutate of [x=>x.version=2,x=>x.data.trips[0].end=99,x=>x.data.trips[0].start=-1,x=>x.data.trips[0].start=1.5,x=>x.data.trips[0].vehicle='absent',x=>x.data.events[0].date='2026-02-30',x=>x.data.vehicles.push(x.data.vehicles[0]),x=>delete x.data.events,x=>x.data.vehicles[0].name='  ']){const x=JSON.parse(backup(data));mutate(x);assert.throws(()=>validate(x));}
});
test('CSV Excel : BOM, séparateur, échappement, accents et formules neutralisées',()=>{const d=structuredClone(data);d.events[1].name='=CMD';const text=csv(d);assert.ok(text.startsWith('\uFEFF'));assert.ok(text.includes('"\'=CMD"'));assert.ok(text.includes('"Bonjour; ""Excel""\nLigne 2"'));assert.equal(text.split('\r\n').length,4);});
test('migration du prototype : trajets conservés et date événement inférée',()=>{const legacy=structuredClone(data);delete legacy.events[1].date;delete legacy.events[1].place;const migrated=migrate(legacy);assert.equal(migrated.events[1].date,'2026-02-03');assert.deepEqual(migrated.trips,data.trips);});
