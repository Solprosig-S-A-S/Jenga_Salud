const {chromium}=require('playwright-core');
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  const db=new PGlite();await db.exec('create role anon;create role authenticated;');await db.exec(fs.readFileSync('supabase/jenga.sql','utf8'));await db.exec('set role anon;');
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[],payloads=[];
  async function participant(name){
    const context=await browser.newContext({viewport:{width:1100,height:1000}});
    await context.route('https://turnos-test.supabase.co/**',async route=>{
      const headers={'access-control-allow-origin':'*','access-control-allow-headers':'apikey,authorization,content-type','content-type':'application/json'};
      if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      const p=route.request().postDataJSON();payloads.push(p);
      try{const result=await db.query('select public.jenga_room($1,$2,$3,$4,$5,$6::jsonb) as state',[p.p_action,p.p_code,p.p_token,p.p_name,p.p_expected,JSON.stringify(p.p_payload)]);await route.fulfill({status:200,headers,body:JSON.stringify(result.rows[0].state)});}catch(e){await route.fulfill({status:400,headers,body:JSON.stringify({message:e.message})});}
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve('SOLPROSIG_Jenga_Salud_Listo_Para_Usar (2).html')).href);
    await page.locator('#begin').click();await page.locator('#peso').fill('73.2');await page.locator('#talla').fill('172');await page.locator('#submitHealth').click();await page.locator('#goJenga').click();
    if(!(await page.locator('#supabaseUrl').isVisible()))await page.locator('#connectionSettings summary').click();
    await page.locator('#supabaseUrl').fill('https://turnos-test.supabase.co');await page.locator('#supabaseKey').fill('sb_publishable_'+'a'.repeat(30));await page.locator('#playerName').fill(name);
    return page;
  }
  try{
    const host=await participant('Ana');assert(await host.locator('#drawBlock').isDisabled());
    await host.locator('#createRoom').click();await host.waitForFunction(()=>window.JengaSession.getState()?.code);
    const code=await host.evaluate(()=>window.JengaSession.getState().code);
    const guest=await participant('Luis');await guest.locator('#roomCode').fill(code);await guest.locator('#joinRoom').click();
    await host.waitForFunction(()=>window.JengaSession.getState()?.players.length===2);
    await host.locator('#startRoom').click();
    await host.waitForFunction(()=>!document.getElementById('drawBlock').disabled);
    await guest.waitForFunction(()=>window.JengaSession.getState()?.status==='playing');
    assert(await guest.locator('#drawBlock').isDisabled());
    await host.locator('#manualChoice summary').click();await host.locator('#blockPicker').selectOption('23');
    assert(await host.locator('#drawBlock').isDisabled());assert(await host.locator('#blockPicker').isDisabled());assert(await host.locator('#confirmBlock').isDisabled());assert(await host.locator('#seeAnswer').isDisabled());
    await guest.waitForFunction(()=>window.JengaSession.getState()?.selectedId===23);
    assert.equal(await host.locator('#challengeQuestion').innerText(),await guest.locator('#challengeQuestion').innerText());
    assert(await guest.locator('#markAnswered').isDisabled());
    await host.locator('#playerResponse').fill('Respuesta privada de prueba');
    await host.locator('#markAnswered').click();await host.locator('#seeAnswer').click();
    await guest.waitForFunction(()=>document.getElementById('challengeAnswer').classList.contains('visible'));
    await host.locator('#confirmBlock').click();
    await guest.waitForFunction(()=>window.JengaSession.getState()?.turn===1);
    assert((await guest.locator('#turnHeading').innerText()).includes('Luis'));
    assert(await host.locator('#drawBlock').isDisabled());
    await guest.waitForFunction(()=>!document.getElementById('drawBlock').disabled,null,{timeout:45000});
    await guest.locator('#manualChoice summary').click();await guest.locator('#blockPicker').selectOption('5');
    await host.waitForFunction(()=>window.JengaSession.getState()?.selectedId===5);
    assert.equal(await host.locator('#challengeQuestion').innerText(),await guest.locator('#challengeQuestion').innerText());
    assert(!JSON.stringify(payloads).includes('73.2'));assert(!JSON.stringify(payloads).includes('peso'));assert(!JSON.stringify(payloads).includes('talla'));assert(!JSON.stringify(payloads).includes('Respuesta privada de prueba'));
    await host.screenshot({path:'.jenga-build/room-desktop.png',fullPage:true});
    await guest.setViewportSize({width:390,height:844});await guest.screenshot({path:'.jenga-build/room-mobile.png',fullPage:true});assert(!(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
    await host.locator('#openGameMenu').click();await host.locator('#rebuildTower').click();await guest.waitForFunction(()=>window.JengaSession.getState()?.status==='lobby');
    assert.equal((await guest.evaluate(()=>window.JengaSession.getState())).moves.length,0);
    assert(await guest.locator('#drawBlock').isDisabled());
    await guest.reload();await guest.waitForFunction(()=>window.JengaSession.getState()?.code);
    assert.equal(await guest.evaluate(()=>window.JengaSession.getState().code),code);
    assert.deepEqual(errors,[]);
    console.log('OK: 2 navegadores + PostgreSQL, sala, turnos obligatorios, pregunta y respuesta compartidas, avance, reinicio, reconexion y privacidad. Movil sin desborde.');
  }finally{await browser.close();await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
