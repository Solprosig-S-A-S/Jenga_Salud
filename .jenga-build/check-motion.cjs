const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const url=pathToFileURL(path.resolve('index.html')).href;
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('#begin').click();await page.locator('#peso').fill('70');await page.locator('#talla').fill('170');await page.locator('#submitHealth').click();await page.locator('#goJenga').click();await page.locator('#roomMode').selectOption('local');await page.locator('#localPlayers').fill('Ana\nLuis');await page.locator('#startLocal').click();
  await page.waitForFunction(()=>!document.getElementById('drawBlock').disabled);await page.waitForTimeout(1600);
  const canvas=page.locator('#towerView canvas');
  const first=await canvas.screenshot();await page.waitForTimeout(900);const second=await canvas.screenshot();assert(!first.equals(second),'La camara debe moverse automaticamente.');
  await page.locator('#motionToggle').click();assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'false');
  await page.waitForTimeout(400);const paused=await canvas.screenshot();await page.waitForTimeout(900);assert(paused.equals(await canvas.screenshot()),'La torre en reposo debe quedar visualmente quieta al pausar.');
  await page.locator('#motionToggle').click();const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2+5,{steps:8});await page.mouse.up();assert(await page.evaluate(()=>window.JengaMotion.paused()));
  await page.locator('#drawBlock').click();await page.waitForFunction(()=>window.JengaSession.getState().selectedId!==null);const selected=await page.evaluate(()=>window.JengaSession.getState().selectedId);
  await page.locator('#motionToggle').click();assert.equal(await page.evaluate(()=>window.JengaSession.getState().selectedId),selected);assert(await page.locator('#markAnswered').isVisible());
  await page.reload();assert.equal(await page.locator('#motionToggle').getAttribute('aria-pressed'),'false');
  const reduced=await browser.newContext({reducedMotion:'reduce'}),reducedPage=await reduced.newPage();await reducedPage.goto(url);assert.equal(await reducedPage.locator('#motionToggle').getAttribute('aria-pressed'),'false');assert(await reducedPage.evaluate(()=>document.body.classList.contains('motion-paused')));
  assert.deepEqual(errors,[]);console.log('OK animacion: camara automatica visible, pausa estable, control manual, pieza fija, preferencia persistente y movimiento reducido.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
