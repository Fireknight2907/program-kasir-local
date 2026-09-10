// Set PLAYWRIGHT_MODULE to an installed Playwright module; API calls use fixtures only.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
const page=await browser.newPage({viewport:{width:1280,height:960}});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER ERROR',e.message);});
const admin={id:1,username:'owner',name:'Admin Restoran',role:'ADMIN',createdAt:new Date().toISOString()};let users=[admin],posts=0;
const menu={id:1,name:'Nasi Goreng',price:30000,isAvailable:true,category:'Makanan'};
let order={id:100,transactionId:'test-session',total:20000,isTakeaway:true,kitchenStatus:'queued',kitchenVersion:0,createdAt:new Date().toISOString(),items:[{id:1,menuItemId:1,menuItem:menu,quantity:1,price:20000}],transaction:{tableNumber:'5'}};
let syncFailure=false, editPayload, paymentPayload;
const cashierTransaction={id:'test-session',tableNumber:'5',status:'ordered',total:50000,revision:2,createdAt:new Date().toISOString(),orders:[order,{...order,id:101,isTakeaway:false,total:30000,items:[{...order.items[0],id:2,price:30000}]}]};
page.on('dialog',dialog=>dialog.dismiss());
await page.route('**/api/**',async route=>{const url=new URL(route.request().url()),method=route.request().method();let body=[];
 if(url.pathname==='/api/auth/me')body={user:admin};
 else if(url.pathname==='/api/users'){if(method==='POST'){posts++;const data=route.request().postDataJSON();await new Promise(resolve=>setTimeout(resolve,120));users.push({...data,id:2,password:undefined,createdAt:new Date().toISOString()});body=users[1];}else body=users;}
 else if(url.pathname==='/api/transaction')body=[cashierTransaction];
 else if(url.pathname==='/api/transaction/test-session/edit-order'){editPayload=route.request().postDataJSON();body={success:true};}
 else if(url.pathname==='/api/transaction/test-session'&&method==='PUT'){paymentPayload=route.request().postDataJSON();return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'PAYMENT_CONFLICT',error:'Tagihan berubah. Buka ulang pembayaran.'})});}
 else if(url.pathname==='/api/menu')body=[menu];
 else if(url.pathname==='/api/categories')body=[{id:1,name:'Makanan',order:0}];
 else if(url.pathname==='/api/kitchen/100'){const data=route.request().postDataJSON();assert.equal(data.expectedVersion,order.kitchenVersion);order={...order,kitchenStatus:data.status,kitchenVersion:order.kitchenVersion+1};body={success:true};}
 else if(url.pathname==='/api/kitchen'){if(syncFailure)return route.abort();body=[order];}
 else if(url.pathname==='/api/transaction/test-session')body={id:'test-session',status:'ordered',tableNumber:'5',total:20000,revision:1,orders:[order],createdAt:new Date().toISOString()};
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
});
await page.goto('http://localhost:3000/');await page.getByRole('button',{name:'Kelola Karyawan'}).click();await page.getByRole('button',{name:'Tambah Akun',exact:true}).click();
const dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByRole('radio',{name:/Admin/}).check();await dialog.getByLabel('Nama lengkap').fill('Admin Trial');await dialog.getByLabel('Username').fill('admin.trial');await dialog.getByLabel(/^Password/).fill('Trial-Strong-123!');await dialog.getByLabel('Ulangi password').fill('Trial-Strong-123!');
const dir=process.env.TRIAL_SCREENSHOT_DIR||require('node:os').tmpdir();await page.screenshot({path:path.join(dir,'kasir-akun-desktop.png')});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(dir,'kasir-akun-mobile.png')});assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'dialog must not overflow horizontally');
const submit=dialog.getByRole('button',{name:'Buat akun admin'});await submit.evaluate(el=>{el.click();el.click();el.click();});await dialog.waitFor({state:'detached'});assert.equal(posts,1);assert.equal(users[1].role,'ADMIN');console.log('PASS responsive admin form and rapid submit only creates once');
await page.setViewportSize({width:1280,height:960});
await page.getByRole('button',{name:'Transaksi Hari Ini'}).click();await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByText('Rp 20.000 / item', {exact:false}).waitFor();await page.getByText('Rp 30.000 / item',{exact:false}).waitFor();await page.getByRole('button',{name:'Simpan Perubahan',exact:true}).click();await page.getByRole('button',{name:'Simpan Perubahan',exact:true}).waitFor({state:'detached'});assert.equal(editPayload.expectedRevision,2);assert.equal(editPayload.items.length,2);assert.equal(editPayload.items[0].itemId,1);assert.equal(editPayload.items[1].itemId,2);console.log('PASS cashier edit keeps different historical prices and item identities');
await page.getByRole('button',{name:'Tandai Selesai (Sudah Dibayar)'}).click();await page.getByRole('button',{name:'Selesaikan Transaksi & Bayar'}).click();await page.getByRole('button',{name:'Selesaikan Transaksi & Bayar'}).waitFor({state:'detached'});assert.equal(paymentPayload.expectedTotal,50000);assert.equal(paymentPayload.expectedRevision,2);assert.ok(paymentPayload.paymentRequestId);console.log('PASS cashier payment sends snapshot and closes stale modal after rejection');
await page.getByRole('button',{name:'Kitchen',exact:true}).click();await page.getByRole('button',{name:'Terima pesanan',exact:true}).click();await page.getByRole('button',{name:'Mulai masak',exact:true}).waitFor();assert.equal(order.kitchenStatus,'accepted');console.log('PASS kitchen acceptance and version payload');
syncFailure=true;await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.getByText(/Koneksi kitchen terputus/).waitFor();assert.equal(await page.getByRole('button',{name:'Mulai masak',exact:true}).isDisabled(),true);console.log('PASS kitchen connection warning blocks stale action');
await page.goto('http://localhost:3000/order/test-session');await page.getByText(/Pesanan #100:.*Diterima kitchen/).waitFor();assert.equal(await page.getByText('Sedang Diproses Dapur',{exact:true}).count(),0);console.log('PASS customer shows actual kitchen acknowledgment');
assert.deepEqual(errors,[]);console.log('Browser scenarios passed without runtime errors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
