import React,{useEffect,useMemo,useState} from 'react';
import {SEASONS,GROUPS,KEYWORDS,DETAIL_SEEDS,REFERENCE_SEEDS,PRODUCT_SEEDS} from './detailLabData.js';
import {RESEARCH_PRODUCTS,RESEARCH_ENRICHMENTS} from './detailLabResearch.js';
import {NARRATIVE_RESEARCH,NARRATIVE_SCHEMA} from './detailLabNarrative.js';
import {SPEECH_TACTICS,SPEECH_QUOTES,SPEECH_SOURCE_NOTE} from './detailLabSpeech.js';
import {PAIN_POINT_SEEDS} from './detailLabPainPoints.js';
import './DetailLab.css';

const initial=()=>({refs:[],products:[],details:[],productAdditions:{},classOverrides:{},painPoints:[],schemaVersion:1});
const id=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2);
const validUrl=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
const dateNow=()=>new Date().toISOString();
const clean=v=>String(v??'').trim();
const arrays=v=>Array.isArray(v)?v:[];
const DB_NAME='fashion-detail-lab-v1',STORE='userData';
function dbOpen(){
 return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
async function dbGet(key){const db=await dbOpen();try{return await new Promise((res,rej)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(key);req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)})}finally{db.close()}}
async function dbPut(key,value){const db=await dbOpen();try{await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}finally{db.close()}}
const mergedRefs=data=>[...REFERENCE_SEEDS,...arrays(data.refs).filter(x=>!REFERENCE_SEEDS.some(s=>s.id===x.id))];
const mergedProducts=data=>[...PRODUCT_SEEDS.map(p=>({...p,features:[...arrays(p.features),...arrays(RESEARCH_ENRICHMENTS[p.id]),...arrays(data.productAdditions?.[p.id])]})),...RESEARCH_PRODUCTS.map(p=>({...p,features:[...arrays(p.features),...arrays(data.productAdditions?.[p.id])]})),...arrays(data.products).filter(x=>![...PRODUCT_SEEDS,...RESEARCH_PRODUCTS].some(s=>s.id===x.id))];
const mergedDetails=data=>[...DETAIL_SEEDS,...arrays(data.details).filter(x=>!DETAIL_SEEDS.some(s=>s.id===x.id))];
const refOptions=(data,keyword)=>mergedRefs(data).filter(x=>(x.keyword||'경량패딩')===keyword);
function sourceCount(detail,refs){return refs.filter(r=>arrays(r.details).includes(detail)).length}
function clickDownload(name,data){const file=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function composePrompt(keyword,products,detailNames,format){
 const lines=products.map(p=>'- '+p.title+' ('+(p.brand||'브랜드 미확인')+'): '+arrays(p.features).filter(f=>detailNames.includes(f.detail)).map(f=>f.detail+' / 영상 관찰: '+f.observation+' / 평가: '+f.evaluation+' / 소비자 가치 가설: '+f.value).join('; ')).join('\n');
 return [
  '당신은 패션 상품 분석과 소비자 셀링 콘텐츠를 연결하는 콘텐츠 기획자입니다.',
  '아래 상품 디테일은 스크립트에서 언급된 관찰·주관적 평가를 정리한 연구 기록입니다. 공식 제품 사양, 실제 성능, 사용자 사용 경험이 독립적으로 검증되었다고 간주하지 마세요.',
  '카피 시뮬레이션은 판매 준비가 끝난 브랜드의 소비자 대상 문체로 작성하되, 기획자가 만들고 싶다고 말하거나 소비자에게 개발 의견을 묻는 문체는 사용하지 마세요.',
  '상품명·가격·성능·소재·효능·협찬 여부·공식 인증 등 확인되지 않은 내용을 사실로 지어내지 마세요. 미검증 표시는 판매 카피 본문 밖에 둡니다.',
  '',
  '상품 키워드: '+keyword,'콘텐츠 형식: '+format,
  '선택된 디테일: '+(detailNames.join(', ')||'없음'),
  '상품 카드별 관찰·평가:',lines||'(선택된 제품 없음)',
  '',
  '1. 디테일 → 관찰된 변화 → 소비자 가치 → 설득 표현을 연결한 요약표를 만드세요.',
  '2. 선택한 형식에 적합한 완성형 콘텐츠 초안을 작성하세요.',
  '3. 실제 시연이 필요하다면 촬영 액션을 별도 정리하세요.',
  '4. 영상 속 주관적 의견과 확인된 구조적 특징, 아직 미확인인 주장을 분리하세요.',
  '5. 마지막에 게시 전 확인할 상품 사실만 간단히 적으세요.'
 ].join('\n');
}
const EXAMPLE_SEASON='겨울',EXAMPLE_KEYWORD='경량패딩';
export default function DetailLab({userId}){
 const [tab,setTab]=useState('키워드');
 const [season,setSeason]=useState(EXAMPLE_SEASON),[group,setGroup]=useState('전체'),[keyword,setKeyword]=useState(EXAMPLE_KEYWORD),[term,setTerm]=useState('');
 const [data,setData]=useState(initial),[ready,setReady]=useState(false),[notice,setNotice]=useState('');
 const [refForm,setRefForm]=useState({title:'',url:'',type:'착장·비교 리뷰',notes:'',details:''});
 const [productForm,setProductForm]=useState({title:'',brand:'',referenceId:'',notes:'',detail:'',observation:'',evaluation:'',value:'',time:''});
 const [detailForm,setDetailForm]=useState({group:'컬러·배색',name:'',note:''});
 const [productSource,setProductSource]=useState('전체 영상');
 const [narrativeSource,setNarrativeSource]=useState('script-1');
 const [speechSource,setSpeechSource]=useState('전체');
 const [speechCategory,setSpeechCategory]=useState('전체'),[speechTactic,setSpeechTactic]=useState('전체'),[speechQuery,setSpeechQuery]=useState('');
 const [painForm,setPainForm]=useState({title:'',pain:'',solution:''}),[editingPain,setEditingPain]=useState('');
 const [detailScope,setDetailScope]=useState('전체 상품'),[selectedDetail,setSelectedDetail]=useState(''),[detailSeason,setDetailSeason]=useState('전체'),[detailGroup,setDetailGroup]=useState('전체'),[detailBrand,setDetailBrand]=useState('전체'),[detailQuery,setDetailQuery]=useState('');
 const [picked,setPicked]=useState([]),[format,setFormat]=useState('최종 셀링 카피 시뮬레이션'),[draft,setDraft]=useState(''),[importing,setImporting]=useState(false);
 const key='user:'+userId;
 useEffect(()=>{let active=true;setReady(false);setData(initial());dbGet(key).then(saved=>{if(active){setData(saved&&typeof saved==='object'?{...initial(),...saved}:initial());setReady(true)}}).catch(e=>{if(active){setNotice('로컬 저장소를 읽지 못했어: '+e.message);setReady(true)}});return()=>{active=false}},[key]);
 const commit=fn=>{if(!ready){setNotice('데이터 읽기를 완료한 뒤 다시 시도해 줘.');return}const next=fn(data);dbPut(key,next).then(()=>{setData(next);setNotice('이 기기의 DETAIL LAB에 저장했어. JSON 백업도 권장해.')}).catch(e=>setNotice('저장 실패: '+e.message))};
 const keywords=KEYWORDS.filter(x=>x.season===season);
 const filtered=keywords.filter(x=>(group==='전체'||(data.classOverrides?.[x.id]||x.group)===group)&&x.keyword.includes(term));
 const activeRows=KEYWORDS.filter(x=>x.keyword===keyword);
 const refs=mergedRefs(data),products=mergedProducts(data),details=mergedDetails(data);
 const currentRefs=refs.filter(r=>(r.keyword||'경량패딩')===keyword);
 const currentNarrative=NARRATIVE_RESEARCH.find(n=>n.id===narrativeSource);
 const speechCategories=SPEECH_TACTICS.filter(c=>speechCategory==='전체'||c.id===speechCategory);
 const speechTactics=speechCategories.flatMap(c=>c.tactics);
 const visibleSpeech=SPEECH_QUOTES.filter(x=>(speechSource==='전체'||x.sourceId===speechSource)&&NARRATIVE_RESEARCH.some(n=>n.id===x.sourceId&&n.keyword===keyword)&&(speechCategory==='전체'||x.tactics.some(t=>t.startsWith(speechCategory+'-')))&&(speechTactic==='전체'||x.tactics.includes(speechTactic))&&(!speechQuery||[x.quote,x.note,x.time].some(v=>v.includes(speechQuery))));
 const researchBundle=NARRATIVE_RESEARCH.filter(n=>n.keyword===keyword).map(n=>({...n,reference:refs.find(r=>r.id===n.id)||null,linkedProductIds:products.filter(p=>p.referenceId===n.id).map(p=>p.id)}));
 const currentProducts=products.filter(p=>p.keyword===keyword);
 const sourceProducts=currentProducts.filter(p=>productSource==='전체 영상'||p.referenceId===productSource);
 const currentDetails=details.filter(d=>d.keyword===keyword||!d.keyword);
 const extractedDetails=Array.from(new Set(products.flatMap(p=>arrays(p.features).map(f=>f.detail)))).filter(Boolean);
 const allDictionary=Array.from(new Map([...details,...extractedDetails.filter(name=>!details.some(d=>d.name===name)).map(name=>({id:'observed:'+name,name,group:'영상에서 추가 발견',origin:'상품 카드 기반 자동 추출',status:'자동 관찰'}))].map(d=>[d.name,d])).values());
 const brands=Array.from(new Set(products.map(p=>clean(p.brand)||'미확인'))).sort((a,b)=>a.localeCompare(b,'ko'));
 const brandProducts=detailBrand==='전체'?products:products.filter(p=>(clean(p.brand)||'미확인')===detailBrand);
 const visibleDetails=(detailScope==='전체 상품'?allDictionary:allDictionary.filter(d=>d.keyword===keyword||!d.keyword||brandProducts.filter(p=>p.keyword===keyword).some(p=>arrays(p.features).some(f=>f.detail===d.name))))
   .filter(d=>d.name.includes(detailQuery)&&(detailBrand==='전체'||brandProducts.some(p=>arrays(p.features).some(f=>f.detail===d.name))));
 const matchedProducts=brandProducts.filter(p=>arrays(p.features).some(f=>f.detail===selectedDetail)&& (detailSeason==='전체'||p.season===detailSeason) && (detailGroup==='전체'||KEYWORDS.some(k=>k.keyword===p.keyword&&(data.classOverrides?.[k.id]||k.group)===detailGroup)));
 const matchingReferences=refs.filter(r=>matchedProducts.some(p=>p.referenceId===r.id));
 const candidate=new Set([...currentProducts.flatMap(p=>arrays(p.features).map(f=>f.detail)),...currentRefs.flatMap(r=>arrays(r.details))]);
 const options=Array.from(candidate);
 const selectKeyword=x=>{setKeyword(x);setTab('레퍼런스');setPicked([]);setProductForm(f=>({...f,detail:''}))};
 const addReference=()=>{if(!clean(refForm.title)){setNotice('영상 제목을 입력해 줘.');return}if(refForm.url&&!validUrl(refForm.url)){setNotice('영상 URL을 확인해 줘.');return}
  const r={id:id(),keyword,title:clean(refForm.title),url:refForm.url?validUrl(refForm.url):'',type:refForm.type,notes:refForm.notes,source:'사용자 등록',details:refForm.details.split(',').map(clean).filter(Boolean),status:'등록·분석 대기',createdAt:dateNow()};
  commit(x=>({...x,refs:[...arrays(x.refs),r]}));setRefForm({title:'',url:'',type:'착장·비교 리뷰',notes:'',details:''});
 };
 const addProduct=()=>{if(!clean(productForm.title)){setNotice('상품명을 입력해 줘.');return}
  const features=clean(productForm.detail)?[{detail:clean(productForm.detail),observation:clean(productForm.observation),evaluation:clean(productForm.evaluation),value:clean(productForm.value),time:clean(productForm.time)}]:[];
  const p={id:id(),keyword,season,title:clean(productForm.title),brand:clean(productForm.brand),referenceId:productForm.referenceId,notes:clean(productForm.notes),features,createdAt:dateNow()};
  commit(x=>({...x,products:[...arrays(x.products),p]}));setProductForm({title:'',brand:'',referenceId:'',notes:'',detail:'',observation:'',evaluation:'',value:'',time:''});
 };
 const addFeature=(productId,feature)=>{if(!clean(feature.detail))return;commit(x=>[...PRODUCT_SEEDS,...RESEARCH_PRODUCTS].some(p=>p.id===productId)?({...x,productAdditions:{...x.productAdditions,[productId]:[...arrays(x.productAdditions?.[productId]),{...feature}]}}):({...x,products:arrays(x.products).map(p=>p.id===productId?{...p,features:[...arrays(p.features),{...feature}]}:p)}))};
 const addDetail=()=>{if(!clean(detailForm.name)){setNotice('디테일 이름을 입력해 줘.');return}if(details.some(d=>d.name===clean(detailForm.name)&&d.keyword===keyword)){setNotice('이 키워드에 같은 디테일이 있어.');return}
  const d={id:id(),keyword,group:detailForm.group,name:clean(detailForm.name),note:clean(detailForm.note),status:'연구 후보',origin:'사용자 등록',createdAt:dateNow()};
  commit(x=>({...x,details:[...arrays(x.details),d]}));setDetailForm(f=>({...f,name:'',note:''}));
 };
 const handleFile=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>5*1024*1024){setNotice('5MB 이하 JSON 백업만 가져올 수 있어.');return}
  try{const source=JSON.parse(await file.text());if(source.format!=='fashion-detail-lab-v1'||!source.payload||typeof source.payload!=='object')throw Error('DETAIL LAB v1 백업 파일만 지원해.');
   const incoming=source.payload;if(!['refs','products','details'].every(field=>Array.isArray(incoming[field])))throw Error('백업 항목 구조가 올바르지 않아.');
   const existingIds=new Set([...refs,...products,...details,...arrays(data.painPoints)].map(x=>x.id));
   const newRows={};for(const field of ['refs','products','details','painPoints'])newRows[field]=arrays(incoming[field]).filter(x=>x&&typeof x==='object'&&typeof x.id==='string'&&!existingIds.has(x.id)&& (field!=='painPoints'||(typeof x.title==='string'&&typeof x.solution==='string')));
   const n=Object.values(newRows).reduce((sum,list)=>sum+list.length,0);if(!n){setNotice('새로 추가할 항목이 없어. 기존 자료는 유지했어.');return}
   if(!confirm('현재 데이터를 유지하며 신규 '+n+'개 항목을 병합할까?'))return;
   commit(x=>({...x,refs:[...arrays(x.refs),...newRows.refs],products:[...arrays(x.products),...newRows.products],details:[...arrays(x.details),...newRows.details],painPoints:[...arrays(x.painPoints),...newRows.painPoints],productAdditions:{...x.productAdditions,...Object.fromEntries(Object.entries(incoming.productAdditions||{}).map(([id,features])=>[id,[...arrays(x.productAdditions?.[id]),...arrays(features)]]))}}));
  }catch(err){setNotice('가져오기 실패: '+err.message)}finally{setImporting(false)}
 };
 const prompt=composePrompt(keyword,currentProducts,picked,format);
 const copyPrompt=async()=>{try{await navigator.clipboard.writeText(prompt);setNotice('AI 지시문을 복사했어.')}catch{setDraft(prompt);setNotice('복사가 제한돼 지시문을 아래에 표시했어.')}};
 return <section className="dl-root">
  <div className="dl-heading"><div><h2>DETAIL LAB</h2><p>시즌 키워드 → 롱폼 레퍼런스 → 상품별 디테일 → 설득 역조합</p></div><span className="dl-pill">연구 1차</span></div>
  <div className="dl-status"><strong>Market Flow 원본 200개</strong><span>봄 50 · 여름 50 · 가을 50 · 겨울 50</span><small>정적 키워드 스냅샷 · 실시간 동기화 아님 · 로컬 IndexedDB 저장</small></div>
  <nav className="dl-tabs" aria-label="DETAIL LAB 탭">{['키워드','레퍼런스','상품 분석','디테일 사전','콘텐츠 구조','실제 발화','페인포인트','역조합'].map(t=><button type="button" key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</nav>
  {tab==='키워드'&&<div className="dl-panel">
   <div className="dl-row dl-season">{SEASONS.map(s=><button key={s} className={season===s?'selected':''} onClick={()=>{setSeason(s);setGroup('전체')}}>{s} · 50</button>)}</div>
   <div className="dl-filters"><input value={term} onChange={e=>setTerm(e.target.value)} placeholder="키워드 검색"/><select aria-label="대분류" value={group} onChange={e=>setGroup(e.target.value)}><option>전체</option>{GROUPS.map(g=><option key={g}>{g}</option>)}</select></div>
   <p className="dl-muted">대분류는 수정 가능한 분석용 분류야. 원본 키워드는 삭제하거나 변경하지 않아.</p>
   <div className="dl-list">{filtered.map(x=>{const refN=refs.filter(r=>(r.keyword||'경량패딩')===x.keyword).length;return <div className="dl-key" key={x.id}><button type="button" onClick={()=>selectKeyword(x.keyword)}><strong>{x.keyword}</strong><small>{refN}/3편 · {refN>=3?'스크립트 확보':'분석 대기'}</small></button><select aria-label={x.keyword+' 대분류'} value={data.classOverrides?.[x.id]||x.group} onChange={e=>commit(d=>({...d,classOverrides:{...d.classOverrides,[x.id]:e.target.value}}))}>{GROUPS.map(g=><option key={g}>{g}</option>)}</select></div>})}</div>
   {!filtered.length&&<p className="dl-muted">해당 조건의 키워드가 없어.</p>}
  </div>}
  {tab==='레퍼런스'&&<div className="dl-panel">
   <div className="dl-toolbar"><h3>{keyword} · 롱폼 분석</h3><span>{currentRefs.length}/3편 확보</span></div>
   {keyword==='경량패딩'&&<p className="dl-muted">3편의 제공 스크립트를 기준으로 등장 상품·사례의 분석 카드를 연결했어. 1편의 타임코드가 포함된 보완 전사가 실제 발화 탭에 연결됐고, 2편은 직접 착용하지 않은 트렌드 사례 상품도 포함해.</p>}
   {currentRefs.map(r=><article className="dl-card" key={r.id}><div className="dl-between"><strong>{r.title}</strong><span className="dl-pill">{r.status||'등록'}</span></div><p>{r.type}</p><small>{r.source||'사용자 등록'} · {r.url?<a target="_blank" rel="noopener noreferrer" href={r.url}>영상 열기</a>:'영상 URL 미확인'}</small><p>{r.notes}</p><div className="dl-tags">{arrays(r.details).map(t=><span key={t}>{t}</span>)}</div><button type="button" onClick={()=>{setTab('상품 분석');setProductForm(f=>({...f,referenceId:r.id}))}}>상품 카드로 분석 →</button></article>)}
   <div className="dl-form"><h4>+ 레퍼런스 추가</h4><label>영상 제목<input value={refForm.title} onChange={e=>setRefForm(f=>({...f,title:e.target.value}))}/></label><label>영상 URL (선택)<input value={refForm.url} onChange={e=>setRefForm(f=>({...f,url:e.target.value}))} placeholder="https://youtu.be/..."/></label><label>분석 유형<select value={refForm.type} onChange={e=>setRefForm(f=>({...f,type:e.target.value}))}>{['착장·비교 리뷰','트렌드·소재 해설','선택·순위 예고 리뷰','스타일링 가이드','기타'].map(x=><option key={x}>{x}</option>)}</select></label><label>분석 내용<textarea rows={3} value={refForm.notes} onChange={e=>setRefForm(f=>({...f,notes:e.target.value}))}/></label><label>발견한 디테일 (쉼표 구분)<input value={refForm.details} onChange={e=>setRefForm(f=>({...f,details:e.target.value}))}/></label><button onClick={addReference}>레퍼런스 저장</button></div>
  </div>}
  {tab==='상품 분석'&&<div className="dl-panel">
   <div className="dl-toolbar"><h3>{keyword} · 상품 카드</h3><span>{currentProducts.length}개 · 디테일 {currentProducts.reduce((sum,p)=>sum+arrays(p.features).length,0)}건</span></div>
   {keyword==='경량패딩'&&<p className="dl-muted">영상 1: 10개 착장 · 영상 2: 12개 제품·브랜드 사례 · 영상 3: 13개 착장·컬러 구간. 정확한 품번·브랜드명 미확인 사례 포함. 2편에는 직접 평가하지 않은 제품도 있어.</p>}
   <label>영상별 카드 필터<select aria-label="영상별 상품 필터" value={productSource} onChange={e=>setProductSource(e.target.value)}><option value="전체 영상">전체 영상</option>{currentRefs.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
   {sourceProducts.map(p=><ProductCard key={p.id} product={p} reference={refs.find(r=>r.id===p.referenceId)} editable={true} onAdd={f=>addFeature(p.id,f)} />)}
   <div className="dl-form"><h4>+ 상품 카드 생성</h4><label>상품명<input value={productForm.title} onChange={e=>setProductForm(f=>({...f,title:e.target.value}))}/></label><label>브랜드<input value={productForm.brand} onChange={e=>setProductForm(f=>({...f,brand:e.target.value}))}/></label><label>연결 레퍼런스<select value={productForm.referenceId} onChange={e=>setProductForm(f=>({...f,referenceId:e.target.value}))}><option value="">선택 안 함</option>{currentRefs.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label><label>디테일<input value={productForm.detail} onChange={e=>setProductForm(f=>({...f,detail:e.target.value}))} placeholder="예: 이중 지퍼"/></label><label>관찰 사실<textarea rows={2} value={productForm.observation} onChange={e=>setProductForm(f=>({...f,observation:e.target.value}))}/></label><label>진행자 평가<input value={productForm.evaluation} onChange={e=>setProductForm(f=>({...f,evaluation:e.target.value}))}/></label><label>소비자 가치 가설<input value={productForm.value} onChange={e=>setProductForm(f=>({...f,value:e.target.value}))}/></label><label>타임스탬프<input value={productForm.time} onChange={e=>setProductForm(f=>({...f,time:e.target.value}))} placeholder="예: 01:15"/></label><label>메모<input value={productForm.notes} onChange={e=>setProductForm(f=>({...f,notes:e.target.value}))}/></label><button onClick={addProduct}>상품 카드 저장</button></div>
  </div>}
  {tab==='디테일 사전'&&<div className="dl-panel">
   <div className="dl-toolbar"><h3>디테일 사전 · 상품 역검색</h3><span>{visibleDetails.length}개 디테일 후보</span></div>
   <p className="dl-muted">디테일을 누르면 그 디테일이 실제로 기록된 상품 카드만 보여줘. 원본 상품 카드와 사전 데이터는 변경되지 않아.</p>
   <div className="dl-filters"><select aria-label="디테일 범위" value={detailScope} onChange={e=>setDetailScope(e.target.value)}><option>전체 상품</option><option>현재 키워드</option></select><input aria-label="디테일 검색" placeholder="디테일 이름 검색" value={detailQuery} onChange={e=>setDetailQuery(e.target.value)}/></div>
   <label>브랜드 필터<select aria-label="브랜드 필터" value={detailBrand} onChange={e=>{setDetailBrand(e.target.value);setSelectedDetail('')}}><option value="전체">전체 브랜드</option>{brands.map(b=><option key={b} value={b}>{b}</option>)}</select></label>
   {Array.from(new Set(visibleDetails.map(d=>d.group))).map(g=><div key={g} className="dl-dict"><h4>{g}</h4><div className="dl-tags dl-clickable-tags">{visibleDetails.filter(d=>d.group===g).map(d=><button type="button" key={d.id} title={d.origin||''} aria-pressed={selectedDetail===d.name} className={selectedDetail===d.name?'selected':''} onClick={()=>setSelectedDetail(v=>v===d.name?'':d.name)}>{d.name} <small>· {brandProducts.filter(p=>arrays(p.features).some(f=>f.detail===d.name)).length}상품</small></button>)}</div></div>)}
   {selectedDetail&&<section className="dl-results" aria-label="디테일별 상품 검색 결과">
     <div className="dl-toolbar"><h3>「{selectedDetail}」 연결 상품</h3><button type="button" onClick={()=>{setSelectedDetail('');setDetailSeason('전체');setDetailGroup('전체');setDetailBrand('전체');setDetailQuery('')}}>필터 해제</button></div>
     <div className="dl-filters"><select aria-label="상품 시즌 필터" value={detailSeason} onChange={e=>setDetailSeason(e.target.value)}><option>전체</option>{SEASONS.map(x=><option key={x}>{x}</option>)}</select><select aria-label="상품 대분류 필터" value={detailGroup} onChange={e=>setDetailGroup(e.target.value)}><option>전체</option>{GROUPS.map(x=><option key={x}>{x}</option>)}</select></div>
     <p className="dl-muted">상품 카드 {matchedProducts.length}개 · 참고 레퍼런스 {matchingReferences.length}편. 레퍼런스 언급만으로 상품 디테일을 확정하지 않아.</p>
     {matchedProducts.map(p=><ProductCard key={p.id} product={{...p,features:arrays(p.features).filter(f=>f.detail===selectedDetail)}} reference={refs.find(r=>r.id===p.referenceId)} editable={false} onAdd={()=>{}} />)}
     {matchedProducts.length===0&&<p className="dl-muted">현재 필터에 일치하는 상품 카드가 없어. 디테일 후보는 존재하지만 상품에 아직 연결하지 않았을 수도 있어.</p>}
   </section>}
   <div className="dl-form"><h4>+ 디테일 분류 추가</h4><label>대분류<select value={detailForm.group} onChange={e=>setDetailForm(f=>({...f,group:e.target.value}))}>{Array.from(new Set(DETAIL_SEEDS.map(d=>d.group))).map(g=><option key={g}>{g}</option>)}</select></label><label>디테일명<input value={detailForm.name} onChange={e=>setDetailForm(f=>({...f,name:e.target.value}))}/></label><label>평가 기준·메모<textarea rows={2} value={detailForm.note} onChange={e=>setDetailForm(f=>({...f,note:e.target.value}))}/></label><button onClick={addDetail}>사전 후보 추가</button></div>
  </div>}
  {tab==='콘텐츠 구조'&&<div className="dl-panel">
   <div className="dl-toolbar"><h3>콘텐츠 구조 분석 · {keyword}</h3><span>{researchBundle.length}편 분석</span></div>
   <p className="dl-muted">상품 디테일과 같은 레퍼런스 ID를 공유하는 콘텐츠 분석이야. 영상 후킹·약속·전개 장치·CTA를 한 번 분석해 Writing Flow에서 재사용하도록 별도로 내보낼 수 있어. 이 기록은 콘텐츠 분석 가설이며 조회수·지속률·판매 효과를 뜻하지 않아.</p>
   {researchBundle.length===0?<p className="dl-muted">아직 콘텐츠 구조 분석이 등록되지 않았어.</p>:<>
   <label>분석 영상 선택<select value={narrativeSource} onChange={e=>setNarrativeSource(e.target.value)}>{researchBundle.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
   {currentNarrative&&currentNarrative.keyword===keyword&&<article className="dl-card">
     <div className="dl-between"><strong>{currentNarrative.title}</strong><span className="dl-pill">{currentNarrative.engine}</span></div>
     <p><strong>영상 목적:</strong> {currentNarrative.purpose}</p><p><strong>화자 역할:</strong> {currentNarrative.presenterRole}</p><p><strong>전개 단위:</strong> {currentNarrative.unit}</p>
     <h4>오프닝 후킹</h4><p>{currentNarrative.hook}</p>
     <h4>시청자 약속 → 실제 회수</h4>
     {currentNarrative.promiseOutcome.map((p,i)=><div key={i} className="dl-feature"><strong>{p.promise}</strong><p>결말: {p.outcome}</p><small>회수 상태: {p.status}</small></div>)}
     <h4>평가 기준</h4><div className="dl-tags">{currentNarrative.evaluationCriteria.map(x=><span key={x}>{x}</span>)}</div>
     <h4>타임라인 · 장면별 장치</h4>
     {currentNarrative.structure.map((x,i)=><div className="dl-feature" key={i}><strong>{x.start}–{x.end} · {x.role}</strong><p>장치: {x.device}</p><p>스크립트 근거: {x.evidence}</p></div>)}
     <h4>반복·특수 이야기 장치</h4>
     {currentNarrative.devices.map((x,i)=><div className="dl-feature" key={i}><strong>{x.name}</strong><p>근거: {x.evidence}</p><small>근거 유형: {x.kind}</small></div>)}
     <h4>엔딩 · CTA</h4><p>{currentNarrative.ending}</p><div className="dl-tags">{currentNarrative.cta.map(x=><span key={x}>{x}</span>)}</div>
     <h4>상업적 관계·검증 한계</h4><p>{currentNarrative.disclosure}</p><p>{currentNarrative.audienceHypothesis}</p>{currentNarrative.knownLimitations.map((x,i)=><p key={i}>미확인·주의: {x}</p>)}
     <p className="dl-muted">연결 상품: {products.filter(p=>p.referenceId===currentNarrative.id).length}개 · 레퍼런스 ID: {currentNarrative.id}</p>
   </article>}
   <div className="dl-row"><button type="button" onClick={()=>clickDownload('fashion-writing-content-'+keyword+'-'+new Date().toISOString().slice(0,10)+'.json',{format:NARRATIVE_SCHEMA,exportedAt:dateNow(),source:'Fashion Flow DETAIL LAB',videos:researchBundle})}>Writing Flow용 분석 JSON 다운로드</button><button type="button" onClick={()=>clickDownload('fashion-detail-content-combined-'+keyword+'.json',{format:'fashion-detail-lab-research-bundle-v1',exportedAt:dateNow(),source:'Fashion Flow DETAIL LAB',videos:researchBundle,products:products.filter(p=>p.keyword===keyword),details:allDictionary.filter(d=>d.keyword===keyword||!d.keyword)})}>상품+콘텐츠 통합 JSON</button></div>
   <p className="dl-muted">Writing Flow 자동 가져오기는 아직 연결되지 않았어. JSON은 중복 분석 없이 후속 연동에 사용하는 자료야.</p>
   </>}
  </div>}
  {tab==='실제 발화'&&<div className="dl-panel">
   <div className="dl-toolbar"><h3>실제 발화 · 가치 전환 / 서사 전술</h3><span>12대 분류 · 48개 하위 항목</span></div>
   <p className="dl-muted">문장을 요약하거나 새로 만들지 않고 제공된 전사에서 인용한 원문만 보여줘. 전술은 검토용 분류이며 판매 성과가 입증된 것은 아니야.</p>
   <label>영상 선택<select value={speechSource} onChange={e=>{setSpeechSource(e.target.value);setSpeechCategory('전체');setSpeechTactic('전체')}}><option value="전체">전체 영상 ({researchBundle.length}편)</option>{researchBundle.map(n=><option key={n.id} value={n.id}>{n.title} · 원문 {SPEECH_QUOTES.filter(q=>q.sourceId===n.id).length}개</option>)}</select></label>
   <p className="dl-muted">{SPEECH_SOURCE_NOTE} · 1·2·3편의 전술별 실제 발화가 모두 연결되어 있어. 제공된 전사에서 선정한 발화 구간이며, 전체 전사 문장 수와 같지는 않아.</p>
   <div className="dl-filters">
    <label>대분류<select value={speechCategory} onChange={e=>{setSpeechCategory(e.target.value);setSpeechTactic('전체')}}><option value="전체">전체 12대 분류</option>{SPEECH_TACTICS.map(c=><option key={c.id} value={c.id}>{c.id}. {c.name}</option>)}</select></label>
    <label>세부 전술<select value={speechTactic} onChange={e=>setSpeechTactic(e.target.value)}><option value="전체">전체 세부 전술</option>{speechTactics.map(t=><option key={t.id} value={t.id}>{t.id} {t.name}</option>)}</select></label>
    <label>원문 검색<input value={speechQuery} onChange={e=>setSpeechQuery(e.target.value)} placeholder="발화·시각·판단 근거 검색"/></label>
   </div>
   <p className="dl-muted">현재 보이는 발화 {visibleSpeech.length}개 / 전체 등록 {SPEECH_QUOTES.filter(x=>NARRATIVE_RESEARCH.some(n=>n.id===x.sourceId&&n.keyword===keyword)).length}개 · 한 발화에 복수 전술 연결</p>
   {visibleSpeech.map(q=><article className="dl-card" key={q.id}>
    <div className="dl-between"><strong>{researchBundle.find(n=>n.id===q.sourceId)?.title||q.sourceId} · {q.time}</strong><span className="dl-pill">{q.confidence==='확인'?'전술 적용':'부분·유사'}</span></div>
    <blockquote style={{whiteSpace:'pre-wrap',margin:'12px 0',padding:'10px 12px',borderLeft:'3px solid #a487d1',background:'rgba(147,112,219,.06)',lineHeight:1.7}}>{q.quote}</blockquote>
    <div className="dl-tags">{q.tactics.map(code=>{const c=SPEECH_TACTICS.find(g=>g.tactics.some(t=>t.id===code));const t=c?.tactics.find(x=>x.id===code);return <span key={code}>{code} {t?.name||'미확인'}</span>})}</div>
    <p className="dl-muted">분류 근거: {q.note}</p>
   </article>)}
   {!visibleSpeech.length&&<p className="dl-muted">이 조건에서 등록된 실제 발화가 없어. 해당 전술이 쓰이지 않았다고 확정하는 의미는 아니야.</p>}
   <button type="button" onClick={()=>clickDownload('fashion-detail-lab-speech-'+speechSource+'.json',{format:'fashion-detail-lab-verbatim-speech-v1',sourceId:speechSource,sourceNote:SPEECH_SOURCE_NOTE,categories:SPEECH_TACTICS,quotes:visibleSpeech})}>현재 검색 결과 JSON 다운로드</button>
  </div>}
  {tab==='페인포인트'&&<div className="dl-panel">
   <div className="dl-toolbar"><h3>{keyword} · 페인포인트</h3><span>{(keyword==='경량패딩'?PAIN_POINT_SEEDS.length:0)+arrays(data.painPoints).filter(p=>p.keyword===keyword).length}개 항목</span></div>
   <p className="dl-muted">문제와 해결책을 한눈에 모아봐. 기본 연구 항목은 영상 발화를 바탕으로 한 가설이며 실제 시장 수요나 효과는 검증 전이야. 제목을 누르면 상세 근거가 펼쳐져.</p>
   <form className="dl-form" onSubmit={e=>{e.preventDefault();const title=clean(painForm.title),pain=clean(painForm.pain),solution=clean(painForm.solution);if(!title||!solution){setNotice('문제 제목과 해결책을 입력해 줘.');return}const entry={id:editingPain||id(),keyword,title,pain:pain||title,solution,createdAt:dateNow()};commit(x=>({...x,painPoints:editingPain?arrays(x.painPoints).map(p=>p.id===editingPain?{...p,...entry,createdAt:p.createdAt||entry.createdAt}:p):[...arrays(x.painPoints),entry]}));setPainForm({title:'',pain:'',solution:''});setEditingPain('')}}>
    <h4>{editingPain?'내 문제 수정':'+ 문제 직접 등록'}</h4>
    <label>문제 제목<input value={painForm.title} onChange={e=>setPainForm(f=>({...f,title:e.target.value}))} placeholder="예: 소매가 불편하다" required/></label>
    <label>구체적인 불편 (선택)<textarea rows={2} value={painForm.pain} onChange={e=>setPainForm(f=>({...f,pain:e.target.value}))} placeholder="왜 불편한지 기록"/></label>
    <label>해결책<textarea rows={2} value={painForm.solution} onChange={e=>setPainForm(f=>({...f,solution:e.target.value}))} placeholder="어떤 디자인·기능으로 해결할지" required/></label>
    <div className="dl-row"><button type="submit" disabled={!ready}>{editingPain?'수정 저장':'문제 저장'}</button>{editingPain&&<button type="button" onClick={()=>{setEditingPain('');setPainForm({title:'',pain:'',solution:''})}}>수정 취소</button>}</div>
   </form>
   {[...(keyword==='경량패딩'?PAIN_POINT_SEEDS:[]),...arrays(data.painPoints).filter(p=>p.keyword===keyword)].map((pain,i)=><details className="dl-card" key={pain.id} style={{marginBottom:10}}>
    <summary style={{cursor:'pointer',fontWeight:600,lineHeight:1.5}}>{i+1}. {pain.title}</summary>
    <div style={{marginTop:12,display:'grid',gap:10}}>
     <div><strong>PAIN</strong><p style={{fontSize:'inherit',margin:'4px 0 0'}}>{pain.pain||pain.title}</p></div>
     <div><strong>SOLUTION</strong><p style={{fontSize:'inherit',margin:'4px 0 0'}}>{pain.solution}</p></div>
     {arrays(pain.evidence).length>0&&<details className="dl-feature"><summary style={{cursor:'pointer'}}>스크립트 실제 발화 근거 ({pain.evidence.length})</summary>
      {pain.evidence.map(([sourceId,time],j)=>{const found=SPEECH_QUOTES.find(q=>q.sourceId===sourceId&&q.time===time);const source=NARRATIVE_RESEARCH.find(n=>n.id===sourceId);return <div key={sourceId+time+j} style={{marginTop:10}}>
       <strong>{source?.title||sourceId} · {time}</strong>
       <p>{found?'“'+found.quote+'”':'해당 원문 재확인 필요'}</p>
      </div>})}
     </details>}
     {arrays(pain.tactics).length>0&&<div className="dl-tags">{pain.tactics.map(code=>{const tactic=SPEECH_TACTICS.flatMap(c=>c.tactics).find(t=>t.id===code);return <span key={code}>{code} {tactic?.name||'미확인'}</span>})}</div>}
     {pain.validation&&<p className="dl-muted">검증 필요: {pain.validation}</p>}
     {arrays(data.painPoints).some(p=>p.id===pain.id)&&<div className="dl-row">
       <button type="button" onClick={()=>{setEditingPain(pain.id);setPainForm({title:pain.title,pain:pain.pain||'',solution:pain.solution||''})}}>수정</button>
       <button type="button" onClick={()=>{if(window.confirm('이 수동 등록 문제를 삭제할까?'))commit(x=>({...x,painPoints:arrays(x.painPoints).filter(p=>p.id!==pain.id)}))}}>삭제</button>
     </div>}
    </div>
   </details>)}
   <button type="button" onClick={()=>clickDownload('fashion-detail-lab-painpoints-'+keyword+'.json',{format:'fashion-detail-lab-painpoints-v1',keyword,origin:'디테일랩 기본 연구 + 사용자 로컬 수동 등록',painPoints:[...(keyword==='경량패딩'?PAIN_POINT_SEEDS:[]),...arrays(data.painPoints).filter(p=>p.keyword===keyword)]})}>페인포인트 자료 JSON 다운로드</button>
  </div>}
  {tab==='역조합'&&<div className="dl-panel"><h3>{keyword} · 설득 역조합</h3><p className="dl-muted">상품의 디테일·관찰·주관적 평가를 연결한 AI 작업 지시문을 생성해. 자동 생성 결과가 검증된 사실은 아니야.</p><label>출력 형식<select value={format} onChange={e=>setFormat(e.target.value)}>{['최종 셀링 카피 시뮬레이션','유튜브 롱폼 비교 구성','숏폼 리뷰 스크립트','Threads 텍스트','상세페이지','촬영 컷리스트'].map(x=><option key={x}>{x}</option>)}</select></label><h4>디테일 선택</h4><div className="dl-checks">{options.map(d=><label key={d}><input type="checkbox" checked={picked.includes(d)} onChange={e=>setPicked(v=>e.target.checked?[...v,d]:v.filter(x=>x!==d))}/>{d}</label>)}</div><div className="dl-row"><button onClick={copyPrompt}>AI 지시문 복사</button><button onClick={()=>setDraft(prompt)}>지시문 보기</button></div>{draft&&<textarea readOnly rows={14} value={draft} onFocus={e=>e.target.select()}/>}</div>}
  <div className="dl-footer"><button type="button" onClick={()=>clickDownload('fashion-detail-lab-'+new Date().toISOString().slice(0,10)+'.json',{format:'fashion-detail-lab-v1',exportedAt:dateNow(),payload:data})}>JSON 백업</button><label className="dl-import">JSON 병합 가져오기<input type="file" accept="application/json,.json" onChange={handleFile} disabled={!ready||importing}/></label><small>원본 키워드와 초기 경량패딩 샘플은 기본 제공 · 사용자 추가 기록은 이 기기에 저장</small></div>
  {notice&&<p role="status" className="dl-notice">{notice}</p>}
 </section>;
}
function ProductCard({product,reference,editable,onAdd}){
 const [adding,setAdding]=useState(false);
 const [f,setF]=useState({detail:'',observation:'',evaluation:'',value:'',time:''});
 return <article className="dl-card"><div className="dl-between"><strong>{product.title}</strong><span className="dl-pill">{product.brand||'브랜드 미확인'}</span></div><small>{reference?.title||'출처 미연결'} · {product.notes||'상세 사양 미확인'}</small>{arrays(product.features).map((x,i)=><div className="dl-feature" key={i}><strong>{x.detail}</strong>{x.time&&<small>{x.time}</small>}<p>관찰: {x.observation||'미확인'}</p><p>평가: {x.evaluation||'미확인'}</p><p>가치 가설: {x.value||'미확인'}</p></div>)}
 {editable&&<><button type="button" onClick={()=>setAdding(v=>!v)}>{adding?'추가 닫기':'+ 디테일 분석 추가'}</button>{adding&&<div className="dl-form">{[['detail','디테일'],['observation','관찰'],['evaluation','평가'],['value','소비자 가치 가설'],['time','타임스탬프']].map(([key,label])=><label key={key}>{label}<input value={f[key]} onChange={e=>setF(old=>({...old,[key]:e.target.value}))}/></label>)}<button onClick={()=>{if(!clean(f.detail))return;onAdd(f);setAdding(false);setF({detail:'',observation:'',evaluation:'',value:'',time:''})}}>분석 추가 저장</button></div>}</>}
 </article>;
}
