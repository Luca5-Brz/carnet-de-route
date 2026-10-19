"""Run with a server exposing /workspace on port 8001; requires Playwright + Chromium."""
import json
import os
from playwright.sync_api import sync_playwright
URL = 'http://127.0.0.1:8001/carnet-de-route/'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE_PATH'), args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':390,'height':844}, locale='fr-BE', accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(URL)
    page.wait_for_function("document.querySelector('#offline').textContent === 'Hors ligne prêt'")
    def go(action):
        page.locator(f'#nav [data-action="{action}"]').click()
    def save():
        page.locator('button.primary').click()
        page.wait_for_function("!document.querySelector('form')")
    go('manage')
    page.get_by_role('button',name='Ajouter un véhicule').click()
    page.locator('#name').fill('Fourgon')
    page.locator('#plate').fill('ABC-123')
    save()
    page.get_by_role('button',name='Ajouter un événement').click()
    page.locator('#name').fill('Festival')
    page.locator('#date').fill('2026-10-01')
    page.locator('#place').fill('Liège')
    save()
    go('trip')
    page.locator('#start').fill('100')
    page.locator('#end').fill('90')
    assert not page.locator('#end').evaluate('(el)=>el.checkValidity()')
    page.locator('#end').fill('125')
    page.locator('#note').fill('Transport matériel')
    assert page.locator('#distance').inner_text() == '25 km'
    save()
    assert page.locator('.event-group header').inner_text().count('25 km') == 1
    assert page.locator('.vehicle-group').count() == 1
    page.locator('.trip').click()
    page.locator('#end').fill('130')
    save()
    assert '30 km' in page.locator('.event-group header').inner_text()
    go('manage')
    page.locator('[data-action="vehicle"][data-id]:not([data-id=""])').click()
    page.locator('#name').fill('Fourgon modifié')
    save()
    page.locator('[data-action="vehicle"][data-id]:not([data-id=""])').click()
    page.get_by_role('button',name='Supprimer',exact=True).click()
    assert 'Suppression impossible' in page.locator('#message').inner_text()
    go('manage')
    with page.expect_download() as download:
        page.get_by_role('button',name='Sauvegarder JSON').click()
    saved = json.loads(open(download.value.path()).read())
    assert saved['data']['trips'][0]['end'] == 130
    with page.expect_download() as download:
        page.get_by_role('button',name='Exporter CSV').click()
    assert open(download.value.path(),encoding='utf-8-sig').read().count('Fourgon modifié') == 1
    page.locator('#restore').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"version":1,"data":{}}'})
    page.wait_for_function("document.querySelector('#message').textContent.includes('Restauration refusée')")
    page.locator('#restore').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(saved).encode()})
    page.wait_for_function("document.querySelector('#message').textContent.includes('Sauvegarde restaurée')")
    context.set_offline(True)
    page.reload()
    page.wait_for_selector('#nav button')
    go('history')
    assert 'Fourgon modifié' in page.locator('#view').inner_text()
    go('trip')
    page.locator('#start').fill('130')
    page.locator('#end').fill('140')
    save()
    assert page.locator('.trip').count() == 2
    page.reload()
    page.wait_for_selector('#nav button')
    go('history')
    assert page.locator('.trip').count() == 2
    assert '40 km' in page.locator('.event-group header').inner_text()
    page.locator('.trip').first.click()
    page.get_by_role('button',name='Supprimer ce trajet').click()
    page.wait_for_selector('.event-group')
    assert page.locator('.trip').count() == 1
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    context.close()
    # A fresh profile migrates existing prototype data without seeding demo records.
    context=browser.new_context()
    context.add_init_script("""if (!localStorage.getItem('carnet-route-demo-v1')) localStorage.setItem('carnet-route-demo-v1', JSON.stringify({vehicles:[{id:'v',name:'Ancien',plate:'P'}], events:[{id:'e',name:'Événement'}],trips:[{id:'t',vehicle:'v',event:'e',date:'2026-01-01',start:1,end:3,note:''}]}));""")
    page=context.new_page()
    page.goto(URL)
    page.wait_for_selector('#nav button')
    assert '2 km' in page.locator('#view').inner_text()
    assert page.evaluate("localStorage.getItem('carnet-route-demo-v1') !== null")
    browser.close()
    print('PASS: CRUD, validation, hierarchy, exports, restore, migration, offline reload + writes, mobile layout')
