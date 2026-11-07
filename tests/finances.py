"""V1.3: finance migration, CRUD, backups and persistence offline at iPhone width."""
import json
import os
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:8001/carnet-de-route/'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE_PATH'))
    context = browser.new_context(viewport={'width': 320, 'height': 740}, locale='fr-BE')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL)
    page.wait_for_selector('#nav button')
    def go(action):
        page.locator(f'#nav [data-action="{action}"]').click()
    def balance(value):
        page.wait_for_selector('#finance-balance')
        assert value in page.locator('#finance-balance').inner_text()
    go('finances')
    balance('0,00')
    page.get_by_role('button', name='Modifier le solde initial').click()
    page.locator('#openingBalance').fill('100.01')
    page.get_by_role('button', name='Enregistrer le solde initial').click()
    balance('100,01')
    page.wait_for_function("document.querySelector('#offline').textContent === 'Hors ligne prêt'")
    context.set_offline(True)
    page.get_by_role('button', name='Ajouter un remboursement reçu', exact=True).click()
    assert page.locator('select').count() == 0
    page.locator('#amount').fill('20.02')
    page.locator('#comment').fill('Versement global\n<x>')
    page.get_by_role('button', name='Actualiser', exact=True).click()
    assert page.locator('#amount').input_value() == '20.02'
    page.get_by_role('button', name='Enregistrer le remboursement').click()
    balance('79,99')
    assert '<x>' in page.locator('.payment-comment').inner_text()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.get_by_role('button', name='Modifier', exact=True).click()
    page.locator('#amount').fill('30.02')
    page.once('dialog', lambda d: d.dismiss())
    page.get_by_role('button', name='Enregistrer le remboursement').click()
    assert page.locator('#amount').input_value() == '30.02'
    page.once('dialog', lambda d: d.accept())
    page.get_by_role('button', name='Enregistrer le remboursement').click()
    balance('69,99')
    page.reload()
    page.wait_for_selector('#nav button')
    go('finances')
    balance('69,99')
    go('manage')
    with page.expect_download() as download:
        page.get_by_role('button', name='Sauvegarder JSON').click()
    saved = json.loads(open(download.value.path(), encoding='utf-8').read())
    assert saved['version'] == 4
    assert saved['data']['payments'][0]['amount'] == 30.02
    assert saved['data']['openingBalance'] == 100.01
    go('finances')
    page.get_by_role('button', name='Modifier', exact=True).click()
    page.once('dialog', lambda d: d.dismiss())
    page.get_by_role('button', name='Supprimer ce remboursement').click()
    assert page.locator('#amount').input_value() == '30.02'
    page.once('dialog', lambda d: d.accept())
    page.get_by_role('button', name='Supprimer ce remboursement').click()
    balance('100,01')
    go('manage')
    page.once('dialog', lambda d: d.accept())
    page.locator('#restore').set_input_files({'name': 'finance.json', 'mimeType': 'application/json', 'buffer': json.dumps(saved).encode()})
    page.wait_for_function("document.querySelector('#message').textContent.includes('restaurée')")
    go('finances')
    balance('69,99')
    # A failed transaction must preserve the last committed state.
    assert page.evaluate("""async () => {
        const store = await import('./js/storage.js');
        const before = await store.read();
        const original = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function(...args) {
            const tx = original.apply(this, args);
            if (args[1] === 'readwrite') queueMicrotask(() => tx.abort());
            return tx;
        };
        let rejected = false;
        try { await store.write({...before, openingBalance: 999}); }
        catch { rejected = true; }
        finally { IDBDatabase.prototype.transaction = original; }
        return rejected && JSON.stringify(await store.read()) === JSON.stringify(before);
    }""")
    # Seed an actual V1.2 database, then let startup perform the migration twice.
    page.evaluate("""async () => {
        const request = indexedDB.open('carnet-route', 1);
        const db = await new Promise(resolve => request.onsuccess = () => resolve(request.result));
        await new Promise((resolve, reject) => {
            const tx = db.transaction('state', 'readwrite');
            tx.objectStore('state').put({vehicles: [], events: [], trips: []}, 'data');
            tx.oncomplete = resolve;
            tx.onabort = reject;
        });
        db.close();
    }""")
    for _ in range(2):
        page.reload()
        page.wait_for_selector('#nav button')
        go('finances')
        balance('0,00')
        assert page.evaluate("""async () => {
            const store = await import('./js/storage.js');
            const d = await store.read();
            return d.openingBalance === 0 && d.payments.length === 0;
        }""")
    assert not errors, errors
    browser.close()
print('V1.3 finance browser regressions passed')
