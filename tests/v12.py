"""V1.2 regressions: run against the same local server as browser.py."""
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
    assert '0 km' in page.locator('.stats').inner_text()
    def go(action):
        page.locator(f'#nav [data-action="{action}"]').click()
    def save():
        page.get_by_role('button', name='Enregistrer', exact=True).click()
        page.wait_for_selector('[data-action="json"]')
    go('manage')
    page.get_by_role('button', name='Ajouter un véhicule').click()
    page.locator('#name').fill('Auto')
    page.locator('#rate').fill('0.5')
    save()
    page.get_by_role('button', name='Ajouter un événement').click()
    page.locator('#name').fill('Festival')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    save()
    go('trip')
    assert page.locator('#status').input_value() == 'in-progress'
    page.locator('#start').fill('100')
    page.locator('#note').fill('Remarque intégrale\nDeuxième ligne')
    page.get_by_role('button', name='Actualiser', exact=True).click()
    assert page.locator('#start').input_value() == '100'
    assert 'Deuxième ligne' in page.locator('#note').input_value()
    page.get_by_role('button', name='Enregistrer le trajet').click()
    page.wait_for_selector('.ongoing')
    go('trip')
    page.locator('#start').fill('125')
    page.once('dialog', lambda dialog: dialog.dismiss())
    page.get_by_role('button', name='Enregistrer le trajet').click()
    assert page.locator('#start').input_value() == '125'
    page.once('dialog', lambda dialog: dialog.accept())
    page.get_by_role('button', name='Enregistrer le trajet').click()
    page.wait_for_selector('.ongoing')
    assert page.locator('.ongoing').count() == 1
    assert '12,50' in page.locator('.stats').inner_text()
    page.wait_for_function("document.querySelector('#offline').textContent === 'Hors ligne prêt'")
    context.set_offline(True)
    go('trip')
    page.locator('#note').fill('Saisie hors ligne')
    page.evaluate('window.scrollTo(0, 0)')
    # Synthesize the touch gesture without reloading the document.
    page.evaluate("""() => {
        for (const [type, y] of [['touchstart', 10], ['touchmove', 150], ['touchend', 150]]) {
            const e = new Event(type, {bubbles: true, cancelable: true});
            Object.defineProperty(e, type === 'touchend' ? 'changedTouches' : 'touches', {value: [{clientY: y}]});
            document.dispatchEvent(e);
        }
    }""")
    page.wait_for_function("document.querySelector('#message').textContent.includes('actualisées')")
    assert page.locator('#note').input_value() == 'Saisie hors ligne'
    go('manage')
    with page.expect_download() as download:
        page.get_by_role('button', name='Exporter la sélection CSV').click()
    text = open(download.value.path(), encoding='utf-8-sig').read()
    assert 'TOTAL ÉVÉNEMENT' in text and 'Deuxième ligne' in text and '12.50' in text
    page.add_init_script('window.print = () => {}')
    with page.expect_popup() as popup:
        page.get_by_role('button', name='Exporter la sélection PDF').click()
    report = popup.value
    report.wait_for_selector('table')
    assert 'Deuxième ligne' in report.locator('body').inner_text()
    assert '12,50' in report.locator('body').inner_text()
    report.close()
    page.reload()
    page.wait_for_selector('.ongoing')
    assert not errors, errors
    browser.close()
    print('PASS V1.2: empty profile, rate, default, refresh drafts, chain cancel/accept, offline exports PDF/CSV')
