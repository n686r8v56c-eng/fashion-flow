import React,{useEffect,useState} from 'react';
import {ImagePlus,Search,Shirt,ExternalLink,Copy,Trash2} from 'lucide-react';
import {supabase} from './supabase';
import {compressImageForZip} from './compressImages';
import './OutfitAnalysis.css';
async function authHeaders(){
 if(!supabase)throw Error('앱 로그인 설정을 확인해 줘.');
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.access_token)throw Error('로그인 후 이용해 줘.');
 return {Authorization:'Bearer '+session.access_token};
}
function ItemCard({item,index}){
 const [mode,setMode]=useState('similar'),[query,setQuery]=useState(item.query),[items,setItems]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[checked,setChecked]=useState(''),[copied,setCopied]=useState(false);
 async function search(signal){
  setBusy(true);setError('');setItems(null);setChecked('');
  try{
   const headers=await authHeaders();
   const response=await fetch('/api/product-search?'+new URLSearchParams({query:query.trim()}),{headers,signal});
   const data=await response.json();if(!response.ok)throw Error(data.error||'상품을 찾지 못했어.');
   setItems((data.items||[]).filter(x=>/^https:\/\//.test(x.url)).sort((a,b)=>(a.price>0?a.price:Infinity)-(b.price>0?b.price:Infinity)));setChecked(new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}));
  }catch(e){if(e.name!=='AbortError')setError(e.message)}finally{if(!signal?.aborted)setBusy(false)}
 }
 useEffect(()=>{const controller=new AbortController();search(controller.signal);return()=>controller.abort()},[]);
 function changeMode(next){setMode(next);setQuery(next==='exact'?item.exactQuery:item.query);setItems(null);setError('');setChecked('')}
 return <article className="outfit-ai-card">
  <div className="outfit-ai-item-title"><span>{String(index+1).padStart(2,'0')}</span><h3>{item.name}</h3><small>분류 확신 {item.confidence}</small></div>
  <p>{item.features}</p>
  <p className="outfit-ai-muted">미확인 · {item.uncertainty||'정확한 브랜드·품번·소재'}<br/>브랜드 단서 · {item.brandEvidence||'미확인'}</p>
  <div className="outfit-ai-actions"><button type="button" className={mode==='similar'?'primary':'light'} disabled={busy} onClick={()=>changeMode('similar')}>비슷하게 저렴하게</button><button type="button" className={mode==='exact'?'primary':'light'} disabled={busy||!item.exactQuery} onClick={()=>changeMode('exact')}>동일 상품 후보</button></div>
  {!item.exactQuery&&<small className="outfit-ai-muted">동일 상품을 찾을 브랜드·품번 단서가 부족해.</small>}
  <form onSubmit={e=>{e.preventDefault();search()}} className="outfit-ai-search"><label>검색 키워드<input aria-label={item.name+' 검색 키워드'} value={query} maxLength={100} minLength={2} required disabled={busy} onChange={e=>{setQuery(e.target.value);setItems(null);setChecked('')}}/></label><button className="light" type="button" title="키워드 복사" disabled={busy} onClick={async()=>{try{await navigator.clipboard.writeText(query);setCopied(true)}catch{setError('키워드를 길게 눌러 복사해 줘.')}}}><Copy size={16}/>{copied?'복사됨':'복사'}</button><button className="primary" disabled={busy||query.trim().length<2}><Search size={16}/>{busy?'찾는 중…':'검색'}</button></form>
  {error&&<p role="alert" className="outfit-ai-error">{error}</p>}
  {items&&<><div className="outfit-ai-results-title"><b>{mode==='exact'?'동일 상품 검색 후보':'유사 디자인 검색 후보'}</b><small>상품 일치 미확인</small></div>
   <p className="outfit-ai-muted">검색된 {items.length}개 중 상품가가 낮은 2개 · 배송비·쿠폰·옵션·재고 미확인</p>
   <div className="outfit-ai-products">{items.slice(0,2).map((product,i)=><a href={product.url} key={product.productId||product.url} target="_blank" rel="noopener noreferrer" className="outfit-ai-product">
    {product.image&&/^https:\/\//.test(product.image)?<img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<Shirt size={28}/>}
    <div><small>구매 후보 {i+1} · {product.shop||'판매처 미확인'}</small><b>{product.title}</b><strong>{product.price>0?product.price.toLocaleString('ko-KR')+'원':'가격 미확인'}</strong><small>키워드 검색 결과 · 사진과 디테일을 비교해 줘.</small></div><ExternalLink size={15}/>
   </a>)}</div>{!items.length&&<p>상품이 없어. 검색어에서 세부 속성을 하나 줄여 봐.</p>}
   <small className="outfit-ai-muted">확인 {checked} (한국 시간) · 전체 쇼핑몰 최저가를 보장하지 않아.</small></>}
  <a className="outfit-ai-more" href={'https://search.shopping.naver.com/search/all?query='+encodeURIComponent(query)} target="_blank" rel="noopener noreferrer">네이버 쇼핑에서 더 보기 <ExternalLink size={14}/></a>
 </article>;
}
export default function OutfitAnalysis({initialImage=''}){
 const [image,setImage]=useState(initialImage),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[preparing,setPreparing]=useState(false),[error,setError]=useState('');
 async function choose(e){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  setPreparing(true);setError('');setResult(null);setImage('');
  try{
   if(file.size>20*1024*1024)throw Error('20MB 이하 사진을 선택해 줘.');
   const blob=await compressImageForZip(file,{maxDimension:1400,quality:.78});
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('사진을 읽지 못했어.'));reader.readAsDataURL(blob)});
   if(data.length>2_800_000)throw Error('사진이 너무 커. 더 작은 사진을 선택해 줘.');
   setImage(data);
  }catch(e){setError(e.message)}finally{setPreparing(false)}
 }
 async function analyze(){
  if(!image||busy)return;setBusy(true);setError('');setResult(null);
  try{
   const headers=await authHeaders();
   const response=await fetch('/api/analyze-outfit',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({image}),signal:AbortSignal.timeout(60000)});
   const data=await response.json();if(!response.ok)throw Error(data.error||'착장을 분석하지 못했어.');setResult(data.result);
  }catch(e){setError(e.name==='TimeoutError'?'분석 시간이 길어지고 있어. 다시 시도해 줘.':e.message)}finally{setBusy(false)}
 }
 return <section className="outfit-ai">
  <div><span className="outfit-ai-eyebrow">PHOTO → ITEMS → SHOPPING</span><h2>사진으로 착장 찾기</h2><p className="outfit-ai-muted">눈에 들어온 코디, 아이템별 검색어와 구매 후보로.</p></div>
  <div className="outfit-ai-layout"><div className="outfit-ai-photo-panel">
   <label className="outfit-ai-upload"><ImagePlus size={22}/>{preparing?'사진 준비 중…':image?'다른 사진 선택':'착장 사진 선택'}<input type="file" accept="image/*" disabled={busy||preparing} onChange={choose}/></label>
   {image?<img className="outfit-ai-photo" src={image} alt="분석할 착장"/>:<div className="outfit-ai-empty"><Shirt size={48}/><p>전체 착장이 잘 보이는<br/>사진 한 장을 골라 줘.</p></div>}
   <button className="primary outfit-ai-analyze" disabled={!image||busy||preparing} onClick={analyze}><Search size={18}/>{busy?'아이템 분석 중…':'착장 분석 + 구매 후보 찾기'}</button>
   {image&&<button className="light" disabled={busy||preparing} onClick={()=>{setImage('');setResult(null);setError('')}}><Trash2 size={16}/> 초기화</button>}
   <p className="outfit-ai-muted">분석을 누르면 축소 사진이 AI 서비스로 전송돼. 사진과 결과는 자동 저장하지 않아. 화면을 나가면 초기화돼.</p>
  </div><div className="outfit-ai-output" aria-live="polite">
   {error&&<p role="alert" className="outfit-ai-error">{error}</p>}
   {busy&&<div className="outfit-ai-card">색·실루엣·디테일을 살펴보고 있어…</div>}
   {result?<><div className="outfit-ai-summary"><b>{result.summary}</b><p>AI의 시각적 추정이야. 정확한 브랜드·소재는 별도 확인이 필요해. 구매 후보는 검색어 기반이며 사진 일치를 검증한 상품은 아니야.</p></div>{result.items.map((item,index)=><ItemCard key={index} item={item} index={index}/>)}</>:!busy&&<div className="outfit-ai-card"><h3>사진 한 장으로 이렇게 찾아줘</h3><p>① 아이템과 눈에 보이는 특징 분석</p><p>② 아이템별 검색 키워드 생성·수정</p><p>③ 네이버 검색 후보 중 낮은 상품가 2개 표시</p><small className="outfit-ai-muted">AI 분석과 쇼핑 검색은 서버 API 설정이 필요해. 미연결 시 설정할 항목을 알려줘.</small></div>}
  </div></div>
 </section>;
}
