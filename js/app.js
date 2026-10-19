import {distance,total,groups,backup,csv,validate} from './data.js';
import {open,write} from './storage.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const km=n=>n.toLocaleString('fr-BE')+' km';
const date=s=>new Date(s+'T12:00:00').toLocaleDateString('fr-BE');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
let data,page='home',edit=null,busy=false;
const titles={home:'Carnet de route',trip:'Nouveau trajet',history:'Historique',manage:'Gestion',vehicle:'Véhicule',event:'Événement'};
function message(text,error=false){$('#message').textContent=text;$('#message').className=error?'error':'success';}
function go(next,id=null){page=next;edit=id;render();window.scrollTo(0,0);$('#title').focus();}
const button=(label,action,id='',cls='link')=>`<button type="button" class="${cls}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
function field(label,name,value='',type='text',required=true){return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${type==='number'?'min="0" step="1" max="9007199254740991"':'maxlength="500"'}></div>`;}
function tripForm(){
 const t=data.trips.find(t=>t.id===edit)||{date:today(),start:'',end:'',note:''};
 if(!data.vehicles.length||!data.events.length)return `<div class="card empty">Ajoutez d’abord un véhicule et un événement dans Gestion.${button('Ouvrir la gestion','manage')}</div>`;
 const select=(label,name,list)=>`<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}" required>${list.map(x=>`<option value="${esc(x.id)}" ${x.id===t[name]?'selected':''}>${esc(x.name)}${name==='event'?' · '+date(x.date):''}</option>`).join('')}</select></div>`;
 return `<form data-form="trip">${select('Véhicule','vehicle',data.vehicles)}${select('Événement','event',[...data.events].sort((a,b)=>b.date.localeCompare(a.date)))}${field('Date du trajet','date',t.date,'date')}${field('Compteur de départ (km)','start',t.start,'number')}${field('Compteur d’arrivée (km)','end',t.end,'number')}<div class="distance">Distance calculée<output id="distance">— km</output></div><div class="field"><label for="note">Remarque (facultative)</label><textarea id="note" name="note" maxlength="5000">${esc(t.note)}</textarea></div><button class="primary">Enregistrer le trajet</button>${edit?button('Supprimer ce trajet','delete-trip',edit,'danger'):''}</form>`;
}
function management(){return `<h2>Véhicules</h2><div class="card">${data.vehicles.map(v=>`<div class="listrow"><div><b>${esc(v.name)}</b><small>${esc(v.plate||'Sans immatriculation')}</small></div>${button('Modifier','vehicle',v.id)}</div>`).join('')||'<p class="empty">Aucun véhicule</p>'}</div>${button('＋ Ajouter un véhicule','vehicle')}<h2>Événements</h2><div class="card">${groups(data).map(({event:e})=>`<div class="listrow"><div><b>${esc(e.name)}</b><small>${date(e.date)}${e.place?' · '+esc(e.place):''}</small></div>${button('Modifier','event',e.id)}</div>`).join('')||'<p class="empty">Aucun événement</p>'}</div>${button('＋ Ajouter un événement','event')}<h2>Sauvegardes</h2><div class="card backups">${button('Exporter CSV (Excel)','csv')}${button('Sauvegarder JSON','json')}<label class="file-label" for="restore">Restaurer une sauvegarde JSON</label><input id="restore" type="file" accept="application/json,.json"><p class="muted">La restauration remplace toutes les données après validation et confirmation. Exportez d’abord votre sauvegarde.</p></div><h2>Installation sur iPhone</h2><p class="muted">Dans Safari : Partager → Sur l’écran d’accueil. Ouvrez une première fois avec Internet, puis attendez la confirmation « Hors ligne prêt ».</p>`;}
function entityForm(type){const plural=type==='vehicle'?'vehicles':'events',x=data[plural].find(x=>x.id===edit)||{name:'',plate:'',date:today(),place:''};return `<form data-form="${type}">${field('Nom','name',x.name)}${type==='vehicle'?field('Immatriculation (facultative)','plate',x.plate,'text',false):field('Date de l’événement','date',x.date,'date')+field('Lieu (facultatif)','place',x.place,'text',false)}<button class="primary">Enregistrer</button>${edit?button('Supprimer','delete-'+type,edit,'danger'):''}</form>`;}
function history(){return groups(data).map(g=>`<section class="card event-group"><header><div><h2>${esc(g.event.name)}</h2><small>${date(g.event.date)}${g.event.place?' · '+esc(g.event.place):''}</small></div><strong>${km(g.total)}</strong></header>${g.vehicles.map(v=>`<section class="vehicle-group"><div class="row"><h3>${esc(v.vehicle.name)}</h3><b>${km(v.total)}</b></div>${v.trips.map(t=>`<button class="trip" data-action="trip" data-id="${esc(t.id)}"><span><strong>${date(t.date)}</strong><small>${km(t.start)} → ${km(t.end)}${t.note?'<br>'+esc(t.note):''}</small></span><strong>${km(distance(t))} ›</strong></button>`).join('')}</section>`).join('')||'<p class="empty">Aucun trajet pour cet événement</p>'}</section>`).join('')||'<p class="empty">Aucun événement. Commencez dans Gestion.</p>';}
function render(){
 $('#title').textContent=page==='trip'&&edit?'Modifier le trajet':titles[page];
 $('#view').innerHTML=page==='home'?`<p class="eyebrow">VOTRE CARNET PERSONNEL</p><div class="stats"><div class="stat"><strong>${km(total(data.trips))}</strong><span>Total enregistré</span></div><div class="stat"><strong>${data.trips.length}</strong><span>Trajets</span></div></div>${button('＋ Nouveau trajet','trip','','primary')}<h2>Vos déplacements, simplement.</h2><p class="muted">Véhicules, événements et trajets restent sur cet appareil. Pensez à exporter régulièrement une sauvegarde.</p><div class="card menu">${button('Consulter l’historique','history')}${button('Véhicules, événements et sauvegardes','manage')}</div>`:page==='trip'?tripForm():page==='history'?history():page==='manage'?management():entityForm(page);
 $('#nav').innerHTML=[['home','⌂','Accueil'],['trip','＋','Nouveau trajet'],['history','◷','Historique'],['manage','⚙','Gestion']].map(([p,i,label])=>`<button data-action="${p}" ${page===p?'aria-current="page"':''}><b aria-hidden="true">${i}</b>${label}</button>`).join('');
 updateDistance();
}
function updateDistance(){const f=$('[data-form="trip"]');if(!f)return;const a=f.elements.start,b=f.elements.end; b.setCustomValidity(a.value!==''&&b.value!==''&&+b.value<+a.value?'Le compteur d’arrivée doit être supérieur ou égal au départ.':'');$('#distance').textContent=a.value!==''&&b.value!==''&&+b.value>=+a.value?km(+b.value-+a.value):'— km';}
async function commit(next){data=await write(next);message('Données enregistrées sur cet appareil.');}
function download(content,type,extension){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=`carnet-route-${today()}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('input',updateDistance);
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b||busy||!data)return;
 const action=b.dataset.action,id=b.dataset.id;
 try{
 if(action.startsWith('delete-')){
 const type=action.slice(7),list={trip:'trips',vehicle:'vehicles',event:'events'}[type];
 if(type!=='trip'&&data.trips.some(t=>t[type]===id)){message('Suppression impossible : cet élément est utilisé par des trajets. Modifiez leurs associations pour conserver les trajets.',true);return;}
 if(!confirm('Supprimer définitivement cet élément ?'))return;
 busy=true;const next=structuredClone(data);next[list]=next[list].filter(x=>x.id!==id);await commit(next);go(type==='trip'?'history':'manage');
 }else if(action==='csv')download(csv(data),'text/csv;charset=utf-8','csv');
 else if(action==='json')download(backup(data),'application/json','json');
 else go(action,id||null);
 }catch(error){message('Échec : '+error.message,true);}finally{busy=false;}
});
document.addEventListener('submit',async e=>{
 e.preventDefault();if(busy||!e.target.dataset.form)return;
 busy=true;const submit=e.target.querySelector('[type=submit],button.primary');submit.disabled=true;
 try{const type=e.target.dataset.form,x=Object.fromEntries(new FormData(e.target));for(const k in x)x[k]=x[k].trim();if(!x.name&&type!=='trip')throw Error('Le nom est obligatoire.');if(type==='trip'){x.start=Number(x.start);x.end=Number(x.end);}x.id=edit||crypto.randomUUID();const next=structuredClone(data),list={trip:'trips',vehicle:'vehicles',event:'events'}[type],index=next[list].findIndex(y=>y.id===x.id);if(index<0)next[list].push(x);else next[list][index]=x;await commit(next);go(type==='trip'?'history':'manage');}catch(error){message('Enregistrement impossible : '+error.message,true);}finally{busy=false;submit.disabled=false;}
});
document.addEventListener('change',async e=>{
 if(e.target.id!=='restore'||!e.target.files.length||busy)return;
 busy=true;
 try{const file=e.target.files[0];if(file.size>10*1024*1024)throw Error('Fichier trop volumineux (maximum 10 Mo).');const next=validate(JSON.parse(await file.text()));if(!confirm(`Remplacer les données actuelles par ${next.vehicles.length} véhicule(s), ${next.events.length} événement(s) et ${next.trips.length} trajet(s) ?`))return;await commit(next);go('manage');message('Sauvegarde restaurée.');}catch(error){message('Restauration refusée : '+error.message,true);}finally{busy=false;e.target.value='';}
});
try{data=await open();render();}catch(error){$('#view').innerHTML='<p class="error">Impossible d’ouvrir les données locales. Rechargez la page et vérifiez que le stockage du navigateur est autorisé. Les anciennes données n’ont pas été effacées.</p>';message(error.message,true);}
if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;$('#offline').textContent='Hors ligne prêt';}catch{$('#offline').textContent='Hors ligne indisponible : réessayez avec Internet.';}}
