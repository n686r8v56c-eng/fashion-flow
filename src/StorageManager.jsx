import React,{useEffect,useState} from 'react';
import {Database,RefreshCw,Trash2,Download,ChevronDown,ChevronUp,ShieldCheck} from 'lucide-react';
import './StorageManager.css';

const FINDER_DB='fashion-finder-local-v1';
const PRICE_DB='fashion-price-tracker-v1';
const byteSize=s=>new Blob([s]).size;
const fmt=n=>n==null?'측정 불가':n<1024?Math.round(n)+' B':n<1024*1024?(n/1024).toFixed(1)+' KB':(n/1024/1024).toFixed(2)+' MB';

function openExisting(name){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(name);
    request.onupgradeneeded=()=>{request.transaction.abort()};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('저장소가 다른 탭에서 사용 중이야.'));
  });
}
async function scanDb(name,store,convert){
  const db=await openExisting(name);
  try{
    if(!db.objectStoreNames.contains(store))return {items:[],bytes:0};
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readonly'),request=tx.objectStore(store).openCursor();
      const items=[];let bytes=0;
      request.onsuccess=()=>{
        const cursor=request.result;
        if(!cursor)return;
        const item=convert(cursor.value);
        items.push(item);bytes+=item.bytes;
        cursor.continue();
      };
      tx.oncomplete=()=>resolve({items,bytes});
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
  }finally{db.close()}
}
const finderScan=()=>scanDb(FINDER_DB,'searches',v=>({
  id:v.id,title:String(v.title||'이름 없는 사진'),
  date:Number(v.createdAt)||0,
  bytes:(v.blob instanceof Blob?v.blob.size:0)+byteSize(JSON.stringify({id:v.id,title:v.title,createdAt:v.createdAt}))
}));
const priceScan=()=>scanDb(PRICE_DB,'products',v=>({
  id:v.id,title:String(v.name||'이름 없는 상품'),date:Date.parse(v.updatedAt)||0,
  bytes:byteSize(JSON.stringify(v))
}));
async function deletePhotos(ids){
  const db=await openExisting(FINDER_DB);
  try{
    if(!db.objectStoreNames.contains('searches'))throw Error('사진 기록 저장소를 찾지 못했어.');
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('searches','readwrite'),store=tx.objectStore('searches');
      ids.forEach(id=>store.delete(id));
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }finally{db.close()}
}
export default function StorageManager({onPhotosChanged}){
  const [open,setOpen]=useState(false),[loading,setLoading]=useState(false);
  const [usage,setUsage]=useState(null),[quota,setQuota]=useState(null);
  const [photos,setPhotos]=useState([]),[photoBytes,setPhotoBytes]=useState(null);
  const [products,setProducts]=useState([]),[priceBytes,setPriceBytes]=useState(null);
  const [selected,setSelected]=useState([]),[age,setAge]=useState('30'),[error,setError]=useState('');
  const [scanWarning,setScanWarning]=useState('');
  async function refresh(){
    setLoading(true);setError('');setScanWarning('');
    try{
      if(navigator.storage?.estimate){
        const result=await navigator.storage.estimate();
        setUsage(typeof result.usage==='number'?result.usage:null);
        setQuota(typeof result.quota==='number'?result.quota:null);
      }else{setUsage(null);setQuota(null)}
      const [a,b]=await Promise.allSettled([finderScan(),priceScan()]);
      const failures=[];
      if(a.status==='fulfilled'){setPhotos(a.value.items.sort((x,y)=>y.date-x.date));setPhotoBytes(a.value.bytes)}
      else{setPhotos([]);setPhotoBytes(null);failures.push('검색 사진: '+a.reason?.message)}
      if(b.status==='fulfilled'){setProducts(b.value.items);setPriceBytes(b.value.bytes)}
      else{setProducts([]);setPriceBytes(null);failures.push('가격 기록: '+b.reason?.message)}
      setScanWarning(failures.join(' / '));
      setSelected(prev=>prev.filter(id=>a.status==='fulfilled'&&a.value.items.some(item=>item.id===id)));
    }catch(e){setError('용량 측정 실패: '+e.message)}
    finally{setLoading(false)}
  }
  useEffect(()=>{if(open)refresh()},[open]);
  const selectedRows=photos.filter(row=>selected.includes(row.id));
  const threshold=Date.now()-Number(age)*86400000;
  const older=photos.filter(row=>row.date>0&&row.date<threshold);
  function toggle(id){setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}
  async function removeSelected(){
    if(!selectedRows.length)return;
    const amount=selectedRows.reduce((a,p)=>a+p.bytes,0);
    if(!window.confirm('검색 사진 '+selectedRows.length+'개 ('+fmt(amount)+')를 이 기기에서 영구 삭제할까?\n삭제하면 원본을 복구할 수 없어. PRICE TRACKER의 상품과 가격 기록은 유지돼.'))return;
    setLoading(true);setError('');
    try{
      await deletePhotos(selectedRows.map(x=>x.id));
      setSelected([]);
      await onPhotosChanged?.();
      await refresh();
    }catch(e){setError('사진 삭제 실패: '+e.message);setLoading(false)}
  }
  const percent=usage!=null&&quota>0?Math.min(100,usage/quota*100):null;
  return <section className="fsm">
    <button type="button" className="fsm-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
      <span><Database size={18}/> STORAGE MANAGER</span>{open?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
    </button>
    {open&&<div className="fsm-body">
      <div className="fsm-top"><span>이 사이트의 브라우저 저장 공간</span><button type="button" onClick={refresh} disabled={loading}><RefreshCw size={15}/>{loading?'측정 중':'새로고침'}</button></div>
      <strong className="fsm-usage">{fmt(usage)} <small>/ 추정 한도 {fmt(quota)}</small></strong>
      <div className="fsm-bar" role="progressbar" aria-label="사이트 저장공간 사용 비율" aria-valuenow={percent==null?0:Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><span style={{width:(percent??0)+'%'}}/></div>
      <p className="fsm-sub">브라우저가 제공하는 전체 사이트 사용량 추정치야. IndexedDB뿐 아니라 캐시 등도 포함될 수 있어. 한도는 실제 기기 여유 공간과 달라.</p>
      <div className="fsm-stats">
        <div><small>FINDER 사진</small><b>{fmt(photoBytes)}</b><span>{photos.length}개</span></div>
        <div><small>PRICE TRACKER</small><b>{fmt(priceBytes)}</b><span>{products.length}개 상품</span></div>
      </div>
      <p className="fsm-sub">위 항목별 크기는 앱이 저장한 파일 크기와 데이터 내용으로 계산한 근삿값이야. 브라우저 내부 오버헤드는 포함하지 않아. 다른 앱 데이터는 표시하지 않아.</p>
      <div className="fsm-list-head"><b>검색 사진 정리</b><span>선택 {selectedRows.length}개 · {fmt(selectedRows.reduce((a,x)=>a+x.bytes,0))}</span></div>
      <div className="fsm-actions">
        <label>오래된 기록 <select value={age} onChange={e=>setAge(e.target.value)}><option value="7">7일</option><option value="30">30일</option><option value="90">90일</option><option value="180">180일</option></select></label>
        <button type="button" disabled={!older.length||loading} onClick={()=>setSelected(older.map(x=>x.id))}>오래된 사진 선택 ({older.length})</button>
        <button type="button" disabled={!photos.length||loading} onClick={()=>setSelected(selected.length===photos.length?[]:photos.map(x=>x.id))}>{selected.length===photos.length?'선택 해제':'전체 선택'}</button>
      </div>
      <div className="fsm-photos">
        {photos.length?photos.map(p=><label className="fsm-photo" key={p.id}>
          <input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggle(p.id)} disabled={loading}/>
          <span><b>{p.title}</b><small>{p.date?new Date(p.date).toLocaleDateString('ko-KR'):'날짜 미확인'} · {fmt(p.bytes)}</small></span>
        </label>):<p className="fsm-sub">저장된 검색 사진이 없어.</p>}
      </div>
      <button type="button" className="fsm-delete" onClick={removeSelected} disabled={!selectedRows.length||loading}><Trash2 size={16}/> 선택한 검색 사진 삭제</button>
      <p className="fsm-protect"><ShieldCheck size={16}/> PRICE TRACKER 가격 기록과 상품 정보는 이 화면에서 삭제하지 않아.</p>
      {scanWarning&&<p className="fsm-error">일부 데이터 측정 실패: {scanWarning}</p>}
      {error&&<p role="alert" className="fsm-error">{error}</p>}
    </div>}
  </section>;
}
