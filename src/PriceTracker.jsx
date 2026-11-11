import React,{useEffect,useRef,useState} from 'react';
import {Plus,Trash2,ExternalLink,Download,Upload,Pencil,ImagePlus} from 'lucide-react';
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
const blankProduct=()=>({id:crypto.randomUUID(),name:'',model:'',color:'',size:'',target:null,sourcePrice:null,offers:[],createdAt:today(),updatedAt:today()});
const normalizeProductUrl=raw=>{try{
  const url=new URL(raw.trim());
  if(url.protocol!=='https:'||url.username||url.password)return null;
  if(url.hostname==='search.shopping.naver.com'){
    const catalog=url.pathname.match(/^\/catalog\/(\d{4,20})\/?$/);
    if(!catalog)return null;
    return {url:'https://search.shopping.naver.com/catalog/'+catalog[1],id:catalog[1],store:'네이버 쇼핑 카탈로그',hint:(url.searchParams.get('query')||'').trim().slice(0,180)};
  }
  const match=url.pathname.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d{4,20})\/?$/);
  if(!['brand.naver.com','m.brand.naver.com','smartstore.naver.com','m.smartstore.naver.com'].includes(url.hostname)||!match)return null;
  return {url:'https://'+url.hostname.replace(/^m\./,'')+'/'+match[1]+'/products/'+match[2],id:match[2],store:match[1],hint:''};
}catch{return null}};
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
  return {...row,name:String(row.name||'').slice(0,180),model:String(row.model||'').slice(0,140),color:String(row.color||'').slice(0,100),size:String(row.size||'').slice(0,100),target:row.target!==null&&row.target!==''&&row.target!==undefined&&positive(row.target)?Number(row.target):null,sourcePrice:row.sourcePrice!==null&&row.sourcePrice!==''&&row.sourcePrice!==undefined&&positive(row.sourcePrice)?Number(row.sourcePrice):null,offers:row.offers.filter(o=>o&&typeof o.id==='string').map(o=>({...o,shop:String(o.shop||'').slice(0,120),url:urlOk(o.url)?o.url:'',price:positive(o.price)?Number(o.price):0,shipping:positive(o.shipping)?Number(o.shipping):0,history:Array.isArray(o.history)?o.history.filter(h=>h&&positive(h.price)&&positive(h.shipping)&&!Number.isNaN(Date.parse(h.at))).map(h=>({at:h.at,price:Number(h.price),shipping:Number(h.shipping)})).slice(-500):[]})).slice(0,50)};
}
function sparkline(history){
  const entries=history.slice(-20).filter(h=>positive(h.price)&&positive(h.shipping));
  if(entries.length<2)return null;
  const vals=entries.map(x=>Number(x.price)+Number(x.shipping)),min=Math.min(...vals),max=Math.max(...vals);
  const pts=vals.map((v,i)=>((i/(vals.length-1)*100).toFixed(2))+','+(max===min?25:(46-(v-min)/(max-min)*40)).toFixed(2)).join(' ');
  return <svg viewBox="0 0 100 50" preserveAspectRatio="none" aria-label="저장된 가격 기록 그래프" className="price-spark"><polyline points={pts} fill="none" stroke="#9268bb" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>;
}
async function compactProductImage(file){
  if(!file.type.startsWith('image/'))throw Error('이미지 파일만 올릴 수 있어.');
  if(file.size>15*1024*1024)throw Error('15MB 이하 사진을 선택해줘.');
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('사진을 열지 못했어.'));img.src=url});
    const scale=Math.min(1,520/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.72);
  }finally{URL.revokeObjectURL(url)}
}
function ProductThumbnail({product,onUpload,disabled}){
  const picker=useRef(null),[failed,setFailed]=useState(false);
  const src=product.manualImageDataUrl||product.imageUrl||'';
  useEffect(()=>setFailed(false),[src]);
  const visible=!!src&&!failed;
  return <div className="pt-photo-picker">
    <button type="button" className="pt-photo-button" aria-label={product.name+' 상품 사진 '+(visible?'변경':'추가')} title="사진을 눌러 직접 등록·변경" disabled={disabled} onClick={()=>picker.current?.click()}>
      {visible?<img className="pt-product-image" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<span className="pt-image-missing"><ImagePlus size={19}/>사진 추가</span>}
    </button>
    <input ref={picker} className="pt-photo-file" type="file" accept="image/*" aria-label={product.name+' 사진 파일 선택'} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)onUpload(product,file)}}/>
  </div>;
}
export default function PriceTracker(){
  const [products,setProducts]=useState([]),[form,setForm]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[linkInput,setLinkInput]=useState(''),[linkLoading,setLinkLoading]=useState(false),[linkNotice,setLinkNotice]=useState('');
  const reload=async()=>{const rows=await all();setProducts((rows||[]).map(normalized).filter(Boolean).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))))};
  useEffect(()=>{seedFilaOnce().then(reload).catch(e=>setError('저장소를 열지 못했어: '+e.message))},[]);
  const safe=async(fn)=>{setBusy(true);setError('');try{await fn()}catch(e){setError('저장 실패: '+e.message)}finally{setBusy(false)}};
  const saveProduct=e=>{e.preventDefault();safe(async()=>{
    if(!form.name.trim())throw Error('상품명을 입력해줘.');
    if(form.target!==null&&form.target!==''&&!positive(form.target))throw Error('목표 가격을 확인해줘.');
    if(form.sourcePrice!==null&&form.sourcePrice!==''&&!positive(form.sourcePrice))throw Error('현재 판매가를 확인해줘.');
    if(form.officialUrl&&!urlOk(form.officialUrl))throw Error('공식몰 URL은 https:// 주소여야 해.');
    if(form.imageUrl&&!urlOk(form.imageUrl))throw Error('사진 URL은 https:// 주소여야 해.');
    const next={...form,name:form.name.trim(),needsNameReview:false,target:form.target==null||form.target===''?null:Number(form.target),sourcePrice:form.sourcePrice==null||form.sourcePrice===''?null:Number(form.sourcePrice),officialUrl:form.officialUrl??(form.id===FILA_ID?FILA_OFFICIAL_URL:''),updatedAt:today()};
    await write(next);setForm(null);await reload();
  })};
  async function importLink(e){
    e.preventDefault();setError('');setLinkNotice('');
    const parsed=normalizeProductUrl(linkInput);
    if(!parsed){setError('네이버 브랜드스토어·스마트스토어·쇼핑 카탈로그 상품 링크만 지원해.');return}
    if(products.some(p=>p.sourceUrl===parsed.url)){
      setError('이 상품 링크는 이미 등록되어 있어.');return;
    }
    setLinkLoading(true);
    try{
      let data={};
      try{
        const response=await fetch('/api/product-metadata?url='+encodeURIComponent(parsed.url),{headers:{Accept:'application/json'}});
        if(response.ok)data=await response.json();
      }catch{}
      // Save immediately with whatever public title and image metadata was available.
      // Never invent a product name, picture or price when NAVER blocks extraction.
      const extractedName=String(data.title||'').replace(/\s*[:|]\s*네이버.*$/,'').trim().slice(0,180);
      const suggestedName=extractedName||(parsed.hint||'');
      const imageUrl=urlOk(data.image)?data.image:'';
      const row={...blankProduct(),name:suggestedName||'상품명 확인 필요',needsNameReview:!extractedName,
        sourceUrl:parsed.url,officialUrl:parsed.url,sourceProductId:parsed.id,sourceStore:parsed.store,
        imageUrl,sourcePrice:null,target:null};
      await write(row);
      await reload();
      setLinkInput('');
      setLinkNotice(extractedName&&imageUrl?'상품명과 사진을 가져와 바로 등록했어. 카드에서 가격을 입력해줘.':
        '상품 링크는 등록했어. '+(parsed.hint&&!extractedName?'검색어를 임시 상품명으로 사용했어. 실제 상품명을 확인해줘. ':'')+'정보를 못 읽은 항목('+[!extractedName?'상품명':'',!imageUrl?'사진':''].filter(Boolean).join('·')+')은 상품 수정에서 보완할 수 있어.');
    }catch(err){setError('상품 등록 실패: '+err.message)}
    finally{setLinkLoading(false)}
  }
  const removeProduct=p=>{if(!confirm('이 상품과 가격 기록을 삭제할까?'))return;safe(async()=>{await del(p.id);await reload()})};
  async function uploadProductImage(product,file){
    await safe(async()=>{
      const manualImageDataUrl=await compactProductImage(file);
      await write({...product,manualImageDataUrl,updatedAt:today()});
      await reload();
    });
  }
  async function saveInlinePrice(product,raw){
    const value=raw.trim();
    if(value!==''&&(!positive(value)||Number(value)>999999999)) {setError('가격은 0원 이상 숫자로 입력해줘.');return}
    const price=value===''?null:Number(value);
    if(price===product.sourcePrice)return;
    await safe(async()=>{
      await write({...product,sourcePrice:price,updatedAt:today()});
      await reload();
    });
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
    <form className="pt-link-import" onSubmit={importLink}>
      <label htmlFor="pt-import-link">상품 링크로 등록</label>
      <div><input id="pt-import-link" type="url" required inputMode="url" placeholder="네이버 상품 URL 붙여넣기" value={linkInput} onChange={e=>setLinkInput(e.target.value)}/><button type="submit" disabled={linkLoading}>{linkLoading?'조회 중…':'불러오기'}</button></div>
    </form>
    <div className="pt-products">{products.map(p=>{
      const sorted=[...p.offers].sort((a,b)=>(a.price+a.shipping)-(b.price+b.shipping));
      const best=sorted[0],hit=best&&p.target!=null&&!best.shippingUnknown&&(best.price+best.shipping)<=p.target;
      return <article className="pt-product" key={p.id}>
        <div className="pt-product-row">
          <ProductThumbnail product={p} disabled={busy} onUpload={uploadProductImage}/>
          <div className="pt-product-select">
            <span className="pt-title">{p.name}</span>
            {p.model&&<small>{p.model}</small>}
            <label className="pt-inline-price">
              가격 (원)
              <input key={p.id+'-'+p.updatedAt} aria-label={p.name+' 가격 수정'} type="number" min="0" step="1" inputMode="numeric" placeholder="가격 입력" defaultValue={p.sourcePrice??''} onBlur={e=>saveInlinePrice(p,e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}/>
            </label>
            {p.target!=null&&<small>목표 {money(p.target)}</small>}
          </div>
          <button type="button" className="pt-icon" aria-label="상품 수정" onClick={()=>setForm({...p})}><Pencil size={16}/></button>
          <button type="button" className="pt-icon" aria-label="상품 삭제" onClick={()=>removeProduct(p)}><Trash2 size={16}/></button>
        </div>
        <details className="pt-link-accordion">
          <summary>검색 바로가기 <span>네이버 · 상품 페이지 · 유튜브</span></summary>
          <div className="pt-link-list">
            <a href={naverSearch(p.name)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> 네이버에서 상품명 검색</a>
            {officialLink(p)&&<a href={officialLink(p)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> {p.sourceUrl?'원본 상품 페이지':'공식몰'}</a>}
            <a href={youtubeSearch(p.name)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> 유튜브에서 상품명 검색</a>
            
          </div>
        </details>
      </article>
    })}</div>
    
    <div className="pt-backup"><button type="button" onClick={exportJson} disabled={busy}><Download size={16}/> JSON 백업</button><label><Upload size={16}/> 백업 복원<input type="file" accept=".json,application/json" onChange={importJson}/></label></div>

    {error&&<p className="pt-error" role="alert">{error}</p>}
    {form&&<div className="pt-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setForm(null)}}><form className="pt-modal" onSubmit={saveProduct}>
      <div className="pt-form-head"><h3>{products.some(p=>p.id===form.id)?'상품 수정':'관심 상품 등록'}</h3><button type="button" onClick={()=>setForm(null)}>닫기</button></div>
      <label>상품명 *<input required maxLength={180} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="예: 휠라 에어플로우 후드 경량 다운"/></label>
      
      {form.sourceUrl&&<div className="pt-import-preview">
        <small>상품번호 {form.sourceProductId} · {form.sourceStore}</small>
        {form.imageUrl&&<img src={form.imageUrl} alt="상품 사진 후보" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none'}}/>}
        <a href={form.sourceUrl} target="_blank" rel="noopener noreferrer">원본 네이버 상품 확인 ↗</a>
        
        <small>원본 상품 페이지에서 이름과 사진을 확인해줘.</small>
      </div>}
      <label>상품 사진 URL (선택)<input type="url" placeholder="https://" value={form.imageUrl||''} onChange={e=>setForm(p=>({...p,imageUrl:e.target.value}))}/></label>
      <label>품번 / 모델 코드<input maxLength={140} value={form.model} onChange={e=>setForm(p=>({...p,model:e.target.value}))} placeholder="정확한 품번"/></label>
      <div className="pt-pair"><label>색상<input maxLength={100} value={form.color} onChange={e=>setForm(p=>({...p,color:e.target.value}))}/></label><label>사이즈<input maxLength={100} value={form.size} onChange={e=>setForm(p=>({...p,size:e.target.value}))}/></label></div>
      
      <label>공식몰 URL (선택)<input type="url" placeholder="https://" value={form.officialUrl??(form.id===FILA_ID?FILA_OFFICIAL_URL:'')} onChange={e=>setForm(p=>({...p,officialUrl:e.target.value}))}/></label>
      <label>현재 판매가 / 참고 가격 (원)<input type="number" min="0" step="1" value={form.sourcePrice??''} onChange={e=>setForm(p=>({...p,sourcePrice:e.target.value}))} placeholder="상품 페이지에서 확인한 가격"/></label>
      <label>목표 가격 (원 · 선택)<input type="number" min="0" step="1" value={form.target??''} onChange={e=>setForm(p=>({...p,target:e.target.value}))} placeholder="원하는 구매 가격을 직접 입력"/></label>
      <button className="pt-main" type="submit" disabled={busy}>상품 저장</button>
    </form></div>}

  </section>;
}
