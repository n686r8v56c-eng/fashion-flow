import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Camera,Images,FolderClosed,House,Bookmark,Plus,Trash2,Download,Share2,RefreshCcw,Timer,Grid3X3,FlipHorizontal,ImagePlus,Check,ScanEye,ArrowLeft,ArrowRight,Upload,FileDown,Save,Eye,Layers,X} from 'lucide-react';
import {supabase} from './supabase';
import './ShootStandalone.css';

const DB='shoot-flow-local-v1',STORE='projects',uid=()=>crypto.randomUUID(),now=()=>new Date().toISOString();
const NAV=[['home',House,'홈'],['reference',Bookmark,'레퍼런스'],['camera',Camera,'촬영'],['results',Images,'결과'],['projects',FolderClosed,'프로젝트']];
const fresh=()=>({id:uid(),name:'새 촬영 프로젝트',purpose:'Lifestyle',date:'',location:'',reference:'',observations:[],analysis:null,shots:[],photos:[],bestPhotoId:'',updatedAt:now()});
function openDB(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function useDB(mode,action){const db=await openDB();try{return await new Promise((ok,no)=>{const tx=db.transaction(STORE,mode),q=action(tx.objectStore(STORE));let result;q.onsuccess=()=>{result=q.result};q.onerror=()=>no(q.error);tx.oncomplete=()=>ok(result);tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error||Error('저장 취소'))})}finally{db.close()}}
const readAll=()=>useDB('readonly',s=>s.getAll()),write=p=>useDB('readwrite',s=>s.put(p)),remove=id=>useDB('readwrite',s=>s.delete(id));
async function shrink(file,max=1250,quality=.78){
 if(!file?.type?.startsWith('image/'))throw Error('이미지 파일을 골라줘.');
 if(file.size>20*1024*1024)throw Error('20MB 이하 이미지를 선택해 줘.');
 const url=URL.createObjectURL(file);
 try{const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(Error('사진을 읽지 못했어.'));img.src=url});const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*s));c.height=Math.max(1,Math.round(img.naturalHeight*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',quality);c.width=c.height=0;return data}finally{URL.revokeObjectURL(url)}
}
function fileFromData(data){const [mime,b64]=data.split(','),raw=atob(b64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new File([bytes],'shoot-'+Date.now()+'.jpg',{type:(mime.match(/^data:([^;]+);base64/)||[])[1]||'image/jpeg'})}
function download(data,name){const a=document.createElement('a');a.href=data;a.download=name;document.body.appendChild(a);a.click();a.remove()}
function downloadJson(p){const blob=new Blob([JSON.stringify({format:'shoot-flow-v1',exportedAt:now(),project:p})],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='shoot-flow-'+p.id+'.json';a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function Field({label,value,onSave,type='text',placeholder=''}){const [draft,setDraft]=useState(value||'');useEffect(()=>setDraft(value||''),[value]);return <label className="shoot-field">{label}<input type={type} value={draft} placeholder={placeholder} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(draft!==(value||''))onSave(draft)}}/></label>}

function LiveCamera({reference,onPhotos,onError,onNotice}){
 const video=useRef(null),stream=useRef(null),timers=useRef([]),cancelled=useRef(false);
 const [running,setRunning]=useState(false),[facing,setFacing]=useState('environment'),[pending,setPending]=useState(false);
 const [opacity,setOpacity]=useState(40),[zoom,setZoom]=useState(100),[shiftX,setShiftX]=useState(0),[shiftY,setShiftY]=useState(0),[grid,setGrid]=useState(false),[showReference,setShowReference]=useState(true);
 const [delay,setDelay]=useState(3),[burst,setBurst]=useState(1),[interval,setIntervalMs]=useState(1800),[countdown,setCountdown]=useState(null),[progress,setProgress]=useState(0),[preview,setPreview]=useState([]);
 const [sharing,setSharing]=useState(false);
 const stop=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current){video.current.pause();video.current.srcObject=null}setRunning(false)};
 const clear=()=>{cancelled.current=true;timers.current.forEach(t=>{clearTimeout(t.id);t.resolve()});timers.current=[];setPending(false);setCountdown(null);setProgress(0)};
 useEffect(()=>()=>{cancelled.current=true;timers.current.forEach(t=>{clearTimeout(t.id);t.resolve()});stream.current?.getTracks().forEach(t=>t.stop())},[]);
 const pause=ms=>new Promise(ok=>{const t={id:null,resolve:ok};t.id=setTimeout(()=>{timers.current=timers.current.filter(x=>x!==t);ok()},ms);timers.current.push(t)});
 const start=async(next=facing)=>{
  if(pending)return;stop();onError('');
  try{if(!navigator.mediaDevices?.getUserMedia)throw Error('HTTPS 환경의 카메라 지원 브라우저에서 열어줘.');
   const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:next},width:{ideal:1920},height:{ideal:1080}},audio:false});
   stream.current=s;if(video.current){video.current.srcObject=s;await video.current.play()}setRunning(true);setFacing(next);
  }catch(e){stop();onError(e.name==='NotAllowedError'?'브라우저에서 카메라 권한을 허용해 줘.':'카메라 시작 실패: '+e.message)}
 };
 const snapFrame=()=>{
  const v=video.current,frame=v?.parentElement;
  if(!v?.videoWidth||!v.videoHeight||!frame?.clientHeight)throw Error('카메라가 아직 준비되지 않았어.');
  const vr=frame.clientWidth/frame.clientHeight,sr=v.videoWidth/v.videoHeight;
  const sw=sr>vr?v.videoHeight*vr:v.videoWidth,sh=sr>vr?v.videoHeight:v.videoWidth/vr,sx=(v.videoWidth-sw)/2,sy=(v.videoHeight-sh)/2;
  const ratio=Math.min(1,1350/Math.max(sw,sh)),c=document.createElement('canvas');c.width=Math.round(sw*ratio);c.height=Math.round(sh*ratio);
  const ctx=c.getContext('2d');if(!ctx)throw Error('사진 촬영을 지원하지 않는 브라우저야.');
  if(facing==='user'){ctx.translate(c.width,0);ctx.scale(-1,1)}
  ctx.drawImage(v,sx,sy,sw,sh,0,0,c.width,c.height);
  const data=c.toDataURL('image/jpeg',.8);c.width=c.height=0;return data;
 };
 const take=async()=>{
  if(!running||pending)return;onError('');cancelled.current=false;setPending(true);const photos=[];
  try{
   for(let seconds=delay;seconds>0;seconds--){if(cancelled.current)return;setCountdown(seconds);await pause(1000)}
   setCountdown(null);
   for(let i=0;i<burst;i++){if(cancelled.current)return;const data=snapFrame();photos.push({id:uid(),data,createdAt:now(),shotId:''});setProgress(i+1);if(i<burst-1)await pause(interval)}
   if(!cancelled.current){await onPhotos(photos);setPreview(photos);onNotice(photos.length+'장 촬영했어! 사진은 프로젝트에 임시 저장됐으니 중요한 사진은 다운로드해 줘.')}
  }catch(e){onError('촬영 오류: '+e.message)}
  finally{setPending(false);setCountdown(null);setProgress(0);timers.current=[]}
 };
 const closeReview=()=>{setPreview([]);onError('');onNotice('')};
 const share=()=>{
  if(!preview.length)return;
  try{
   const files=preview.map(x=>fileFromData(x.data));
   if(!navigator.share||!navigator.canShare?.({files}))throw Error('이 브라우저에서는 여러 사진 공유를 지원하지 않아. 개별 다운로드를 이용해 줘.');
   setSharing(true);navigator.share({files,title:'SHOOT FLOW'}).catch(e=>{if(e.name!=='AbortError')onError(e.message)}).finally(()=>setSharing(false));
  }catch(e){onError(e.message)}
 };
 useEffect(()=>{if(!preview.length)return;const prev=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=prev}},[preview.length]);
 return <section className="shoot-camera-panel">
  <div className="shoot-camera-head"><h2>촬영 워크벤치</h2><span>{reference?'레퍼런스 오버레이 준비':'레퍼런스를 먼저 등록하면 겹쳐 볼 수 있어'}</span></div>
  <div className="shoot-camera-view">
   <video ref={video} autoPlay muted playsInline style={{visibility:running?'visible':'hidden',transform:facing==='user'?'scaleX(-1)':'none'}}/>
   {!running&&<div className="shoot-camera-empty"><Camera size={36}/><p>카메라를 시작해 줘.</p></div>}
   {reference&&showReference&&<img className="shoot-camera-guide" src={reference} alt="영감 사진 오버레이" style={{opacity:opacity/100,transform:`translate(${shiftX}%,${shiftY}%) scale(${zoom/100})`}}/>}
   {grid&&<div className="shoot-camera-grid" aria-hidden="true"/>}
   {pending&&<div className="shoot-camera-count">{countdown!==null?countdown:progress?progress+' / '+burst:'촬영 준비'}</div>}
  </div>
  <div className="shoot-camera-actions">
   {!running?<button onClick={()=>start()}><Camera size={17}/> 카메라 시작</button>:<><button onClick={()=>start(facing==='environment'?'user':'environment')} disabled={pending}><FlipHorizontal size={16}/> 전후면</button><button onClick={stop} disabled={pending}>카메라 끄기</button><button className="shoot-accent" disabled={pending} onClick={take}><Camera size={18}/> {pending?'촬영 중':'촬영'}</button></>}
   {pending&&<button onClick={clear}>촬영 취소</button>}
  </div>
  <div className="shoot-camera-settings">
   <label>타이머<select value={delay} onChange={e=>setDelay(Number(e.target.value))}>{[0,3,5,10].map(x=><option key={x} value={x}>{x?x+'초':'즉시'}</option>)}</select></label>
   <label>연속 촬영<select value={burst} onChange={e=>setBurst(Number(e.target.value))}>{[1,3,5,10].map(x=><option key={x} value={x}>{x}장</option>)}</select></label>
   <label>촬영 간격<select value={interval} onChange={e=>setIntervalMs(Number(e.target.value))}>{[1000,1800,3000,5000].map(x=><option key={x} value={x}>{(x/1000).toFixed(1)}초</option>)}</select></label>
  </div>
  {reference&&<div className="shoot-sliders">
   <label>오버레이 투명도 {opacity}%<input type="range" min="0" max="100" step="5" value={opacity} onChange={e=>setOpacity(+e.target.value)}/></label>
   <label>사진 크기 {zoom}%<input type="range" min="70" max="150" step="5" value={zoom} onChange={e=>setZoom(+e.target.value)}/></label>
   <label>좌우 위치 {shiftX}%<input type="range" min="-40" max="40" step="2" value={shiftX} onChange={e=>setShiftX(+e.target.value)}/></label>
   <label>상하 위치 {shiftY}%<input type="range" min="-40" max="40" step="2" value={shiftY} onChange={e=>setShiftY(+e.target.value)}/></label>
  </div>}
  <div className="shoot-camera-actions"><button onClick={()=>setGrid(v=>!v)}><Grid3X3 size={16}/> {grid?'격자 끄기':'3×3 격자'}</button>{reference&&<button onClick={()=>setShowReference(v=>!v)}><Eye size={16}/> {showReference?'오버레이 숨기기':'오버레이 표시'}</button>}</div>
  <p className="shoot-small">가이드 사진과 격자는 촬영 결과에 포함되지 않아. 사진은 서버에 업로드하지 않고 현재 기기에 저장돼. 카메라·타이머는 AI 사용 요금이 없어.</p>
  {preview.length>0&&createPortal(<div className="shoot-review" role="dialog" aria-modal="true" aria-label="촬영 결과">
   <header><strong>촬영 결과 · {preview.length}장</strong><button onClick={closeReview} aria-label="닫기"><X/></button></header>
   <div className="shoot-review-gallery">{preview.map((p,i)=><div key={p.id}><img src={p.data} alt={'촬영 '+(i+1)}/><span>{i+1}/{preview.length}</span></div>)}</div>
   <footer><p>원본 사진은 별도로 내려받아 보관해 줘.</p><div><button onClick={closeReview}><RefreshCcw size={17}/> 다시 찍기</button><button className="shoot-accent" disabled={sharing} onClick={share}><Share2 size={17}/> 저장·공유</button></div><button onClick={()=>preview.forEach((p,i)=>download(p.data,'shoot-'+p.id+'.jpg'))}><Download size={16}/> {preview.length}장 다운로드</button></footer>
  </div>,document.body)}
 </section>;
}

