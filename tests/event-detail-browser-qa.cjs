const {chromium}=require(process.env.BABY_PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.BABY_CHROME_PATH});
 try {
  await fs.mkdir('docs/design/detalle-evento/qa',{recursive:true});
  for(const [name,width,height] of [['pc',1440,1000],['celular',390,844],['celular-grande',430,932],['estrecho',320,568]]){
   const page=await browser.newPage({viewport:{width,height}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://localhost:3001/eventos/20000000-0000-4000-8000-000000000001');
   await page.getByRole('heading',{name:'Elige tus entradas'}).waitFor();
   await page.getByRole('radio',{name:/Entrada general/}).check();
   assert(await page.getByRole('button',{name:'Reducir cantidad'}).isDisabled());
   await page.screenshot({path:`docs/design/detalle-evento/qa/${name}.png`,fullPage:true});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.getByRole('radio',{name:/Pack para dos/}).check();
   await page.getByRole('button',{name:'Aumentar cantidad'}).click();
   const link=page.getByRole('link',{name:'Continuar compra'});
   const url=new URL(await link.getAttribute('href'),'http://localhost:3001');
   assert.equal(url.searchParams.get('ticket_type_code'),'DUO_LOCAL');
   assert.equal(url.searchParams.get('package_quantity'),'2');
   assert(await page.getByText('S/ 150',{exact:true}).isVisible());
   await link.click();
   await page.getByRole('combobox',{name:/Tipo de documento/}).waitFor({timeout:20000});
   // Selection handoff must open buyer data directly, preserving the pack and quantity.
   assert.equal(await page.getByRole('combobox',{name:'Cantidad de paquetes'}).count(),0);
   await page.getByRole('button',{name:'Volver',exact:true}).click();
   assert.equal(await page.getByRole('combobox',{name:'Cantidad de paquetes'}).inputValue(),'2');
   assert(await page.getByRole('radio',{name:/Pack para dos/}).isChecked());
   await page.goto('http://localhost:3001/eventos/20000000-0000-4000-8000-000000000001');
   await page.getByRole('button',{name:'Mesas y boxes',exact:true}).click();
   await page.getByRole('heading',{name:'Elige tu lugar en BABY'}).waitFor();
   await page.locator('svg g[role="button"]').first().click();
   const selectedSpace=await page.getByRole('combobox',{name:'Ubicación'}).inputValue();
   assert(selectedSpace);
   const bounds=await page.locator('svg:has(image)').evaluate(svg=>{
    const frame=svg.getBoundingClientRect();
    return [...svg.querySelectorAll('g[role="button"]')].map(slot=>{const r=slot.getBoundingClientRect();return {inside:r.left>=frame.left-1&&r.right<=frame.right+1&&r.top>=frame.top-1&&r.bottom<=frame.bottom+1,w:r.width,h:r.height};});
   });
   assert.equal(bounds.length,10);
   assert(bounds.every(slot=>slot.inside));
   if(width<700)assert(bounds.every(slot=>slot.w>=23&&slot.h>=23));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`docs/design/detalle-evento/qa/${name}-mesas.png`,fullPage:true});
   const tableLink=page.getByRole('link',{name:'Continuar reserva'});
   const tableUrl=new URL(await tableLink.getAttribute('href'),'http://localhost:3001');
   assert.equal(tableUrl.searchParams.get('tab'),'mesa');
   assert.equal(tableUrl.searchParams.get('event_id'),'20000000-0000-4000-8000-000000000001');
   assert.equal(tableUrl.searchParams.get('table_id'),selectedSpace);
   assert(tableUrl.searchParams.get('product_id'));
   await tableLink.click();
   await page.getByRole('combobox',{name:'Tipo doc',exact:true}).waitFor();
   assert.deepEqual(errors,[]);
   console.log(`OK ${name}: layout, total S/150, checkout handoff`);
   await page.close();
  }
  const blocked=await browser.newPage();
  await blocked.route('**/api/events',route=>route.fulfill({json:{events:[{id:'blocked',name:'Evento agotado',sale_status:'sold_out',is_active:true,ticket_types:[{code:'test',label:'General',price:40,isActive:true,ticketQuantity:1,currencyCode:'PEN'}]}]}}));
  await blocked.goto('http://localhost:3001/eventos/blocked');
  await blocked.getByText('Agotado',{exact:true}).waitFor();
  assert.equal(await blocked.getByRole('link',{name:'Continuar compra'}).count(),0);
  await blocked.close();
  console.log('OK: sold-out event prevents checkout');
  const reserved=await browser.newPage();
  await reserved.route('**/api/tables?*',route=>route.fulfill({json:{tables:[{id:'reserved',name:'Box reservado',ticket_count:6,is_reserved:true,price:600}]}}));
  await reserved.goto('http://localhost:3001/eventos/20000000-0000-4000-8000-000000000001');
  await reserved.getByRole('button',{name:'Mesas y boxes',exact:true}).click();
  await reserved.getByRole('combobox',{name:'Ubicación'}).waitFor();
  assert.equal(await reserved.getByRole('link',{name:'Continuar reserva'}).count(),0);
  assert.equal(await reserved.locator('svg g[role="button"]').count(),0);
  console.log('OK: reserved tables do not offer checkout');
  await reserved.close();
 } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exit(1);});
