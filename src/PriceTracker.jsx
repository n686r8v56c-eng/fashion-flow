import React,{useEffect,useState} from 'react';
import {Plus,Trash2,ExternalLink,Download,Upload,ChevronDown,ChevronUp,Check,Search,Pencil,TrendingDown} from 'lucide-react';
import './PriceTracker.css';

const DB='fashion-price-tracker-v1',STORE='products';
const money=n=>Number(n||0).toLocaleString('ko-KR')+'원';
const today=()=>new Date().toISOString();
const blankProduct=()=>({id:crypto.randomUUID(),name:'',model:'',color:'',size:'',target:180000,offers:[],createdAt:today(),updatedAt:today()});
const blankOffer=()=>({id:crypto.randomUUID(),shop:'',url:'',price:'',shipping:0,history:[]});
function database(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'})};
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
}
async function dbAction(mode,cb){
  const db=await database();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode),req=cb(tx.objectStore(STORE));
    tx.oncomplete=()=>resolve(req?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  })}finally{db.close()}
}
const all=()=>dbAction('readonly',s=>s.getAll());
const write=p=>dbAction('readwrite',s=>s.put(p));
const del=id=>dbAction('readwrite',s=>s.delete(id));
const positive=n=>Number.isFinite(Number(n))&&Number(n)>=0;
const urlOk=url=>{try{return new URL(url).protocol==='https:'}catch{return false}};
function normalized(row){
  if(!row||typeof row!=='object'||!Array.isArray(row.offers)||typeof row.id!=='string')return null;
  return {...row,name:String(row.name||'').slice(0,180),model:String(row.model||'').slice(0,140),color:String(row.color||'').slice(0,100),size:String(row.size||'').slice(0,100),target:positive(row.target)?Number(row.target):180000,offers:row.offers.filter(o=>o&&typeof o.id==='string').map(o=>({...o,shop:String(o.shop||'').slice(0,120),url:urlOk(o.url)?o.url:'',price:positive(o.price)?Number(o.price):0,shipping:positive(o.shipping)?Number(o.shipping):0,history:Array.isArray(o.history)?o.history.filter(h=>h&&positive(h.price)&&positive(h.shipping)&&!Number.isNaN(Date.parse(h.at))).map(h=>({at:h.at,price:Number(h.price),shipping:Number(h.shipping)})).slice(-500):[]})).slice(0,50)};
}
function sparkline(history){
  const entries=history.slice(-20).filter(h=>positive(h.price)&&positive(h.shipping));
  if(entries.length<2)return null;
  const vals=entries.map(x=>Number(x.price)+Number(x.shipping)),min=Math.min(...vals),max=Math.max(...vals);
  const pts=vals.map((v,i)=>((i/(vals.length-1)*100).toFixed(2))+','+(max===min?25:(46-(v-min)/(max-min)*40)).toFixed(2)).join(' ');
  return <svg viewBox="0 0 100 50" preserveAspectRatio="none" aria-label="저장된 가격 기록 그래프" className="price-spark"><polyline points={pts} fill="none" stroke="#9268bb" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>;
}
export default function PriceTracker(){
  const [products,setProducts]=useState([]),[form,setForm]=useState(null),[active,setActive]=useState(null),[offerForm,setOfferForm]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const reload=async()=>{const rows=await all();setProducts((rows||[]).map(normalized).filter(Boolean).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))))};
  useEffect(()=>{reload().catch(e=>setError('저장소를 열지 못했어: '+e.message))},[]);
  const safe=async(fn)=>{setBusy(true);setError('');try{await fn()}catch(e){setError('저장 실패: '+e.message)}finally{setBusy(false)}};
  const saveProduct=e=>{e.preventDefault();safe(async()=>{
    if(!form.name.trim())throw Error('상품명을 입력해줘.');
    if(!positive(form.target))throw Error('목표 가격을 확인해줘.');
    const next={...form,name:form.name.trim(),target:Number(form.target),updatedAt:today()};
    await write(next);setForm(null);await reload();
  })};
  const saveOffer=e=>{e.preventDefault();safe(async()=>{
    const p=products.find(x=>x.id===active);if(!p)throw Error('상품을 먼저 선택해줘.');
    if(!offerForm.shop.trim())throw Error('쇼핑몰 이름을 입력해줘.');
    if(!urlOk(offerForm.url))throw Error('https://로 시작하는 상품 링크를 입력해줘.');
    if(!positive(offerForm.price)||offerForm.price==='')throw Error('가격을 입력해줘.');
    if(!positive(offerForm.shipping))throw Error('배송비를 확인해줘.');
    const old=p.offers.find(o=>o.id===offerForm.id);
    const snap={at:today(),price:Number(offerForm.price),shipping:Number(offerForm.shipping)};
    const history=[...(old?.history||[]),snap];
    const nextOffer={...offerForm,shop:offerForm.shop.trim(),price:snap.price,shipping:snap.shipping,history};
    const next={...p,offers:old?p.offers.map(o=>o.id===nextOffer.id?nextOffer:o):[...p.offers,nextOffer],updatedAt:today()};
    await write(next);setOfferForm(null);await reload();
  })};
  const removeProduct=p=>{if(!confirm('이 상품과 가격 기록을 삭제할까?'))return;safe(async()=>{await del(p.id);if(active===p.id)setActive(null);await reload()})};
  const removeOffer=(p,o)=>{if(!confirm('이 판매처와 가격 기록을 삭제할까?'))return;safe(async()=>{await write({...p,offers:p.offers.filter(x=>x.id!==o.id),updatedAt:today()});await reload()})};
  async function exportJson(){await safe(async()=>{
    const data=await all(),blob=new Blob([JSON.stringify({version:1,exportedAt:today(),products:data},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fashion-price-tracker-backup.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  })}
  const importJson=e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;safe(async()=>{
    if(f.size>5*1024*1024)throw Error('5MB 이하 백업 파일만 가능해.');
    const data=JSON.parse(await f.text());
    if(data.version!==1||!Array.isArray(data.products)||data.products.length>1000)throw Error('지원하지 않는 백업 파일이야.');
    const rows=data.products.map(normalized);
    if(rows.some(x=>!x)||rows.some(x=>!x.name))throw Error('백업 데이터 형식이 올바르지 않아.');
    if(!confirm(rows.length+'개 상품을 가져올까? 같은 ID의 상품은 백업 내용으로 교체돼.'))return;
    for(const row of rows)await write(row);
    await reload();
  })};
  const expanded=products.find(p=>p.id===active);
  const offers=expanded?[...expanded.offers].sort((a,b)=>(a.price+a.shipping)-(b.price+b.shipping)):[];
  const lowest=offers[0];
  return <section className="pt">
    <div className="pt-heading"><div><h2>PRICE TRACKER</h2><p>품번·색상·사이즈별 관심 상품과 판매처 가격 비교</p></div><button type="button" className="pt-main" onClick={()=>setForm(blankProduct())}><Plus size={17}/> 상품 추가</button></div>
    <p className="pt-note">가격은 직접 입력한 기록이야. 실제 쇼핑몰 가격을 자동으로 읽거나 실시간 갱신하지 않아. 결제 전 링크에서 재확인해줘.</p>
    <div className="pt-products">{products.map(p=>{
      const sorted=[...p.offers].sort((a,b)=>(a.price+a.shipping)-(b.price+b.shipping));
      const best=sorted[0],hit=best&&(best.price+best.shipping)<=p.target;
      return <article className="pt-product" key={p.id}>
        <div className="pt-product-row"><button type="button" className="pt-product-select" onClick={()=>setActive(active===p.id?null:p.id)}><span className="pt-title">{p.name}</span><small>{[p.model,p.color,p.size].filter(Boolean).join(' · ')||'품번·색상·사이즈 미입력'}</small><span className="pt-price-line">{best?<>기록된 최저가 <b>{money(best.price+best.shipping)}</b> · {best.shop}</>:'판매처 미등록'}</span><small>목표 {money(p.target)} {hit?'· 목표가 이하 ✓':''}</small></button><button type="button" className="pt-icon" aria-label="상품 수정" onClick={()=>setForm({...p})}><Pencil size={16}/></button><button type="button" className="pt-icon" aria-label="상품 삭제" onClick={()=>removeProduct(p)}><Trash2 size={16}/></button><button type="button" className="pt-icon" aria-label="판매처 펼치기" onClick={()=>setActive(active===p.id?null:p.id)}>{active===p.id?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button></div>
        {active===p.id&&<div className="pt-details">
          <div className="pt-detail-head"><strong>판매처 가격 비교</strong><button type="button" className="pt-secondary" onClick={()=>setOfferForm(blankOffer())}><Plus size={15}/> 판매처 추가</button></div>
          {offers.length===0?<p className="pt-muted">쇼핑몰 링크와 가격을 추가하면 총액 기준으로 자동 정렬해줘.</p>:offers.map((o,index)=>{
            const total=Number(o.price)+Number(o.shipping),last=o.history?.[o.history.length-1];
            return <div className="pt-offer" key={o.id}>
              <div className="pt-offer-top"><div><strong>{index===0?'★ ':''}{o.shop}</strong><span className="pt-offer-price">{money(total)}</span><small>상품가 {money(o.price)} + 배송 {money(o.shipping)}</small><small>기록 시각 {last?new Date(last.at).toLocaleString('ko-KR'):'없음'}</small></div><div className="pt-offer-actions"><a href={o.url} target="_blank" rel="noopener noreferrer" aria-label={o.shop+' 상품 페이지'}><ExternalLink size={16}/></a><button type="button" aria-label={o.shop+' 가격 수정'} onClick={()=>setOfferForm({...o,price:String(o.price),shipping:String(o.shipping)})}><Pencil size={16}/></button><button type="button" aria-label={o.shop+' 삭제'} onClick={()=>removeOffer(p,o)}><Trash2 size={16}/></button></div></div>
              {sparkline(o.history||[])}
              <div className="pt-history">{(o.history||[]).slice(-5).reverse().map((h,i)=><span key={h.at+i}>{new Date(h.at).toLocaleDateString('ko-KR')} · {money(h.price+h.shipping)}</span>)}</div>
            </div>
          })}
          {lowest&&<p className="pt-muted">최저가 기준: 저장된 상품가 + 배송비. 쿠폰·카드 할인·옵션·재고는 반영하지 않아.</p>}
        </div>}
      </article>
    })}</div>
    {products.length===0&&<p className="pt-empty">아직 관심 상품이 없어. 찾은 제품의 이름과 품번을 등록해봐!</p>}
    <div className="pt-backup"><button type="button" onClick={exportJson} disabled={busy}><Download size={16}/> JSON 백업</button><label><Upload size={16}/> 백업 복원<input type="file" accept=".json,application/json" onChange={importJson}/></label></div>
    <p className="pt-note">현재 저장 위치: 이 기기의 IndexedDB. 앱 데이터 삭제·기기 교체에 대비해 JSON 백업을 보관해줘. 다른 기기와 자동 동기화하려면 Supabase 전용 테이블 설정이 추가로 필요해.</p>
    {error&&<p className="pt-error" role="alert">{error}</p>}
    {form&&<div className="pt-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setForm(null)}}><form className="pt-modal" onSubmit={saveProduct}>
      <div className="pt-form-head"><h3>{products.some(p=>p.id===form.id)?'상품 수정':'관심 상품 등록'}</h3><button type="button" onClick={()=>setForm(null)}>닫기</button></div>
      <label>상품명 *<input required maxLength={180} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="예: 휠라 에어플로우 후드 경량 다운"/></label>
      <label>품번 / 모델 코드<input maxLength={140} value={form.model} onChange={e=>setForm(p=>({...p,model:e.target.value}))} placeholder="정확한 품번"/></label>
      <div className="pt-pair"><label>색상<input maxLength={100} value={form.color} onChange={e=>setForm(p=>({...p,color:e.target.value}))}/></label><label>사이즈<input maxLength={100} value={form.size} onChange={e=>setForm(p=>({...p,size:e.target.value}))}/></label></div>
      <label>목표 가격 (원)<input type="number" min="0" step="1" required value={form.target} onChange={e=>setForm(p=>({...p,target:e.target.value}))}/></label>
      <button className="pt-main" type="submit" disabled={busy}>상품 저장</button>
    </form></div>}
    {offerForm&&<div className="pt-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOfferForm(null)}}><form className="pt-modal" onSubmit={saveOffer}>
      <div className="pt-form-head"><h3>{expanded?.offers.some(o=>o.id===offerForm.id)?'새 가격 기록':'판매처 추가'}</h3><button type="button" onClick={()=>setOfferForm(null)}>닫기</button></div>
      <label>쇼핑몰 이름 *<input required maxLength={120} placeholder="예: 휠라 공식몰" value={offerForm.shop} onChange={e=>setOfferForm(o=>({...o,shop:e.target.value}))}/></label>
      <label>상품 링크 (https://) *<input required type="url" placeholder="https://" value={offerForm.url} onChange={e=>setOfferForm(o=>({...o,url:e.target.value}))}/></label>
      <div className="pt-pair"><label>상품가 (원) *<input required type="number" min="0" step="1" value={offerForm.price} onChange={e=>setOfferForm(o=>({...o,price:e.target.value}))}/></label><label>배송비 (원)<input type="number" min="0" step="1" value={offerForm.shipping} onChange={e=>setOfferForm(o=>({...o,shipping:e.target.value}))}/></label></div>
      <p className="pt-muted">저장할 때마다 현재 날짜·시간으로 가격 기록이 한 건 추가돼.</p>
      <button className="pt-main" type="submit" disabled={busy}>가격 기록 저장</button>
    </form></div>}
  </section>;
}
