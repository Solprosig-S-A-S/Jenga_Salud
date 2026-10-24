const {PGlite}=require('@electric-sql/pglite');
const {chromium}=require('playwright-core');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const db=new PGlite();let browser;
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated;
   insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
  for(const file of ['supabase/jenga.sql','supabase/admin.sql'])await db.exec(fs.readFileSync(file,'utf8'));
  // Las migraciones deben poder aplicarse de nuevo sin perder datos.
  for(const file of ['supabase/jenga.sql','supabase/admin.sql'])await db.exec(fs.readFileSync(file,'utf8'));
  await db.exec("insert into public.jenga_admins values ('00000000-0000-0000-0000-000000000001');set role anon;");
  const local={id:'10000000-0000-0000-0000-000000000001',session:'20000000-0000-0000-0000-000000000001',alias:'Ana',round:1,turn:0,block:31,response:'=HYPERLINK("https://example.com") < & ñ'};
  const save=answer=>db.query('select public.jenga_save_local_answer($1::jsonb)',[JSON.stringify(answer)]);
  await save(local);await save(local);
  await assert.rejects(()=>save({...local,id:'10000000-0000-0000-0000-000000000002',turn:1,response:' '}),/Escribe/);
  await assert.rejects(()=>save({...local,response:'a'.repeat(501)}),/Escribe/);
  await assert.rejects(()=>save({...local,block:55}),/constraint/);
  await assert.rejects(()=>db.query('select * from public.jenga_answers'),/permission denied/);
  await assert.rejects(()=>db.query('select public.jenga_is_admin()'),/permission denied/);
  await assert.rejects(()=>db.query('select public.jenga_answers_snapshot()'),/permission denied/);
  await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);");
  assert.equal((await db.query('select public.jenga_is_admin() ok')).rows[0].ok,false);
  assert.equal((await db.query('select * from public.jenga_answers')).rows.length,0);
  await assert.rejects(()=>db.query('select public.jenga_answers_snapshot()'),/no autorizado/);
  await assert.rejects(()=>db.query("insert into public.jenga_admins values ('00000000-0000-0000-0000-000000000002')"),/permission denied/);
  await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);");
  const stored=(await db.query('select * from public.jenga_answers')).rows;
  assert.equal(stored.length,1);assert.equal(stored[0].alias,'Ana');assert.equal(stored[0].question_no,1);assert(stored[0].question.includes('siempre produce'));assert.equal(stored[0].response,local.response);
  await assert.rejects(()=>db.query('delete from public.jenga_answers'),/permission denied/);
  await db.exec('reset role;');

  // Excel y administración: prueba con más de una página, sin conectar a producción.
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({acceptDownloads:true}),config=JSON.parse(fs.readFileSync('.jenga-build/supabase-config.json','utf8'));
  const sample=Array.from({length:1005},(_,i)=>({...stored[0],id:i+1}));
  const errors=[];let dataRequests=0;
  await context.route(config.url+'/**',async route=>{
   const req=route.request(),url=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'apikey,authorization,content-type','content-type':'application/json'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   let body;
   if(url.pathname==='/auth/v1/token')body={access_token:req.postDataJSON().email==='admin@example.com'?'admin':'guest',user:{email:req.postDataJSON().email}};
   else if(url.pathname.endsWith('/jenga_is_admin'))body=req.headers().authorization==='Bearer admin';
   else if(url.pathname.endsWith('/jenga_answers_snapshot'))body=1005;
   else if(url.pathname.endsWith('/jenga_answers')){
    dataRequests++;assert.equal(req.headers().authorization,'Bearer admin');
    const cursor=Number(url.searchParams.getAll('id').find(v=>v.startsWith('gt.')).slice(3));body=sample.filter(r=>r.id>cursor).slice(0,1000);
   }else if(url.pathname==='/auth/v1/logout')body={};
   else throw new Error('Petición inesperada '+url.pathname);
   await route.fulfill({status:200,headers,body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('admin.html')).href);
  assert(await page.locator('#reports').isHidden());
  await page.locator('#email').fill('guest@example.com');await page.locator('#password').fill('test-password');await page.locator('#signIn').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('no tiene acceso'));
  assert(await page.locator('#reports').isHidden());assert.equal(dataRequests,0);
  await page.locator('#email').fill('admin@example.com');await page.locator('#password').fill('test-password');await page.locator('#signIn').click();await page.locator('#reports').waitFor();
  await page.locator('#load').click();await page.waitForFunction(()=>!document.getElementById('download').disabled);
  assert.equal(dataRequests,3);assert.equal(await page.locator('#rows tr').count(),100);
  const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();
  const download=await downloadPromise;await download.saveAs('.jenga-build/answers-test.xlsx');
  await page.screenshot({path:'.jenga-build/admin-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'.jenga-build/admin-mobile.png',fullPage:true});
  await page.locator('#signOut').click();assert(await page.locator('#reports').isHidden());assert.equal(await page.locator('#rows tr').count(),0);
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('test-password')),false);
  assert.deepEqual(errors,[]);

  // Cola local: sobrevive a recargar sin conexión y se envía una sola vez al volver.
  const localContext=await browser.newContext();let connected=false,received=[];
  await localContext.route(config.url+'/**',async route=>{
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'apikey,authorization,content-type','content-type':'application/json'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(!connected)return route.fulfill({status:503,headers,body:'{}'});
   received.push(route.request().postDataJSON().p_answer);await route.fulfill({status:200,headers,body:'null'});
  });
  const game=await localContext.newPage();await game.goto(pathToFileURL(path.resolve('index.html')).href);
  await game.locator('#begin').click();await game.locator('#peso').fill('70');await game.locator('#talla').fill('170');await game.locator('#submitHealth').click();await game.locator('#goJenga').click();
  await game.locator('#roomMode').selectOption('local');await game.locator('#localPlayers').fill('Ana\nLuis');await game.locator('#startLocal').click();
  await game.waitForFunction(()=>!document.getElementById('blockPicker').disabled);
  await game.locator('#manualChoice summary').click();await game.locator('#blockPicker').selectOption('31');await game.locator('#playerResponse').fill('Respuesta offline');await game.locator('#markAnswered').click();
  await game.waitForFunction(()=>document.getElementById('answerSaveStatus').textContent.includes('pendientes'));
  await game.reload();await game.waitForFunction(()=>document.getElementById('answerSaveStatus').textContent.includes('pendientes'));
  connected=true;await game.evaluate(()=>window.dispatchEvent(new Event('online')));
  await game.waitForFunction(()=>document.getElementById('answerSaveStatus').textContent.includes('base de datos'));
  assert.equal(received.length,1);assert.equal(received[0].alias,'Ana');assert.equal(received[0].response,'Respuesta offline');assert.equal(received[0].block,31);
  assert.equal(await game.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('solprosig-jenga-answers-v1:')).length),0);
  await save(received[0]);
  console.log('OK: SQL repetible, RLS, administrador autorizado, usuario rechazado, validación, reintentos sin duplicados, consulta paginada (1005), XLSX, móvil y cola offline con recarga.');
 }finally{if(browser)await browser.close();await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