export default function ShootStandalone(){
 const [rows,setRows]=useState([]),[selected,setSelected]=useState(''),[tab,setTab]=useState('home'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[aiBusy,setAiBusy]=useState(false),[compare,setCompare]=useState('slider'),[fraction,setFraction]=useState(50),[chosen,setChosen]=useState('');
 const refresh=useCallback(async()=>{const data=await readAll();data.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));setRows(data);setSelected(prev=>data.some(x=>x.id===prev)?prev:data[0]?.id||'')},[]);
 useEffect(()=>{refresh().catch(e=>setError('기기 저장소를 읽지 못했어: '+e.message)).finally(()=>setLoading(false))},[refresh]);
 const project=rows.find(x=>x.id===selected)||null;
 const patch=async fields=>{if(!project)return false;try{const next={...project,...fields,updatedAt:now()};await write(next);setRows(prev=>prev.map(x=>x.id===next.id?next:x).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));return true}catch(e){setError('저장 실패: '+e.message);return false}};
 const add=async()=>{const p=fresh();try{await write(p);setRows(prev=>[p,...prev]);setSelected(p.id);setTab('projects');setNotice('새 촬영 프로젝트를 만들었어.')}catch(e){setError('프로젝트 생성 실패: '+e.message)}};
 const del=async()=>{if(!project||!window.confirm('프로젝트와 여기에 저장된 촬영 사진을 모두 삭제할까? 되돌릴 수 없어.'))return;try{await remove(project.id);await refresh();setNotice('프로젝트를 삭제했어.')}catch(e){setError('삭제 실패: '+e.message)}};
 const reference=async file=>{if(!file)return;try{const data=await shrink(file);await patch({reference:data});setNotice('영감 사진을 기기에 저장했어.')}catch(e){setError(e.message)}};
 const photosAdded=async photos=>{if(!project)throw Error('프로젝트가 필요해.');const success=await patch({photos:[...photos,...project.photos].slice(0,150)});if(!success)throw Error('촬영 결과 저장 실패. 사진을 바로 내려받아 줘.')};
 const ai=async()=>{if(!project?.reference||aiBusy)return;setAiBusy(true);setError('');
  try{const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw Error('AI 분석은 Fashion Flow 로그인이 필요해.');
   const res=await fetch('/api/analyze-shoot',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({image:project.reference})});
   const data=await res.json().catch(()=>({}));if(!res.ok||!data.result)throw Error(data.error||'AI 분석에 실패했어.');
   const result=data.result,shots=(result.shots||[]).slice(0,6).map((s,i)=>({id:uid(),title:s.title||'컷 '+(i+1),description:s.description||'',framing:s.framing||'',pose:s.pose||'',light:s.light||'',props:s.props||'',done:false}));
   await patch({analysis:result,shots:[...project.shots,...shots]});setNotice(shots.length+'개 컷 리스트를 추가했어.');setTab('projects');
  }catch(e){setError(e.message)}finally{setAiBusy(false)}
 };
 const updateShot=(id,fields)=>patch({shots:project.shots.map(x=>x.id===id?{...x,...fields}:x)});
 const selectedPhoto=project?.photos?.find(x=>x.id===chosen)||project?.photos?.[0];
 const importProject=async file=>{if(!file)return;try{if(file.size>30*1024*1024)throw Error('30MB 이하 백업 파일을 선택해 줘.');const raw=JSON.parse(await file.text());if(raw.format!=='shoot-flow-v1'||!raw.project||!Array.isArray(raw.project.photos)||!Array.isArray(raw.project.shots))throw Error('SHOOT FLOW 백업 파일 형식이 아니야.');if(raw.project.photos.length>150)throw Error('사진 수가 너무 많아.');const p={...raw.project,id:uid(),name:(String(raw.project.name||'가져온 프로젝트')).slice(0,150)+' (복원)',updatedAt:now()};await write(p);await refresh();setSelected(p.id);setNotice('프로젝트를 별도 복사본으로 복원했어. 기존 데이터는 유지했어.');setTab('projects')}catch(e){setError('가져오기 실패: '+e.message)}};
 return <div className="shoot-app">
  <header className="shoot-top"><div><small>INDEPENDENT PHOTO WORKBENCH</small><h1>SHOOT FLOW</h1></div><button onClick={add}><Plus size={17}/> 새 프로젝트</button></header>
  {project&&<div className="shoot-project-picker"><label>작업 프로젝트 <select value={project.id} onChange={e=>{setSelected(e.target.value);setChosen('')}}>{rows.map(x=><option key={x.id} value={x.id}>{x.name||'이름 없음'}</option>)}</select></label><span>{project.photos.length}장 촬영 · {project.shots.filter(x=>x.done).length}/{project.shots.length}컷 완료</span></div>}
  {(notice||error)&&<div className={'shoot-notice '+(error?'error':'')} role="status">{error||notice}<button onClick={()=>{setError('');setNotice('')}} aria-label="알림 닫기">×</button></div>}
  <main>
   {loading?<p>기기 프로젝트 확인 중…</p>:!project?<section className="shoot-panel shoot-empty"><Camera size={34}/><h2>나만의 촬영 프로젝트</h2><p>영감 사진을 등록하고 타이머·오버레이로 촬영해 봐.</p><button className="shoot-accent" onClick={add}>첫 프로젝트 만들기</button></section>:<>
    {tab==='home'&&<section className="shoot-panel"><h2>{project.name}</h2><p>영감 사진 → AI 촬영 계획 → 오버레이 촬영 → 결과 비교</p><div className="shoot-home-actions"><button onClick={()=>setTab('camera')}><Camera/> 바로 촬영</button><button onClick={()=>setTab('reference')}><Bookmark/> 영감 사진</button><button onClick={()=>setTab('results')}><Images/> 결과 비교</button></div><h3>진행 상태</h3><p>레퍼런스 {project.reference?'등록 완료':'미등록'} · 촬영 {project.photos.length}장 · 컷 {project.shots.filter(x=>x.done).length}/{project.shots.length} 완료</p><div className="shoot-reference-preview">{project.reference&&<img src={project.reference} alt="영감 사진"/>}{project.photos[0]&&<img src={project.photos[0].data} alt="최근 촬영 사진"/>}</div></section>}
    {tab==='reference'&&<section className="shoot-panel"><h2>레퍼런스 · AI 분석</h2><p>영감 사진을 저장하고 구도·포즈·빛을 분석해 촬영 컷 리스트를 만들 수 있어.</p><label className="shoot-file"><ImagePlus size={18}/> 영감 사진 {project.reference?'변경':'추가'}<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];e.target.value='';reference(file)}}/></label>{project.reference&&<img className="shoot-reference-big" src={project.reference} alt="선택한 영감 사진"/>}<button className="shoot-accent" disabled={!project.reference||aiBusy} onClick={ai}><ScanEye size={17}/>{aiBusy?'AI 분석 중…':'구도·포즈·빛 AI 분석 (유료 API)'}</button>{project.analysis&&<div className="shoot-analysis"><h3>사진에서 관찰된 사실</h3><ul>{(project.analysis.observations||[]).map((v,i)=><li key={i}>{v}</li>)}</ul>{[['구도',project.analysis.composition],['포즈',project.analysis.pose],['빛',project.analysis.light]].map(([title,part])=><div key={title}><b>{title}</b><p>관찰: {part?.observed||'미확인'}</p><p>촬영 제안: {part?.tips||'없음'}</p></div>)}<h3>미확인</h3><ul>{(project.analysis.uncertainties||[]).map((v,i)=><li key={i}>{v}</li>)}</ul></div>}<p className="shoot-small">AI 분석 버튼을 눌렀을 때만 서버로 사진이 전송돼. 카메라 촬영 자체는 AI 비용이 없어.</p></section>}
    {tab==='camera'&&<LiveCamera key={project.id} reference={project.reference} onPhotos={photosAdded} onError={setError} onNotice={setNotice}/>}
    {tab==='results'&&<section className="shoot-panel"><h2>촬영 결과 · {project.photos.length}장</h2>{!project.photos.length?<p>촬영한 사진이 없어. 카메라 탭에서 사진을 찍어 봐.</p>:<><div className="shoot-thumbs">{project.photos.map(p=><button key={p.id} className={selectedPhoto?.id===p.id?'active':''} onClick={()=>setChosen(p.id)}><img src={p.data} alt="촬영 결과 썸네일"/>{project.bestPhotoId===p.id&&<span>★</span>}</button>)}</div><div className="shoot-compare-actions"><button className={compare==='side'?'active':''} onClick={()=>setCompare('side')}>좌우 비교</button><button className={compare==='slider'?'active':''} onClick={()=>setCompare('slider')}>겹쳐 비교</button></div>{project.reference?<div className={'shoot-compare '+(compare==='side'?'side':'slider')}><div className="shoot-compare-before"><img src={project.reference} alt="영감 사진"/><span>REFERENCE</span></div><div className="shoot-compare-after" style={compare==='slider'?{clipPath:`inset(0 ${100-fraction}% 0 0)`}:{}}><img src={selectedPhoto.data} alt="촬영 결과"/><span>SHOT</span></div>{compare==='slider'&&<div className="shoot-compare-line" style={{left:fraction+'%'}}/>}</div>:<img className="shoot-result-photo" src={selectedPhoto.data} alt="선택한 사진"/>}{compare==='slider'&&project.reference&&<label className="shoot-field">비교 슬라이더 {fraction}%<input type="range" min="0" max="100" value={fraction} onChange={e=>setFraction(+e.target.value)}/></label>}<label className="shoot-field">연결할 촬영 컷<select value={selectedPhoto.shotId||''} onChange={e=>patch({photos:project.photos.map(p=>p.id===selectedPhoto.id?{...p,shotId:e.target.value}:p)})}><option value="">컷 지정 안 함</option>{project.shots.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></label><div className="shoot-result-buttons"><button onClick={()=>patch({bestPhotoId:selectedPhoto.id})}><Check size={16}/> {project.bestPhotoId===selectedPhoto.id?'베스트 컷 지정됨':'베스트 컷 지정'}</button><button onClick={()=>download(selectedPhoto.data,'shoot-'+selectedPhoto.id+'.jpg')}><Download size={16}/> 사진 다운로드</button><button onClick={()=>{if(window.confirm('이 사진을 프로젝트에서 삭제할까? 백업은 확인했어?'))patch({photos:project.photos.filter(x=>x.id!==selectedPhoto.id),bestPhotoId:project.bestPhotoId===selectedPhoto.id?'':project.bestPhotoId})}}><Trash2 size={16}/> 삭제</button></div></>}</section>}
    {tab==='projects'&&<section className="shoot-panel"><div className="shoot-between"><h2>프로젝트 · 컷 리스트</h2><button onClick={del} className="shoot-danger"><Trash2 size={16}/> 삭제</button></div><div className="shoot-fields"><Field key={project.id+'name'} label="프로젝트명" value={project.name} onSave={v=>patch({name:v})}/><label className="shoot-field">촬영 목적<select value={project.purpose} onChange={e=>patch({purpose:e.target.value})}>{['Lifestyle','Fashion','Commerce'].map(v=><option key={v}>{v}</option>)}</select></label><Field key={project.id+'date'} type="date" label="촬영 날짜" value={project.date} onSave={v=>patch({date:v})}/><Field key={project.id+'location'} label="장소" value={project.location} onSave={v=>patch({location:v})}/></div><div className="shoot-between"><h3>촬영 컷 · {project.shots.length}</h3><button onClick={()=>patch({shots:[...project.shots,{id:uid(),title:'새 컷',description:'',done:false,framing:'',pose:'',light:'',props:''}]})}><Plus size={16}/> 컷 추가</button></div>{project.shots.map((shot,i)=><div className="shoot-shot" key={shot.id}><label><input type="checkbox" checked={Boolean(shot.done)} onChange={e=>updateShot(shot.id,{done:e.target.checked})}/><strong>{i+1}. {shot.title}</strong></label><p>{shot.description||'촬영 메모 없음'}</p><small>연결된 촬영 사진: {project.photos.filter(p=>p.shotId===shot.id).length}장</small><small>구도 {shot.framing||'미정'} · 포즈 {shot.pose||'미정'} · 조명 {shot.light||'미정'} · 소품 {shot.props||'미정'}</small><div className="shoot-shot-actions"><button disabled={i===0} onClick={()=>{const a=[...project.shots];[a[i-1],a[i]]=[a[i],a[i-1]];patch({shots:a})}}>↑</button><button disabled={i===project.shots.length-1} onClick={()=>{const a=[...project.shots];[a[i+1],a[i]]=[a[i],a[i+1]];patch({shots:a})}}>↓</button><button onClick={()=>{const title=window.prompt('컷 이름',shot.title);if(title!==null)updateShot(shot.id,{title:title.trim()||shot.title})}}>수정</button><button onClick={()=>{const desc=window.prompt('촬영 메모',shot.description||'');if(desc!==null)updateShot(shot.id,{description:desc})}}>메모</button><button onClick={()=>{if(window.confirm('이 컷을 삭제할까?'))patch({shots:project.shots.filter(x=>x.id!==shot.id)})}}>삭제</button></div></div>)}{!project.shots.length&&<p>레퍼런스 탭에서 AI 컷을 생성하거나 직접 컷을 추가해 줘.</p>}<div className="shoot-export"><button onClick={()=>downloadJson(project)}><FileDown size={17}/> 프로젝트 전체 백업(JSON·사진 포함)</button><label className="shoot-file"><Upload size={17}/> 프로젝트 백업 가져오기<input type="file" accept=".json,application/json" onChange={e=>{const file=e.target.files?.[0];e.target.value='';importProject(file)}}/></label></div><p className="shoot-small">이 데이터는 이 브라우저의 IndexedDB에만 있어. 브라우저 데이터 삭제·기기 변경에 대비해 JSON 백업과 사진 다운로드를 해 줘.</p></section>}
   </>}
  </main>
  <nav className="shoot-bottom" aria-label="SHOOT FLOW 하단 탭">{NAV.map(([id,Icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>
 </div>;
}
