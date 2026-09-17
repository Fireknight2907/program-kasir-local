'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
const labels={legacy:'Pesanan lama · konfirmasi manual',queued:'Menunggu penerimaan',accepted:'Diterima kitchen',preparing:'Sedang dimasak',ready:'Siap disajikan',served:'Sudah disajikan',cancelled:'Dibatalkan'};
const next={legacy:['accepted','Konfirmasi pesanan lama'],cancelled:['dismissed','Pembatalan diterima'],queued:['accepted','Terima pesanan'],accepted:['preparing','Mulai masak'],preparing:['ready','Siap disajikan'],ready:['served','Sudah disajikan']};
const nextStatus={legacy:'accepted',cancelled:'dismissed',queued:'accepted',accepted:'preparing',preparing:'ready',ready:'served'};

export default function KitchenPanel(){
 const [orders,setOrders]=useState([]);
 // pollingError: just a warning banner, does NOT block buttons.
 // actionError: per-order error shown on the card, clears after 5 s.
 const [pollingError,setPollingError]=useState('');
 const [actionErrors,setActionErrors]=useState({});
 const [updated,setUpdated]=useState(null);
 const [busy,setBusy]=useState({});
 const [isAdmin,setIsAdmin]=useState(false);
 const fetching=useRef(false),actions=useRef(new Set());
 const errorTimers=useRef({});

 // Fetch current user role once on mount to know if admin controls should be shown.
 useEffect(()=>{
  fetch('/api/auth/me',{cache:'no-store'})
   .then(r=>r.ok?r.json():null)
   .then(d=>{if(d?.user?.role==='ADMIN')setIsAdmin(true);})
   .catch(()=>{});
 },[]);

 const refresh=useCallback(async()=>{
  if(fetching.current)return;
  fetching.current=true;
  try{
   const res=await fetch('/api/kitchen',{cache:'no-store',signal:AbortSignal.timeout(10000)});
   const data=await res.json();
   if(!res.ok)throw Error(data.error);
   setOrders(data);
   setUpdated(new Date());
   setPollingError('');
  }catch{
   // Polling failure: show a soft warning but do NOT block action buttons.
   setPollingError('Koneksi kitchen terputus. Daftar mungkin belum terbaru.');
  }finally{
   fetching.current=false;
  }
 },[]);

 useEffect(()=>{
  const initial=setTimeout(refresh,0);
  const timer=setInterval(refresh,5000);
  return()=>{clearTimeout(initial);clearInterval(timer);};
 },[refresh]);

 // Show a per-order action error that auto-clears after 5 seconds.
 function setActionError(id,msg){
  setActionErrors(prev=>({...prev,[id]:msg}));
  if(errorTimers.current[id])clearTimeout(errorTimers.current[id]);
  errorTimers.current[id]=setTimeout(()=>{
   setActionErrors(prev=>{const n={...prev};delete n[id];return n;});
  },5000);
 }

 // Advance order through normal one-step flow.
 async function advance(order){
  if(actions.current.has(order.id))return;
  actions.current.add(order.id);

  // Optimistic update: reflect the new status instantly so the UI feels snappy.
  const newStatus=nextStatus[order.kitchenStatus];
  setOrders(prev=>prev.map(o=>o.id===order.id
   ?{...o,kitchenStatus:newStatus,kitchenVersion:o.kitchenVersion+1}
   :o
  ));
  setBusy(prev=>({...prev,[order.id]:true}));

  try{
   const res=await fetch('/api/kitchen/'+order.id,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({expectedStatus:order.kitchenStatus,expectedVersion:order.kitchenVersion,status:newStatus}),
    signal:AbortSignal.timeout(12000),
   });
   if(!res.ok){
    const data=await res.json();
    // Revert optimistic update on failure and show per-card error.
    setActionError(order.id,data.error||'Status gagal disimpan. Coba lagi.');
    await refresh(); // Re-sync from server to get real state.
   } else {
    // Background sync to make sure we're in step with the server, but UI already updated.
    refresh();
   }
  }catch(e){
   setActionError(order.id,'Koneksi lambat. Coba lagi.');
   await refresh();
  }finally{
   actions.current.delete(order.id);
   setBusy(prev=>({...prev,[order.id]:false}));
  }
 }

 // Admin-only: force mark any in-progress order as served immediately.
 async function forceServed(order){
  if(!window.confirm('Paksa tandai pesanan #'+order.id+' ('+order.transaction.tableNumber+') sebagai "Sudah disajikan"?\n\nGunakan hanya jika pesanan ini sudah pasti selesai dan perlu dibersihkan dari antrian kitchen.'))return;
  const fKey='f'+order.id;
  if(actions.current.has(fKey))return;
  actions.current.add(fKey);

  // Optimistic update.
  setOrders(prev=>prev.map(o=>o.id===order.id
   ?{...o,kitchenStatus:'served',kitchenVersion:o.kitchenVersion+1}
   :o
  ));
  setBusy(prev=>({...prev,[fKey]:true}));

  try{
   const res=await fetch('/api/kitchen/'+order.id,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({forceServed:true}),
    signal:AbortSignal.timeout(12000),
   });
   if(!res.ok){
    const data=await res.json();
    setActionError(order.id,data.error||'Force complete gagal.');
    await refresh();
   } else {
    refresh();
   }
  }catch(e){
   setActionError(order.id,'Koneksi lambat. Coba lagi.');
   await refresh();
  }finally{
   actions.current.delete(fKey);
   setBusy(prev=>({...prev,[fKey]:false}));
  }
 }

 const borderColor=s=>s==='queued'?'#f59e0b':'#10b981';

 return(
  <section className="glass-card">
   <div className="flex justify-between items-center mb-4">
    <div><h2>Kitchen</h2><p>Terima pesanan sebelum mulai menyiapkan makanan.</p></div>
    <button className="btn btn-outline" onClick={refresh}>Muat ulang</button>
   </div>
   {/* Soft polling warning — does NOT block buttons */}
   <p role={pollingError?'alert':'status'} style={{color:pollingError?'#b45309':'inherit',fontSize:'.85rem',marginBottom:16}}>
    {pollingError
     ? '⚠ '+pollingError+' (tombol tetap bisa digunakan)'
     : (updated?'Diperbarui '+updated.toLocaleTimeString('id-ID')+' · otomatis setiap 5 detik':'Memuat antrean…')}
   </p>
   <p style={{fontSize:'.8rem',marginBottom:16}}>Jika printer gagal, gunakan antrean layar dan konfirmasikan dengan kasir. Mencetak tidak mengubah status pesanan.</p>
   {updated&&orders.length===0&&<p>Antrean kosong. Semua pesanan sudah ditangani.</p>}
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:16}}>
    {orders.map(order=>{
     const trxDone=order.transaction?.status==='completed'||order.transaction?.status==='cancelled';
     const fKey='f'+order.id;
     const orderErr=actionErrors[order.id];
     return(
      <article key={order.id} style={{border:'1px solid var(--border-color)',borderLeft:'5px solid '+borderColor(order.kitchenStatus),borderRadius:12,padding:18,background:'var(--card-bg)'}}>
       <small>Pesanan #{order.id} · {new Date(order.createdAt).toLocaleTimeString('id-ID')}</small>
       <h3 style={{margin:'8px 0'}}>{order.transaction.tableNumber||'Tanpa meja'}</h3>
       {/* Badge if transaction already closed */}
       {trxDone&&<p role="status" style={{fontSize:'.75rem',color:'#6366f1',fontWeight:600,marginBottom:4}}>⚠ Transaksi sudah {order.transaction.status==='completed'?'dibayar':'dibatalkan'} — staf masih perlu menyelesaikan pesanan ini</p>}
       <p style={{fontWeight:700}}>{order.isTakeaway?'BUNGKUS':'MAKAN DI TEMPAT'}</p>
       <p style={{fontSize:'.85rem',margin:'8px 0'}}>{labels[order.kitchenStatus]}</p>
       {order.kitchenStatus==='queued'&&order.kitchenVersion>0&&<p role="status" style={{color:'#b45309',fontWeight:600}}>Pesanan diubah kasir. Periksa ulang jumlah terbaru.</p>}
       {/* Per-card action error — auto-clears after 5 s */}
       {orderErr&&<p role="alert" style={{fontSize:'.8rem',color:'#dc2626',marginBottom:8,fontWeight:600}}>⚠ {orderErr}</p>}
       <ul style={{paddingLeft:20,margin:'16px 0'}}>
        {order.items.map(item=><li key={item.id} style={item.deletedAt?{textDecoration:'line-through',color:'#ef4444'}:undefined}><strong>{item.quantity}×</strong> {item.menuItem.name}</li>)}
       </ul>
       {next[order.kitchenStatus]&&(
        // Only busy[order.id] disables the button — polling errors no longer block.
        <button className="btn btn-primary" style={{width:'100%',marginBottom:isAdmin?8:0}} disabled={busy[order.id]} onClick={()=>advance(order)}>
         {busy[order.id]?'Menyimpan…':next[order.kitchenStatus][1]}
        </button>
       )}
       {/* Admin-only force-complete button */}
       {isAdmin&&!['served','dismissed'].includes(order.kitchenStatus)&&(
        <button
         className="btn"
         style={{width:'100%',background:'rgba(220,38,38,.12)',color:'#ef4444',border:'1px solid rgba(220,38,38,.35)',fontSize:'.8rem',padding:'6px 12px'}}
         disabled={busy[fKey]}
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
