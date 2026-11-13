import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Camera,ImagePlus,Plus,Save,Trash2,Download,Sparkles,Layers,Shirt,BookImage,FileImage,Archive,ArrowLeft,Check,AlertTriangle} from 'lucide-react';
import {supabase} from './supabase';
import './StudioFlow.css';

const DB='fashion-studio-flow-local-v1',STORE='projects';
const ROLES=[['front','앞면'],['back','뒷면'],['side','옆면'],['fabric','원단 확대'],['detail','디테일'],['color','컬러 참고']];
const MODES=[['model','스튜디오 모델컷'],['lifestyle','라이프스타일 화보'],['flatlay','상품 단독 배경컷'],['lookbook','브랜드 룩북']];
const SCENES=[['white','화이트 스튜디오'],['warm','베이지 스튜디오'],['office','모던 오피스'],['hotel','호텔·갤러리'],['resort','리조트·자연광']];
const uid=()=>crypto.randomUUID();
const stamp=()=>new Date().toISOString();
function dbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbOperation(mode,action){const db=await dbOpen();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);const req=action(store);let value;req.onsuccess=()=>{value=req.result};req.onerror=()=>reject(req.error);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('저장 취소'))})}finally{db.close()}}
const getAll=()=>dbOperation('readonly',s=>s.getAll());
const write=row=>dbOperation('readwrite',s=>s.put(row));
const erase=id=>dbOperation('readwrite',s=>s.delete(id));
const blank=()=>({id:uid(),name:'',season:'',category:'블라우스',fabric:'',color:'',size:'',fit:'',measurements:'',notes:'',images:{},outputs:[],createdAt:stamp(),updatedAt:stamp()});
function fileImage(file){
 return new Promise((resolve,reject)=>{
  if(!file?.type.startsWith('image/')){reject(Error('이미지 파일을 선택해 줘.'));return}
  if(file.size>20*1024*1024){reject(Error('사진은 20MB 이하여야 해.'));return}
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{
   try{const scale=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.83);canvas.width=canvas.height=0;resolve(data)}
   catch(e){reject(e)}finally{URL.revokeObjectURL(url)}
  };img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('이미지를 읽지 못했어.'))};img.src=url;
 })
}
function dataFile(data,name){
 const [head,b64]=data.split(','),type=(head.match(/^data:([^;]+);base64$/)||[])[1]||'image/jpeg';
 const raw=atob(b64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return new File([bytes],name,{type});
}
function download(data,name){
 const a=document.createElement('a');a.href=data;a.download=name;document.body.appendChild(a);a.click();a.remove();
}
function saveManifest(project){
 const {images,outputs,...rest}=project;
 const payload={version:1,product:rest,sourceSlots:Object.keys(images||{}),generated:outputs.map(({data,...metadata})=>metadata),note:'이미지는 별도 저장해야 합니다. 이 파일만으로 사진 복원 불가'};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='studio-'+project.id+'.json';a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function ProductField({title,value,onChange,placeholder}){const [draft,setDraft]=useState(value||'');useEffect(()=>setDraft(value||''),[value]);return <label className="studio-field">{title}<input value={draft} placeholder={placeholder||''} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(draft!==(value||''))onChange(draft)}}/></label>}
