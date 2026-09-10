'use client';
import {useEffect, useRef, useState} from 'react';
import {passwordError} from '@/lib/account-policy';
import styles from './AccountModal.module.css';
export default function AccountModal({initialValue, editingId, currentUserId, onClose, onSaved}) {
  const [form,setForm]=useState({...initialValue,role:initialValue.role||'KASIR',password:''});
  const [confirmation,setConfirmation]=useState('');
  const [visible,setVisible]=useState(false), [saving,setSaving]=useState(false), [error,setError]=useState('');
  const busy=useRef(false), dialog=useRef(null);
  useEffect(()=>{dialog.current.showModal();},[]);
  const field=(name,value)=>setForm(prev=>({...prev,[name]:value}));
  async function submit(e) {
    e.preventDefault(); if(busy.current) return;
    if(!editingId||form.password) { const invalid=passwordError(form.password); if(invalid) return setError(invalid); if(form.password!==confirmation) return setError('Konfirmasi password belum sama.'); }
    busy.current=true;setSaving(true);setError('');
    try {const res=await fetch(editingId?'/api/users/'+editingId:'/api/users',{method:editingId?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const data=await res.json(); if(!res.ok) throw new Error(data.error||'Akun gagal disimpan.'); await onSaved();
    }catch(e){setError(e.message||'Koneksi terputus. Periksa daftar akun sebelum mencoba kembali.');}
    finally{busy.current=false;setSaving(false);}
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="account-title" onCancel={e=>{e.preventDefault();if(!busy.current)onClose();}}>
    <form onSubmit={submit} className={styles.form}>
      <header className={styles.header}><div><p className={styles.eyebrow}>PENGELOLAAN AKUN</p><h2 id="account-title">{editingId?'Edit akun':'Tambah akun baru'}</h2><p>Atur akses tim sesuai tanggung jawabnya.</p></div><button type="button" className="btn btn-outline" aria-label="Tutup formulir" onClick={onClose} disabled={saving}>✕</button></header>
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      <fieldset disabled={saving} className={styles.fields}>
        <legend className={styles.legend}>Peran akun</legend>
        <div className={styles.roles}>{[['KASIR','Kasir','Menangani pesanan, kitchen, dan pembayaran.'],['ADMIN','Admin','Akses kasir serta pengelolaan akun dan laporan.']].map(([value,title,description])=><label key={value} className={styles.role} data-selected={form.role===value}><input type="radio" name="role" value={value} checked={form.role===value} disabled={editingId===currentUserId&&value!=='ADMIN'} onChange={()=>field('role',value)}/><span><strong>{title}</strong><small>{description}</small></span></label>)}</div>
        <div className={styles.grid}><label>Nama lengkap <span>*</span><input className="input" autoFocus required maxLength={100} autoComplete="name" value={form.name} onChange={e=>field('name',e.target.value)}/></label><label>Username <span>*</span><input className="input" required minLength={3} maxLength={32} pattern="[a-z0-9_.\-]{3,32}" autoComplete="off" placeholder="misal: rina.kasir" value={form.username} onChange={e=>field('username',e.target.value.toLowerCase())}/><small>3–32 karakter, tanpa spasi.</small></label></div>
        <div className={styles.passwordHeading}><strong>{editingId?'Ganti password (opsional)':'Password'}</strong><button type="button" className="btn btn-outline" onClick={()=>setVisible(!visible)} aria-pressed={visible}>{visible?'Sembunyikan':'Tampilkan'}</button></div>
        <div className={styles.grid}><label>{editingId?'Password baru':'Password'}{!editingId&&' *'}<input className="input" type={visible?'text':'password'} autoComplete="new-password" required={!editingId} minLength={10} maxLength={72} value={form.password} onChange={e=>field('password',e.target.value)}/></label><label>Ulangi password<input className="input" type={visible?'text':'password'} autoComplete="new-password" required={!editingId||!!form.password} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label></div><p className={styles.hint}>Minimal 10 karakter, gabungan huruf dan angka atau simbol.{editingId?' Kosongkan untuk mempertahankan password saat ini.':''}</p>
        <details className={styles.details}><summary>Informasi tambahan <small>Opsional</small></summary><div className={styles.grid}><label>Tempat, tanggal lahir<input className="input" maxLength={100} value={form.ttl||''} onChange={e=>field('ttl',e.target.value)}/></label><label>Nomor telepon<input className="input" type="tel" maxLength={30} value={form.phone||''} onChange={e=>field('phone',e.target.value)}/></label></div><label>Alamat<textarea className="input" maxLength={500} rows={2} value={form.address||''} onChange={e=>field('address',e.target.value)}/></label></details>
      </fieldset>
      <footer className={styles.footer}><span>* Wajib diisi</span><button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Batal</button><button className="btn btn-primary" disabled={saving}>{saving?'Menyimpan…':editingId?'Simpan perubahan':'Buat akun '+(form.role==='ADMIN'?'admin':'kasir')}</button></footer>
    </form>
  </dialog>;
}
