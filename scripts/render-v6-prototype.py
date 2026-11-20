"""Render static V6 design system proof. Not a live extension screenshot.
Requires: pip install playwright; python -m playwright install chromium"""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
import os
import shutil

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'docs/visual/V6_STATIC_DESIGN_PROTOTYPE.html'

def render(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    html=HTML.read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)"/>',lambda m:'<style>'+((HTML.parent/m.group(1)).resolve().read_text())+'</style>',html)
    with sync_playwright() as browser_api:
        chrome_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
        options={'headless':True}
        if chrome_path: options['executable_path']=chrome_path
        if os.name!='nt': options['args']=['--no-sandbox']
        browser = browser_api.chromium.launch(**options)
        try:
            for theme in ('dark','light'):
                page = browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
                page.set_content(html,wait_until='load')
                page.evaluate('(theme)=>document.documentElement.className=theme',theme)
                page.screenshot(path=str(out/f'V6_STATIC_{theme.upper()}.png'),full_page=False)
                assert page.locator('.uml-node').count() == 4
                assert page.locator('.git-mode-switch button').count() == 3
                page.close()
            for width,height in ((960,720),(1440,900)):
                page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=2)
                page.set_content(html,wait_until='load')
                assert page.locator('.toolbar').is_visible()
                assert page.locator('.proof-main-node').is_visible()
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
                page.screenshot(path=str(out/f'V6_STATIC_DPI2_{width}.png'))
                page.close()
        finally:
            browser.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--out',type=Path,default=ROOT/'docs/visual')
    opts=parser.parse_args()
    render(opts.out)
    print('V6 static visual checks: PASS (dark, light, responsive, 200% DPI)')
