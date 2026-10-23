const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const config=JSON.parse(fs.readFileSync('.jenga-build/supabase-config.json','utf8'));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();let requests=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(config.url+'/**',async route=>{
   if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'apikey,content-type'}});return;}
   requests++;assert.equal(route.request().url(),config.url+'/rest/v1/rpc/jenga_room');
   assert.equal(route.request().headers().apikey,config.key);
   await route.fulfill({status:404,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({code:'PGRST202'})});
  });
  await page.goto(pathToFileURL(path.resolve('SOLPROSIG_Jenga_Salud_Listo_Para_Usar (2).html')).href);
  assert.equal(await page.locator('#supabaseUrl').inputValue(),config.url);assert.equal(await page.locator('#supabaseKey').inputValue(),config.key);
  assert.equal(await page.locator('#connectionSettings').getAttribute('open'),null);
  await page.locator('#begin').click();await page.locator('#peso').fill('70');await page.locator('#talla').fill('170');await page.locator('#submitHealth').click();await page.locator('#goJenga').click();
  await page.locator('#playerName').fill('Prueba');await page.locator('#createRoom').click();
  await page.waitForFunction(()=>document.getElementById('roomError').classList.contains('show'));
  assert((await page.locator('#roomError').innerText()).includes('supabase/jenga.sql'));assert.equal(requests,1);assert.deepEqual(errors,[]);
  console.log('OK: proyecto precargado, endpoint correcto y mensaje de instalacion SQL pendiente.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
