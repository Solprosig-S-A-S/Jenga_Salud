const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('SOLPROSIG_Jenga_Salud_Listo_Para_Usar (2).html')).href);
  await page.locator('#begin').click();await page.locator('#peso').fill('70');await page.locator('#talla').fill('170');await page.locator('#submitHealth').click();await page.locator('#goJenga').click();
  assert(await page.locator('#drawBlock').isDisabled());await page.locator('#roomMode').selectOption('local');
  await page.locator('#localPlayers').fill('Ana\nana');await page.locator('#startLocal').click();assert((await page.locator('#roomError').innerText()).includes('diferente'));
  await page.locator('#localPlayers').fill('Ana\nLuis');await page.locator('#startLocal').click();
  await page.waitForFunction(()=>!document.getElementById('drawBlock').disabled);
  assert((await page.locator('#turnHeading').innerText()).includes('Ana'));
  await page.locator('#manualChoice summary').click();await page.locator('#blockPicker').selectOption('31');assert((await page.locator('#challengeQuestion').innerText()).includes('siempre produce'));
  assert(await page.locator('#blockPicker').isDisabled());assert(await page.locator('#confirmBlock').isDisabled());assert(await page.locator('#seeAnswer').isDisabled());
  assert.equal(await page.evaluate(()=>window.JengaSession.can('complete')),false);
  await page.locator('#markAnswered').click();await page.locator('#seeAnswer').click();assert(await page.locator('#challengeAnswer').isVisible());
  await page.locator('#confirmBlock').click();await page.waitForFunction(()=>window.JengaSession.getState()?.turn===1);
  assert((await page.locator('#turnHeading').innerText()).includes('Luis'));
  await page.locator('#openGameMenu').click();await page.locator('#rebuildTower').click();assert.equal(await page.evaluate(()=>window.JengaSession.getState().status),'lobby');
  assert(await page.locator('#drawBlock').isDisabled());await page.locator('#startRoom').click();
  assert((await page.locator('#turnHeading').innerText()).includes('Ana'));
  await page.locator('#openGameMenu').click();await page.locator('#endRoom').click();assert.equal(await page.evaluate(()=>window.JengaSession.getState().status),'ended');assert(await page.locator('#drawBlock').isDisabled());
  assert.deepEqual(errors,[]);console.log('OK local: alias distintos, orden obligatorio, pieza fija, respuesta requerida, siguiente participante, reinicio y cierre.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
