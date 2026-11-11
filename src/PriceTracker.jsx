import React,{useEffect,useState} from 'react';
import {Plus,Trash2,ExternalLink,Download,Upload,Copy,Check,Search,Pencil,TrendingDown} from 'lucide-react';
import './PriceTracker.css';

const DB='fashion-price-tracker-v1',STORE='products',META='meta';
const FILA_ID='fila-airflow-fs264dj01x012091-20261111';
const FILA_DATE='2026-11-11T12:00:00+09:00';
const FILA_OFFICIAL_URL='https://www.fila.co.kr/products/1100fs264dj01x012091';
const officialLink=p=>p.officialUrl||(p.id===FILA_ID?FILA_OFFICIAL_URL:'');
const naverSearch=(name)=>'https://search.shopping.naver.com/search/all?query='+encodeURIComponent(name||'');
const youtubeSearch=(name)=>'https://www.youtube.com/results?search_query='+encodeURIComponent(name||'');
const filaSample=()=>({id:FILA_ID,name:'휠라 에어플로우 후드 경량 다운',model:'FS264DJ01X012091',color:'GRAY / SILVER',size:'미선택',target:180000,officialUrl:FILA_OFFICIAL_URL,createdAt:FILA_DATE,updatedAt:FILA_DATE,offers:[
  {id:'fila-official',shop:'휠라 공식몰',url:'',price:219000,shipping:0,shippingUnknown:true,referenceOnly:true,history:[{at:FILA_DATE,price:219000,shipping:0}]},
  {id:'fila-ssg',shop:'SSG 신세계백화점 (219,000원부터)',url:'',price:219000,shipping:0,shippingUnknown:true,referenceOnly:true,history:[{at:FILA_DATE,price:219000,shipping:0}]},
  {id:'fila-eql',shop:'한섬 EQL',url:'',price:219000,shipping:0,shippingUnknown:true,referenceOnly:true,history:[{at:FILA_DATE,price:219000,shipping:0}]}
]});
const money=n=>Number(n||0).toLocaleString('ko-KR')+'원';
const today=()=>new Date().toISOString();
const blankProduct=()=>({id:crypto.randomUUID(),name:'',model:'',color:'',size:'',target:180000,offers:[],createdAt:today(),updatedAt:today()});
const normalizeProductUrl=raw=>{try{const url=new URL(raw.trim());const match=url.pathname.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d{4,20})\/?$/);if(url.protocol!=='https:'||!['brand.naver.com','m.brand.naver.com','smartstore.naver.com','m.smartstore.naver.com'].includes(url.hostname)||!match)return null;return {url:'https://'+url.hostname.replace(/^m\./,'')+'/'+match[1]+'/products/'+match[2],id:match[2],store:match[1]}}catch{return null}};
function database(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB,2);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});if(!r.result.objectStoreNames.contains(META))r.result.createObjectStore(META)};
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
async function seedFilaOnce(){
  const db=await database();
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction([STORE,META],'readwrite');
      const flag=tx.objectStore(META).get('fila-example-seeded-v1');
      flag.onsuccess=()=>{
        if(flag.result)return;
        const store=tx.objectStore(STORE);
        const found=store.get(FILA_ID);
        found.onsuccess=()=>{if(!found.result)store.put(filaSample());tx.objectStore(META).put(true,'fila-example-seeded-v1')};
      };
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }finally{db.close()}
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
  const [products,setProducts]=useState([]),[form,setForm]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(''),[linkInput,setLinkInput]=useState(''),[linkLoading,setLinkLoading]=useState(false),[linkNotice,setLinkNotice]=useState('');
  const reload=async()=>{const rows=await all();setProducts((rows||[]).map(normalized).filter(Boolean).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))))};
  useEffect(()=>{seedFilaOnce().then(reload).catch(e=>setError('저장소를 열지 못했어: '+e.message))},[]);
  const safe=async(fn)=>{setBusy(true);setError('');try{await fn()}catch(e){setError('저장 실패: '+e.message)}finally{setBusy(false)}};
  const saveProduct=e=>{e.preventDefault();safe(async()=>{
    if(!form.name.trim())throw Error('상품명을 입력해줘.');
    if(!positive(form.target))throw Error('목표 가격을 확인해줘.');
    if(form.officialUrl&&!urlOk(form.officialUrl))throw Error('공식몰 URL은 https:// 주소여야 해.');
    if(form.imageUrl&&!urlOk(form.imageUrl))throw Error('사진 URL은 https:// 주소여야 해.');
    const next={...form,name:form.name.trim(),target:Number(form.target),officialUrl:form.officialUrl??(form.id===FILA_ID?FILA_OFFICIAL_URL:''),updatedAt:today()};
    await write(next);setForm(null);await reload();
  })};
  async function importLink(e){
    e.preventDefault();setError('');setLinkNotice('');
    const parsed=normalizeProductUrl(linkInput);
    if(!parsed){setError('현재 네이버 브랜드스토어·스마트스토어 상품 링크만 지원해.');return}
    const duplicate=products.find(p=>p.sourceUrl===parsed.url);
    if(duplicate&&!window.confirm('이미 같은 상품 링크가 등록되어 있어. 새 상품으로 추가할까?'))return;
    setLinkLoading(true);
    try{
      let data={};
      try{
        const response=await fetch('/api/product-metadata?url='+encodeURIComponent(parsed.url),{headers:{Accept:'application/json'}});
        if(response.ok)data=await response.json();
      }catch{}
      const name=String(data.title||'').replace(/\s*[:|]\s*네이버.*$/,'').trim().slice(0,180);
      setForm({...blankProduct(),name,sourceUrl:parsed.url,officialUrl:parsed.url,sourceProductId:parsed.id,sourceStore:parsed.store,imageUrl:/^https:\/\//.test(data.image||'')?data.image:'',sourcePrice:data.price??null,sourcePriceCheckedAt:data.price!=null?today():null});
      setLinkNotice(data.ok?'상품 정보를 가져왔어. 저장 전에 상품명과 옵션을 확인해줘.':'네이버에서 상품 정보 읽기가 제한됐어. 상품 링크와 번호는 가져왔으니 상품명만 입력하면 저장할 수 있어.');
      setLinkInput('');
    }finally{setLinkLoading(false)}
  }
  const removeProduct=p=>{if(!confirm('이 상품과 가격 기록을 삭제할까?'))return;safe(async()=>{await del(p.id);await reload()})};
  async function copyModel(model){
    if(!model){setError('복사할 품번이 없어. 상품 수정에서 품번을 입력해줘.');return}
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(model);
      else{
        const input=document.createElement('textarea');
        input.value=model;input.style.position='fixed';input.style.opacity='0';
        document.body.appendChild(input);input.select();
        const ok=document.execCommand('copy');input.remove();
        if(!ok)throw new Error('복사 권한 없음');
      }
      setCopied(model);setError('');
    }catch(e){setError('품번 복사에 실패했어. 브라우저의 클립보드 권한을 확인해줘.')}
  }
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
  return <section className="pt">
    <div className="pt-heading"><div><h2>PRICE TRACKER</h2><p>상품명으로 네이버 쇼핑 검색</p></div><button type="button" className="pt-main" onClick={()=>setForm(blankProduct())}><Plus size={17}/> 상품 추가</button></div>
    <form className="pt-link-import" onSubmit={importLink}>
      <label htmlFor="pt-import-link">상품 링크로 등록</label>
      <div><input id="pt-import-link" type="url" required inputMode="url" placeholder="네이버 상품 URL 붙여넣기" value={linkInput} onChange={e=>setLinkInput(e.target.value)}/><button type="submit" disabled={linkLoading}>{linkLoading?'조회 중…':'불러오기'}</button></div>
      <small>광고 추적 문구는 제거하고 상품 주소만 저장해. 상품 정보가 안 읽히면 직접 확인해 등록할 수 있어.</small>
    </form>
    {linkNotice&&!form&&<p className="pt-note">{linkNotice}</p>}
    <p className="pt-note">가격은 직접 입력한 기록 또는 최초 참고 가격이야. 네이버 쇼핑 링크는 자동 최저가 확인이 아니라 검색 연결이며, 가격을 자동으로 읽거나 실시간 갱신하지 않아. 결제 전 링크에서 재확인해줘.</p>
    <div className="pt-products">{products.map(p=>{
      const sorted=[...p.offers].sort((a,b)=>(a.price+a.shipping)-(b.price+b.shipping));
      const best=sorted[0],hit=best&&!best.shippingUnknown&&(best.price+best.shipping)<=p.target;
      return <article className="pt-product" key={p.id}>
        <div className="pt-product-row">{p.imageUrl&&<img className="pt-product-image" src={p.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none'}}/>}<div className="pt-product-select"><span className="pt-title">{p.name}</span><small>{[p.model,p.color,p.size].filter(Boolean).join(' · ')||'품번·색상·사이즈 미입력'}</small><span className="pt-price-line">{best?<>{best.shippingUnknown?'참고 상품가':'기록된 최저가'} <b>{money(best.price+best.shipping)}</b> · {best.shop}</>:'판매처 미등록'}</span><small>목표 {money(p.target)} {hit?'· 목표가 이하 ✓':''}</small></div><button type="button" className="pt-icon" aria-label="상품 수정" onClick={()=>setForm({...p})}><Pencil size={16}/></button><button type="button" className="pt-icon" aria-label="상품 삭제" onClick={()=>removeProduct(p)}><Trash2 size={16}/></button><button type="button" className="pt-icon" aria-label="품번 복사" title={copied===p.model?'복사됨':'품번 복사'} onClick={()=>copyModel(p.model)}>{copied===p.model?<Check size={16}/>:<Copy size={16}/>}</button></div>
        <details className="pt-link-accordion">
          <summary>검색 바로가기 <span>네이버 · 공식몰 · 유튜브</span></summary>
          <div className="pt-link-list">
            <a href={naverSearch(p.name)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> 네이버에서 상품명 검색</a>
            {officialLink(p)&&<a href={officialLink(p)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> {p.sourceUrl?'원본 상품 페이지':'공식몰'}</a>}
            <a href={youtubeSearch(p.name)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> 유튜브에서 상품명 검색</a>
            {!officialLink(p)&&<small>공식몰 링크는 상품 수정에서 등록할 수 있어.</small>}
          </div>
        </details>
      </article>
    })}</div>
    {products.length===0&&<p className="pt-empty">아직 관심 상품이 없어. 찾은 제품의 이름과 품번을 등록해봐!</p>}
    <div className="pt-backup"><button type="button" onClick={exportJson} disabled={busy}><Download size={16}/> JSON 백업</button><label><Upload size={16}/> 백업 복원<input type="file" accept=".json,application/json" onChange={importJson}/></label></div>
    <p className="pt-note">현재 저장 위치: 이 기기의 IndexedDB. 앱 데이터 삭제·기기 교체에 대비해 JSON 백업을 보관해줘. 다른 기기와 자동 동기화하려면 Supabase 전용 테이블 설정이 추가로 필요해.</p>
    {error&&<p className="pt-error" role="alert">{error}</p>}
    {form&&<div className="pt-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setForm(null)}}><form className="pt-modal" onSubmit={saveProduct}>
      <div className="pt-form-head"><h3>{products.some(p=>p.id===form.id)?'상품 수정':'관심 상품 등록'}</h3><button type="button" onClick={()=>setForm(null)}>닫기</button></div>
      <label>상품명 *<input required maxLength={180} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="예: 휠라 에어플로우 후드 경량 다운"/></label>
      {form.sourceUrl&&<div className="pt-import-preview">
        <small>상품번호 {form.sourceProductId} · {form.sourceStore}</small>
        {form.imageUrl&&<img src={form.imageUrl} alt="상품 사진 후보" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none'}}/>}
        <a href={form.sourceUrl} target="_blank" rel="noopener noreferrer">원본 네이버 상품 확인 ↗</a>
        {form.sourcePrice!=null&&<small>읽어온 참고 가격 {money(form.sourcePrice)} · 저장된 현재가 아님</small>}
        <small>원본 페이지에서 제품명·품번·색상·사이즈를 확인하고 등록해줘.</small>
      </div>}
      <label>상품 사진 URL (선택)<input type="url" placeholder="https://" value={form.imageUrl||''} onChange={e=>setForm(p=>({...p,imageUrl:e.target.value}))}/></label>
      <label>품번 / 모델 코드<input maxLength={140} value={form.model} onChange={e=>setForm(p=>({...p,model:e.target.value}))} placeholder="정확한 품번"/></label>
      <div className="pt-pair"><label>색상<input maxLength={100} value={form.color} onChange={e=>setForm(p=>({...p,color:e.target.value}))}/></label><label>사이즈<input maxLength={100} value={form.size} onChange={e=>setForm(p=>({...p,size:e.target.value}))}/></label></div>
      
      <label>공식몰 URL (선택)<input type="url" placeholder="https://" value={form.officialUrl??(form.id===FILA_ID?FILA_OFFICIAL_URL:'')} onChange={e=>setForm(p=>({...p,officialUrl:e.target.value}))}/></label>
      <label>목표 가격 (원)<input type="number" min="0" step="1" required value={form.target} onChange={e=>setForm(p=>({...p,target:e.target.value}))}/></label>
      <button className="pt-main" type="submit" disabled={busy}>상품 저장</button>
    </form></div>}

  </section>;
}
