// Exercises the installed VSIX, its real Python worker and CSP-protected webview.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { VSBrowser, Workbench, EditorView, WebView, By, InputBox } = require('vscode-extension-tester');

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
  it('renders installed WebGL, camera presets and real VS Code themes',async()=>{
    const driver=VSBrowser.instance.driver,view=new WebView();
    await new Workbench().executeCommand('Python UML Canvas: Open 3D UML Canvas');
    await view.switchToFrame(30000);
    try{
      await driver.wait(async()=>(await driver.findElements(By.css('.spatial-root canvas'))).length>0,30000,'Installed VSIX must load bundled WebGL and lazy CSS under CSP');
      const root=await driver.findElement(By.css('.spatial-root'));
      assert.equal(await driver.executeScript('return getComputedStyle(arguments[0]).position',root),'absolute','3D stylesheet must be installed');
      for(const mode of ['class','community','review','dependency','hub','force','size','folder']){
        await driver.findElement(By.css(`[aria-label="3D graph organization"] option[value="${mode}"]`)).click();
        await driver.wait(async()=>Number(await root.getAttribute('data-rendered-nodes'))>0,15000);
      }
      for(const name of ['Front','Top','Side','Isometric','Fit all'])await driver.findElement(By.xpath(`//button[normalize-space()="${name}"]`)).click();
    }finally{await view.switchBack();}
    for(const [name,slug,themeClass] of [['Dark Modern','dark','vscode-dark'],['Light Modern','light','vscode-light'],['Dark High Contrast','high-contrast','vscode-high-contrast']]){
      await new Workbench().executeCommand('Preferences: Color Theme');
      const input=await InputBox.create();await input.setText(name);await input.selectQuickPick(name);
      await driver.wait(async()=>{const widgets=await driver.findElements(By.css('.quick-input-widget'));return (await Promise.all(widgets.map(w=>w.isDisplayed()))).every(shown=>!shown);},10000,'Theme picker must close after selecting a real theme');
      await view.switchToFrame(15000);
      try{
        await driver.wait(async()=>(await driver.findElement(By.css('body')).getAttribute('class')).includes(themeClass),15000,`The actual ${name} VS Code theme must reach the webview`);
        await driver.wait(async()=>(await driver.findElements(By.css('.spatial-root canvas'))).length>0,15000);
        fs.mkdirSync('.validation-runtime/evidence/installed',{recursive:true});
        fs.writeFileSync(`.validation-runtime/evidence/installed/v81-${slug}.png`,await driver.takeScreenshot(),'base64');
      }finally{await view.switchBack();}
    }
  });
});
