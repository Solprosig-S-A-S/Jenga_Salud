const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',route=>route.abort());
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.locator('#begin').click();await page.locator('#peso').fill('70');await page.locator('#talla').fill('170');await page.locator('#submitHealth').click();await page.locator('#goJenga').click();
  await page.locator('#roomMode').selectOption('local');await page.locator('#localPlayers').fill('Ana\nLuis');await page.locator('#startLocal').click();
  await page.waitForFunction(()=>!document.getElementById('drawBlock').disabled);
  assert(await page.evaluate(()=>document.body.classList.contains('jenga-focus')));
  await page.screenshot({path:'.jenga-build/mobile-choose-new.png'});
  await page.locator('#expandTower').click();assert(await page.evaluate(()=>document.body.classList.contains('tower-expanded')));await page.locator('#expandTower').click();
  await page.locator('#manualChoice summary').click();await page.locator('#blockPicker').selectOption('23');
  await page.locator('#playerResponse').fill('Mi respuesta de prueba');
  for(const [width,height] of [[390,844],[320,568],[430,932],[390,450]]){
   await page.setViewportSize({width,height});
   await page.waitForFunction(()=>document.getElementById('playArena').getBoundingClientRect().bottom<=innerHeight+1);
   const metrics=await page.evaluate(()=>{
    const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height};};
    return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,tower:r('towerView'),question:r('questionPanel'),button:r('markAnswered'),bodyHeight:document.body.getBoundingClientRect().height};
   });
   assert(metrics.scroll<=width);assert(metrics.tower.height>=(height<500?35:85));assert(metrics.tower.top>=0);assert(metrics.question.top<height);assert(metrics.button.bottom<=height+1);assert(metrics.button.top>0);assert.equal(Math.round(metrics.bodyHeight),height);
   await page.screenshot({path:'.jenga-build/mobile-answer-'+width+'.png'});
  }
  await page.setViewportSize({width:390,height:844});await page.locator('#markAnswered').click();
  assert.equal(await page.locator('#responseEcho').innerText(),'Tu respuesta: Mi respuesta de prueba');
  await page.locator('#seeAnswer').click();assert(await page.locator('#challengeAnswer').isVisible());await page.screenshot({path:'.jenga-build/mobile-guide-new.png'});
  await page.locator('#openGameMenu').click();assert(await page.locator('#gameMenu').isVisible());await page.press('#closeGameMenu','Escape');assert(!(await page.locator('#gameMenu').isVisible()));
  await page.locator('#confirmBlock').click();assert.equal(await page.locator('#playerResponse').inputValue(),'');
  await page.locator('#openGameMenu').click();await page.locator('#rebuildTower').click();assert(!(await page.evaluate(()=>document.body.classList.contains('jenga-focus'))));assert(await page.locator('#startRoom').isVisible());
  assert.deepEqual(errors,[]);console.log('OK mobile: 320/390/430 px, torre y acciones dentro de pantalla, respuesta privada, guia, ampliar, menu accesible y vuelta al lobby.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
