'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
const labels={legacy:'Pesanan lama · konfirmasi manual',queued:'Menunggu penerimaan',accepted:'Diterima kitchen',preparing:'Sedang dimasak',ready:'Siap disajikan',served:'Sudah disajikan',cancelled:'Dibatalkan'};
const next={legacy:['accepted','Konfirmasi pesanan lama'],cancelled:['dismissed','Pembatalan diterima'],queued:['accepted','Terima pesanan'],accepted:['preparing','Mulai masak'],preparing:['ready','Siap disajikan'],ready:['served','Sudah disajikan']};

export default function KitchenPanel(){
 const [orders,setOrders]=useState([]),[error,setError]=useState(''),[updated,setUpdated]=useState(null),[busy,setBusy]=useState({});
 const [isAdmin,setIsAdmin]=useState(false);
 const fetching=useRef(false),actions=useRef(new Set());

 // Fetch current user role once on mount to know if admin controls should be shown.
 useEffect(()=>{
  fetch('/api/auth/me',{cache:'no-store'})
   .then(r=>r.ok?r.json():null)
   .then(d=>{if(d?.user?.role==='ADMIN')setIsAdmin(true);})
   .catch(()=>{});
 },[]);

 const refresh=useCallback(async()=>{if(fetching.current)return;fetching.current=true;try{const res=await fetch('/api/kitchen',{cache:'no-store',signal:AbortSignal.timeout(10000)});const data=await res.json();if(!res.ok)throw Error(data.error);setOrders(data);setUpdated(new Date());setError('');}catch{setError('Koneksi kitchen terputus. Daftar mungkin belum terbaru. Konfirmasikan pesanan dengan kasir.');}finally{fetching.current=false;}},[]);
 useEffect(()=>{const initial=setTimeout(refresh,0);const timer=setInterval(refresh,5000);return()=>{clearTimeout(initial);clearInterval(timer);};},[refresh]);

 // Advance order through normal one-step flow.
 async function advance(order){
  if(actions.current.has(order.id))return;
  actions.current.add(order.id);setBusy(prev=>({...prev,[order.id]:true}));
  try{
   const res=await fetch('/api/kitchen/'+order.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedStatus:order.kitchenStatus,expectedVersion:order.kitchenVersion,status:next[order.kitchenStatus][0]}),signal:AbortSignal.timeout(10000)});
   if(!res.ok){const data=await res.json();throw Error(data.error||'Status gagal disimpan.');}
   await refresh();
  }catch(e){setError(e.message+' Muat ulang sebelum mencoba lagi.');}
  finally{actions.current.delete(order.id);setBusy(prev=>({...prev,[order.id]:false}));}
 }

 // Admin-only: force mark any in-progress order as served immediately.
 async function forceServed(order){
  if(!window.confirm('Paksa tandai pesanan #'+order.id+' ('+order.transaction.tableNumber+') sebagai "Sudah disajikan"?\n\nGunakan hanya jika pesanan ini sudah pasti selesai dan perlu dibersihkan dari antrian kitchen.'))return;
  if(actions.current.has('f'+order.id))return;
  actions.current.add('f'+order.id);setBusy(prev=>({...prev,['f'+order.id]:true}));
  try{
   const res=await fetch('/api/kitchen/'+order.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({forceServed:true}),signal:AbortSignal.timeout(10000)});
   if(!res.ok){const data=await res.json();throw Error(data.error||'Force complete gagal.');}
   await refresh();
  }catch(e){setError(e.message+' Muat ulang sebelum mencoba lagi.');}
  finally{actions.current.delete('f'+order.id);setBusy(prev=>({...prev,['f'+order.id]:false}));}
 }

 const borderColor=s=>s==='queued'?'#f59e0b':'#10b981';

 return(
  <section className="glass-card">
   <div className="flex justify-between items-center mb-4">
    <div><h2>Kitchen</h2><p>Terima pesanan sebelum mulai menyiapkan makanan.</p></div>
    <button className="btn btn-outline" onClick={refresh}>Muat ulang</button>
   </div>
   <p role={error?'alert':'status'} style={{color:error?'#dc2626':'inherit',fontSize:'.85rem',marginBottom:16}}>
    {error||(updated?'Diperbarui '+updated.toLocaleTimeString('id-ID')+' · otomatis setiap 5 detik':'Memuat antrean…')}
   </p>
   <p style={{fontSize:'.8rem',marginBottom:16}}>Jika printer gagal, gunakan antrean layar dan konfirmasikan dengan kasir. Mencetak tidak mengubah status pesanan.</p>
   {updated&&orders.length===0&&<p>Antrean kosong. Semua pesanan sudah ditangani.</p>}
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:16}}>
    {orders.map(order=>{
     const trxDone=order.transaction?.status==='completed'||order.transaction?.status==='cancelled';
     const fKey='f'+order.id;
     return(
      <article key={order.id} style={{border:'1px solid var(--border-color)',borderLeft:'5px solid '+borderColor(order.kitchenStatus),borderRadius:12,padding:18,background:'var(--card-bg)'}}>
       <small>Pesanan #{order.id} · {new Date(order.createdAt).toLocaleTimeString('id-ID')}</small>
       <h3 style={{margin:'8px 0'}}>{order.transaction.tableNumber||'Tanpa meja'}</h3>
       {/* Badge if transaction already closed — helps admin understand why no normal button works */}
       {trxDone&&<p role="status" style={{fontSize:'.75rem',color:'#6366f1',fontWeight:600,marginBottom:4}}>⚠ Transaksi sudah {order.transaction.status==='completed'?'dibayar':'dibatalkan'} — staf masih perlu menyelesaikan pesanan ini</p>}
       <p style={{fontWeight:700}}>{order.isTakeaway?'BUNGKUS':'MAKAN DI TEMPAT'}</p>
       <p style={{fontSize:'.85rem',margin:'8px 0'}}>{labels[order.kitchenStatus]}</p>
       {order.kitchenStatus==='queued'&&order.kitchenVersion>0&&<p role="status" style={{color:'#b45309',fontWeight:600}}>Pesanan diubah kasir. Periksa ulang jumlah terbaru.</p>}
       <ul style={{paddingLeft:20,margin:'16px 0'}}>
        {order.items.map(item=><li key={item.id}><strong>{item.quantity}×</strong> {item.menuItem.name}</li>)}
       </ul>
       {next[order.kitchenStatus]&&(
        <button className="btn btn-primary" style={{width:'100%',marginBottom:isAdmin?8:0}} disabled={busy[order.id]||!!error} onClick={()=>advance(order)}>
         {busy[order.id]?'Menyimpan…':next[order.kitchenStatus][1]}
        </button>
       )}
       {/* Admin-only force-complete button — shown for any non-terminal status */}
       {isAdmin&&!['served','dismissed'].includes(order.kitchenStatus)&&(
        <button
         className="btn"
         style={{width:'100%',background:'rgba(220,38,38,.12)',color:'#ef4444',border:'1px solid rgba(220,38,38,.35)',fontSize:'.8rem',padding:'6px 12px'}}
         disabled={busy[fKey]||!!error}
         onClick={()=>forceServed(order)}
        >
         {busy[fKey]?'Menyimpan…':'🔑 Paksa Selesai (Admin)'}
        </button>
       )}
      </article>
     );
    })}
   </div>
  </section>
 );
}