function NotesField({value,onChange}){const [draft,setDraft]=useState(value||'');useEffect(()=>setDraft(value||''),[value]);return <label className="studio-field">상품 메모<textarea rows={3} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(draft!==value)onChange(draft)}} placeholder="실물 검수 사항, 프린트 위치, 봉제 디테일…"/></label>}
function Tabs({value,onChange}){return <div className="studio-tabs">{[['products','상품'],['generate','AI 생성'],['lookbook','룩북'],['details','상세'],['archive','아카이브']].map(([id,title])=><button type="button" key={id} className={value===id?'active':''} onClick={()=>onChange(id)}>{title}</button>)}</div>}
export default function StudioFlow({activeTab='products',onChangeTab}){
 const [projects,setProjects]=useState([]),[selected,setSelected]=useState(''),[mode,setMode]=useState('model'),[scene,setScene]=useState('white'),[extra,setExtra]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true);
 const tab=activeTab;
 const setTab=onChangeTab||(()=>{});
 const reload=useCallback(async()=>{const rows=await getAll();setProjects(rows.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')));setSelected(prev=>rows.some(p=>p.id===prev)?prev:rows[0]?.id||'')},[]);
 useEffect(()=>{reload().catch(e=>setError('로컬 저장소를 열 수 없어: '+e.message)).finally(()=>setLoading(false))},[reload]);
 const project=projects.find(p=>p.id===selected);
 const update=async newData=>{if(!project)return;const next={...project,...newData,updatedAt:stamp()};try{await write(next);setProjects(old=>old.map(p=>p.id===next.id?next:p).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')));setError('');return next}catch(e){setError('저장 실패: '+e.message)}};
 const add=async()=>{const next=blank();try{await write(next);setProjects(old=>[next,...old]);setSelected(next.id);setTab('products');setNotice('새 상품을 만들었어. 정보를 입력하면 기기에 자동 저장돼.')}catch(e){setError(e.message)}};
 const remove=async()=>{if(!project||!window.confirm('이 상품과 기기에 저장된 원본·생성 이미지를 모두 삭제할까? 되돌릴 수 없어.'))return;try{await erase(project.id);setSelected('');await reload();setNotice('상품을 삭제했어.')}catch(e){setError('삭제 실패: '+e.message)}};
 const assign=async(role,file)=>{if(!file)return;setBusy(true);try{const data=await fileImage(file);await update({images:{...project.images,[role]:data}});setNotice('사진을 이 기기에 저장했어. AI 생성 버튼을 누르기 전에는 서버로 보내지 않아.')}catch(e){setError(e.message)}finally{setBusy(false)}};
 const generate=async()=>{
  if(!project||busy)return;const entries=ROLES.filter(([id])=>project.images[id]);if(!entries.length){setError('상품 앞면 등 참고 사진을 먼저 올려줘.');return}
  if(!window.confirm('선택한 상품 사진을 OpenAI 이미지 생성 API로 전송할까? 생성 1회마다 API 비용이 발생해.'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw Error('로그인을 먼저 확인해 줘.');
   const form=new FormData();form.set('mode',mode);form.set('scene',scene);form.set('notes',extra.slice(0,600));
   form.set('product',JSON.stringify({name:project.name,category:project.category,season:project.season,fabric:project.fabric,color:project.color,size:project.size,fit:project.fit,measurements:project.measurements}));
   entries.slice(0,5).forEach(([key,label])=>form.append('image',dataFile(project.images[key],key+'.jpg')));form.set('roles',JSON.stringify(entries.slice(0,5).map(x=>x[1])));
   const response=await fetch('/api/studio-generate',{method:'POST',headers:{Authorization:'Bearer '+session.access_token},body:form});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(payload.error||'이미지 생성 실패 (HTTP '+response.status+')');
   if(typeof payload.image!=='string'||!payload.image.startsWith('data:image/'))throw Error('생성 결과가 비어 있어.');
   const row={id:uid(),data:payload.image,mode,scene,description:extra.trim(),createdAt:stamp(),ai:true,model:payload.model||'미확인',verified:false};
   const next={...project,outputs:[row,...project.outputs],updatedAt:stamp()};
   await write(next);setProjects(old=>old.map(p=>p.id===next.id?next:p).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')));setTab('archive');setNotice('AI 생성 이미지가 이 기기에 저장됐어. 원본과 다르게 만들어진 디테일은 꼭 검수해 줘.');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const outputs=project?.outputs||[];
 const activeOutputs=tab==='lookbook'?outputs.filter(x=>['lookbook','lifestyle'].includes(x.mode)):outputs;
 return <section className="studio-flow">
  <header className="studio-hero"><div><span className="studio-eyebrow">FASHION FLOW / VISUAL PRODUCTION</span><h1>STUDIO FLOW</h1><p>실물 상품 사진을 AI 모델컷·룩북·상세페이지용 비주얼로 발전시키는 작업실</p></div><button type="button" className="studio-add" onClick={add}><Plus size={18}/> 새 상품</button></header>
  <Tabs value={tab} onChange={setTab}/>
  {(error||notice)&&<div className={'studio-message '+(error?'studio-error':'')} role="status">{error||notice}<button aria-label="메시지 닫기" type="button" onClick={()=>{setError('');setNotice('')}}>×</button></div>}
  {loading&&<p>상품 데이터 확인 중…</p>}
  {!loading&&<div className="studio-layout">
   <aside className="studio-products"><h3>내 상품 <small>{projects.length}</small></h3>{projects.map(p=><button type="button" key={p.id} className={'studio-product '+(p.id===selected?'active':'')} onClick={()=>setSelected(p.id)}>{p.images?.front?<img src={p.images.front} alt=""/>:<span className="studio-empty-image"><Shirt size={21}/></span>}<span><b>{p.name||'이름 없는 상품'}</b><small>{p.category||'미분류'} · 생성 {p.outputs?.length||0}컷</small></span></button>)}{!projects.length&&<p className="studio-muted">새 상품을 등록해 봐.</p>}</aside>
   <div className="studio-work">
    {!project?<div className="studio-panel studio-empty"><Layers size={32}/><h2>첫 상품부터 시작해 봐</h2><p>블라우스 앞·뒤·옆·원단 사진을 등록한 뒤 AI 이미지로 확장할 수 있어.</p><button type="button" className="studio-primary" onClick={add}>상품 등록하기</button></div>:<>
     {tab==='products'&&<div className="studio-panel"><div className="studio-title-row"><h2>상품 원본 등록</h2><button type="button" className="studio-danger" onClick={remove}><Trash2 size={16}/> 삭제</button></div>
      <div className="studio-fields"><ProductField title="상품명" value={project.name} onChange={v=>update({name:v})} placeholder="예: 실크 프린트 우븐 블라우스"/><ProductField title="시즌" value={project.season} onChange={v=>update({season:v})} placeholder="27SS"/><ProductField title="카테고리" value={project.category} onChange={v=>update({category:v})}/><ProductField title="원단·혼용률" value={project.fabric} onChange={v=>update({fabric:v})} placeholder="확인한 혼용률만 입력"/><ProductField title="컬러" value={project.color} onChange={v=>update({color:v})}/><ProductField title="사이즈" value={project.size} onChange={v=>update({size:v})} placeholder="예: S/M/L"/><ProductField title="핏" value={project.fit} onChange={v=>update({fit:v})} placeholder="예: 여유 있는 레귤러핏"/><ProductField title="실측치" value={project.measurements} onChange={v=>update({measurements:v})} placeholder="어깨/가슴/총장 등"/></div>
      <NotesField key={project.id} value={project.notes||''} onChange={v=>update({notes:v})}/>
      <h3>상품 사진 · 앞·뒤·옆·원단·디테일</h3><div className="studio-photo-grid">{ROLES.map(([id,label])=><div className="studio-photo-slot" key={id}><div className="studio-photo-preview">{project.images[id]?<img src={project.images[id]} alt={label}/>:<ImagePlus size={26}/>}</div><b>{label}</b><label className="studio-small-upload">사진 {project.images[id]?'변경':'추가'}<input type="file" accept="image/*" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';assign(id,file)}}/></label>{project.images[id]&&<button type="button" className="studio-quiet" onClick={()=>{if(window.confirm(label+' 사진을 삭제할까?')){const next={...project.images};delete next[id];update({images:next})}}}>삭제</button>}</div>)}</div>
      <div className="studio-inline"><button type="button" className="studio-primary" onClick={()=>setTab('generate')}><Sparkles size={17}/> AI 이미지 생성으로</button><button type="button" onClick={()=>saveManifest(project)}>상품 기록 내보내기</button></div>
     </div>}
     {tab==='generate'&&<div className="studio-panel"><h2>AI 비주얼 생성</h2><p className="studio-muted">앞면·뒷면 등 확인된 실물 사진을 참고해 모델컷 또는 배경컷 1장을 생성해. 결과는 실제 제품 사진이 아닌 AI 시안이야.</p>
      <h3>생성 종류</h3><div className="studio-choices">{MODES.map(([id,label])=><button type="button" key={id} className={mode===id?'active':''} onClick={()=>setMode(id)}>{label}</button>)}</div>
      <h3>촬영 배경</h3><div className="studio-choices">{SCENES.map(([id,label])=><button type="button" key={id} className={scene===id?'active':''} onClick={()=>setScene(id)}>{label}</button>)}</div>
      <label className="studio-field">연출 추가 지시 (선택)<textarea rows={3} value={extra} onChange={e=>setExtra(e.target.value)} placeholder="예: 블라우스는 바지 밖으로, 옷 전체가 보이는 정면컷"/></label>
      <p className="studio-note">선택한 사진: {ROLES.filter(([id])=>project.images[id]).map(([,label])=>label).join(', ')||'없음'} · 최대 5장 활용</p>
      <button type="button" className="studio-primary" disabled={busy||!Object.keys(project.images).length} onClick={generate}><Sparkles size={18}/>{busy?'AI 이미지 생성 중…':'AI 이미지 1장 생성 (유료 API)'}</button>
      <p className="studio-note">생성은 매번 비용이 발생해. 자동 재시도·자동 대량 생성 없음. 소재·색상·프린트·봉제·핏이 실제와 다른 부분은 미확인으로 보고 검수해.</p>
     </div>}
     {tab==='lookbook'&&<div className="studio-panel"><h2>룩북</h2><p className="studio-muted">라이프스타일·브랜드 룩북 결과만 모아봐. 새로운 룩북컷은 AI 생성 탭에서 만들어.</p><button type="button" className="studio-primary" onClick={()=>{setMode('lookbook');setTab('generate')}}><Plus size={16}/> 룩북컷 만들기</button><OutputGrid rows={activeOutputs} /></div>}
     {tab==='details'&&<div className="studio-panel"><h2>상세페이지 제작 자료</h2><p className="studio-muted">실물 원본 사진과 생성한 시안을 구분해 확인하고 다운로드할 수 있어. 상세페이지 조립·실측 검증은 후속 작업이야.</p><div className="studio-detail-info"><b>{project.name||'상품명 미입력'}</b><span>원단: {project.fabric||'미확인'}</span><span>실측: {project.measurements||'미확인'}</span><span>핏: {project.fit||'미확인'}</span></div><h3>실물 사진</h3><div className="studio-output-grid">{ROLES.filter(([id])=>project.images[id]).map(([id,label])=><div className="studio-output" key={id}><img src={project.images[id]} alt={label}/><b>실물 {label}</b><button type="button" onClick={()=>download(project.images[id],(project.name||'상품')+'-'+id+'.jpg')}><Download size={15}/> 다운로드</button></div>)}</div><h3>AI 시안</h3><OutputGrid rows={outputs}/></div>}
     {tab==='archive'&&<div className="studio-panel"><h2>아카이브 · 생성 {outputs.length}장</h2><p className="studio-muted">AI 생성 결과는 기기에만 저장돼. 원본을 대체하지 않으며 이미지 사용 전 실제 제품과 비교해 줘.</p><OutputGrid rows={outputs} onDelete={async id=>{if(!window.confirm('생성 이미지 1장을 삭제할까?'))return;await update({outputs:outputs.filter(x=>x.id!==id)})}}/><button type="button" onClick={()=>saveManifest(project)}>생성 기록 내보내기 (이미지 제외)</button></div>}
    </>}
   </div>
  </div>}
  <footer className="studio-footer"><AlertTriangle size={16}/> 사진과 AI 생성 결과는 현재 이 브라우저의 IndexedDB에만 저장돼. 사이트 데이터 삭제·기기 변경 시 사라질 수 있으니 중요한 이미지는 꼭 다운로드해 백업해 줘. Supabase 사진 동기화는 하지 않아.</footer>
 </section>;
}
function OutputGrid({rows,onDelete}){
 if(!rows.length)return <p className="studio-muted">아직 생성한 이미지가 없어.</p>;
 return <div className="studio-output-grid">{rows.map(x=><div className="studio-output" key={x.id}><img src={x.data} alt="AI 생성 이미지"/><b>{MODES.find(([k])=>k===x.mode)?.[1]||'AI 이미지'}</b><small>AI 생성 · {x.createdAt?.slice(0,10)||''} · 실물 검수 필요</small><div className="studio-inline"><button type="button" onClick={()=>download(x.data,'studio-'+x.id+'.jpg')}><Download size={14}/> 저장</button>{onDelete&&<button type="button" onClick={()=>onDelete(x.id)} className="studio-danger"><Trash2 size={14}/> 삭제</button>}</div></div>)}</div>;
}
