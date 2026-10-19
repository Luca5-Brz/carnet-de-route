"""V1.1 functional regression: server and requirements are described in README."""
import json
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:8001/carnet-de-route/'
legacy={'vehicles':[{'id':'v1','name':'Fourgon','plate':'ABC'},{'id':'v2','name':'Auto','plate':''}], 'events':[{'id':'e','name':'Festival','date':'2026-10-01','place':''}], 'trips':[{'id':'old','vehicle':'v1','event':'e','date':'2026-10-01','start':10,'end':30,'note':'Ancien'}]}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},locale='fr-BE')
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.accept())
    page.goto(URL)
    page.wait_for_selector('#nav button')
    # Seed the V1 IndexedDB shape, then load through the application upgrade path.
    page.evaluate('''async d => {
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('carnet-route',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
      await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(d,'data');tx.oncomplete=resolve;tx.onerror=reject});db.close();
    }''',legacy)
    page.reload();page.wait_for_selector('#nav button')
    assert '20 km' in page.locator('.stats').inner_text()
    page.wait_for_function("document.querySelector('#offline').textContent === 'Hors ligne prêt'")
    def go(action):page.locator(f'#nav [data-action="{action}"]').click()
    def start(vehicle):
        go('trip');page.locator('#status').select_option('in-progress');page.locator('#vehicle').select_option(vehicle)
        page.locator('#start').fill('100');assert page.locator('#end').is_disabled()
        page.get_by_role('button',name='Enregistrer le trajet').click();page.wait_for_selector('.ongoing')
    start('v1')
    assert page.locator('.ongoing').count()==1
    go('trip');page.locator('#status').select_option('in-progress');page.locator('#start').fill('101')
    assert not page.locator('#vehicle').evaluate('(el)=>el.checkValidity()')
    start('v2');assert page.locator('.ongoing').count()==2
    assert '20 km' in page.locator('.stats').inner_text()
    go('history');assert page.locator('.trip').count()==3
    assert '20 km' in page.locator('.event-group header').inner_text()
    page.locator('.trip[data-status="in-progress"]').first.click()
    page.locator('#note').fill('Modification en cours');page.get_by_role('button',name='Enregistrer le trajet').click()
    page.wait_for_selector('.ongoing')
    go('manage')
    with page.expect_download() as download:page.get_by_role('button',name='Sauvegarder JSON').click()
    saved=json.loads(open(download.value.path()).read());assert saved['version']==2
    assert sum(t['status']=='in-progress' for t in saved['data']['trips'])==2
    page.locator('#restore').set_input_files({'name':'v2.json','mimeType':'application/json','buffer':json.dumps(saved).encode()})
    page.wait_for_function("document.querySelector('#message').textContent.includes('Sauvegarde restaurée')")
    go('home');assert page.locator('.ongoing').count()==2
    context.set_offline(True);page.reload();page.wait_for_selector('.ongoing')
    page.locator('.ongoing').first.get_by_role('button',name='Terminer le trajet').click()
    assert page.locator('form input').count()==1
    page.locator('#end').fill('99');assert not page.locator('#end').evaluate('(el)=>el.checkValidity()')
    page.locator('#end').fill('125');assert page.locator('#distance').inner_text()=='25 km'
    page.get_by_role('button',name='Terminer le trajet',exact=True).click();page.wait_for_selector('.ongoing')
    assert page.locator('.ongoing').count()==1
    assert '45 km' in page.locator('.stats').inner_text()
    page.reload();page.wait_for_selector('.ongoing');assert '45 km' in page.locator('.stats').inner_text()
    go('history');page.locator('.trip[data-status="in-progress"]').click()
    page.get_by_role('button',name='Supprimer ce trajet').click();page.wait_for_selector('.event-group')
    assert page.locator('.trip').count()==2
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    context.set_offline(False)
    go('manage')
    # A conflicting import is rejected without losing the completed trip.
    bad=json.loads(json.dumps(saved));bad['data']['trips'][-1]['vehicle']='v1'
    page.locator('#restore').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
    page.wait_for_function("document.querySelector('#message').textContent.includes('Restauration refusée')")
    go('home');assert '45 km' in page.locator('.stats').inner_text()
    go('manage')
    page.locator('#restore').set_input_files({'name':'v1.json','mimeType':'application/json','buffer':json.dumps({'version':1,'data':legacy}).encode()})
    page.wait_for_function("document.querySelector('#message').textContent.includes('Sauvegarde restaurée')")
    go('home');assert page.locator('.ongoing').count()==0;assert '20 km' in page.locator('.stats').inner_text()
    assert not errors,errors
    browser.close()
    print('PASS V1.1: old IndexedDB + JSON, concurrent vehicles, uniqueness, edit/delete, finish offline, totals, V2 restore, invalid import')
