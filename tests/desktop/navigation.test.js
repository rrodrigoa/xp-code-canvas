// Exercises the installed VSIX, its real Python worker and CSP-protected webview.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { VSBrowser, Workbench, EditorView, WebView, By } = require('vscode-extension-tester');

describe('XP Code Canvas packaged desktop smoke', () => {
  it('opens the Canvas as a VS Code editor tab', async () => {
    await new Workbench().executeCommand('Python UML Canvas: Open UML Canvas');
    await VSBrowser.instance.driver.wait(async () => (await new EditorView().getOpenEditorTitles()).some(title => title.includes('Python UML Canvas')), 30000, 'Canvas editor must open');
    const titles = await new EditorView().getOpenEditorTitles();
    assert.ok(titles.some(title => title.includes('Python UML Canvas')));
  });
  it('renders analyzed source, switches layouts and opens the native editor', async () => {
    const driver=VSBrowser.instance.driver;
    const view=new WebView();
    await view.switchToFrame(30000);
    try {
      await driver.wait(async () => (await driver.findElements(By.css('.uml-node'))).length>0,30000,'Analyzed cards must render');
      for(const mode of ['architecture','file','investigation','change','spread']) {
        const select=await driver.findElement(By.css('[aria-label="Choose graph layout"]'));
        await select.findElement(By.css(`option[value="${mode}"]`)).click();
        await driver.wait(async () => (await driver.findElement(By.css('.graph-context-meta')).getText()).toLowerCase().includes(`${mode} layout`),10000);
        await driver.wait(async () => (await driver.findElement(By.css('main')).getAttribute('aria-busy'))==='false',15000,'Layout must complete');
        await driver.findElement(By.css('button[aria-label="Fit canvas"]')).click();
        await driver.wait(async () => (await driver.findElements(By.css('.uml-node'))).length>0,10000);
        fs.mkdirSync('test-results/desktop',{recursive:true});
        fs.writeFileSync(`test-results/desktop/v6-${mode}.png`,await driver.takeScreenshot(),'base64');
      }
      fs.mkdirSync('test-results/desktop',{recursive:true});
      fs.writeFileSync('test-results/desktop/v6-installed.png',await driver.takeScreenshot(),'base64');
      const open=await driver.findElement(By.css('.uml-node button[aria-label^="Open "]'));
      await open.click();
    } finally { await view.switchBack(); }
    await driver.wait(async () => (await new EditorView().getOpenEditorTitles()).some(title=>title.endsWith('.py')),10000,'Native Python editor must open');
    await new Workbench().executeCommand('Python UML Canvas: Return to UML Canvas');
    await driver.wait(async () => (await new EditorView().getOpenEditorTitles()).includes('Python UML Canvas'),10000);
  });
});
