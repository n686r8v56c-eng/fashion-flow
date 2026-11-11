import React,{useEffect,useRef,useState} from 'react';
import {ImagePlus,ScanSearch,Download,ExternalLink,Bookmark,Trash2,RotateCcw,Check} from 'lucide-react';
import './FashionFinder.css';

const DB='fashion-finder-local-v1';
const STORE='searches';
function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,1);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function transact(mode,callback){
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    const request=callback(tx.objectStore(STORE));
    tx.oncomplete=()=>resolve(request?.result);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  })}finally{db.close()}
}
const readAll=()=>transact('readonly',s=>s.getAll());
const put=row=>transact('readwrite',s=>s.put(row));
const remove=id=>transact('readwrite',s=>s.delete(id));
const bounds=(n)=>Math.max(0,Math.min(1,n));
function cropBlob(img,box){
  const width=img.naturalWidth,height=img.naturalHeight;
  const sx=Math.round(box.x*width),sy=Math.round(box.y*height);
  const sw=Math.max(1,Math.round(box.w*width)),sh=Math.max(1,Math.round(box.h*height));
  const scale=Math.min(1,1600/Math.max(sw,sh));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));
  canvas.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('이미지 저장에 실패했어.')),'image/jpeg',.86));
}
export default function FashionFinder(){
  const [original,setOriginal]=useState('');
  const [fileName,setFileName]=useState('');
  const [selection,setSelection]=useState({x:0,y:0,w:1,h:1});
  const [records,setRecords]=useState([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [title,setTitle]=useState('');
  const image=useRef(null),drag=useRef(null),input=useRef(null);
  const [selectedImage,setSelectedImage]=useState(null);
  const refresh=async()=>{try{const all=await readAll();setRecords((all||[]).sort((a,b)=>b.createdAt-a.createdAt))}catch(e){setError('검색 기록을 불러오지 못했어: '+e.message)}};
  useEffect(()=>{refresh()},[]);
  useEffect(()=>()=>{if(original)URL.revokeObjectURL(original)},[original]);
  useEffect(()=>()=>{if(selectedImage)URL.revokeObjectURL(selectedImage)},[selectedImage]);
  function choose(e){
    const file=e.target.files?.[0];if(!file)return;
    if(!file.type.startsWith('image/')){setError('이미지 파일만 선택해줘.');return}
    if(file.size>25*1024*1024){setError('25MB 이하 이미지를 선택해줘.');return}
    setError('');setFileName(file.name);setTitle(file.name.replace(/\.[^.]+$/,''));
    setSelection({x:0,y:0,w:1,h:1});setOriginal(URL.createObjectURL(file));
    e.target.value='';
  }
  function position(e){
    const rect=image.current.getBoundingClientRect();
    return {x:bounds((e.clientX-rect.left)/rect.width),y:bounds((e.clientY-rect.top)/rect.height)};
  }
  function down(e){
    if(!image.current||!original)return;
    const p=position(e);drag.current=p;setSelection({x:p.x,y:p.y,w:0,h:0});
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e){
    if(!drag.current)return;const p=position(e),s=drag.current;
    setSelection({x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),w:Math.abs(p.x-s.x),h:Math.abs(p.y-s.y)});
  }
  function up(){
    if(!drag.current)return;drag.current=null;
    setSelection(p=>p.w<.015||p.h<.015?{x:0,y:0,w:1,h:1}:p);
  }
  async function prepare(saveHistory){
    if(!image.current||!original)return;
    setBusy(true);setError('');
    try{
      const box=selection.w<.015||selection.h<.015?{x:0,y:0,w:1,h:1}:selection;
      const blob=await cropBlob(image.current,box);
      const name=(title.trim()||'fashion-finder')+'.jpg';
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      if(saveHistory){
        await put({id:crypto.randomUUID(),createdAt:Date.now(),title:title.trim()||fileName||'패션 이미지',blob});
        await refresh();
      }
      return true;
    }catch(e){setError('이미지 처리 오류: '+e.message);return false}
    finally{setBusy(false)}
  }
  async function lens(){
    // Open immediately during the tap: iOS Safari blocks popups opened after an await.
    const tab=window.open('about:blank','_blank');
    const ok=await prepare(true);
    if(ok){
      if(tab)tab.location.replace('https://www.google.com/');
      else window.location.assign('https://www.google.com/');
    }else if(tab)tab.close();
  }
  async function naverLens(){
    // Open NAVER Search instead of an app relay; Smart Lens availability varies by browser.
    const tab=window.open('about:blank','_blank');
    const ok=await prepare(true);
    if(ok){
      const destination='https://m.naver.com/';
      if(tab)tab.location.replace(destination);
      else window.location.assign(destination);
    }else if(tab)tab.close();
  }
  async function reuse(row){
    if(selectedImage)URL.revokeObjectURL(selectedImage);
    const url=URL.createObjectURL(row.blob);setSelectedImage(url);
    setOriginal(url);setFileName(row.title);setTitle(row.title);setSelection({x:0,y:0,w:1,h:1});
    window.scrollTo({top:0,behavior:'smooth'});
  }
  async function erase(id){try{await remove(id);await refresh()}catch(e){setError('기록 삭제 실패: '+e.message)}}
  return <section className="finder">
    <div className="finder-head"><h1>FASHION FINDER</h1><p>사진에서 원하는 옷을 선택해 Google Lens 또는 네이버 스마트렌즈로 찾아봐.</p></div>
    <label className="finder-upload"><ImagePlus size={21}/><span>사진 선택</span><input ref={input} type="file" accept="image/*" onChange={choose}/></label>
    {original?<div className="finder-workspace">
      <p className="finder-hint">사진에서 찾고 싶은 옷을 손가락으로 드래그해 선택해. 전체 사진을 쓰려면 그대로 진행하면 돼.</p>
      <div className="finder-image-wrap" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img ref={image} src={original} draggable="false" alt="검색할 패션 사진"/>
        <span className="finder-selection" style={{left:(selection.x*100)+'%',top:(selection.y*100)+'%',width:(selection.w*100)+'%',height:(selection.h*100)+'%'}}/>
      </div>
      <div className="finder-action-row">
        <button type="button" className="finder-secondary" onClick={()=>setSelection({x:0,y:0,w:1,h:1})}><RotateCcw size={16}/> 전체 선택</button>
        <input aria-label="검색 기록 이름" value={title} onChange={e=>setTitle(e.target.value)} placeholder="이 옷 이름"/>
      </div>
      <div className="finder-lens-buttons">
        <button type="button" className="finder-primary" disabled={busy} onClick={lens}><ScanSearch size={18}/>{busy?'준비 중…':'Google Lens'}<ExternalLink size={15}/></button>
        <button type="button" className="finder-primary finder-naver" disabled={busy} onClick={naverLens}><ScanSearch size={18}/>{busy?'준비 중…':'네이버 스마트렌즈'}<ExternalLink size={15}/></button>
      </div>
      <button type="button" className="finder-secondary finder-download" disabled={busy} onClick={()=>prepare(false)}><Download size={16}/> 선택 영역만 저장</button>
      <p className="finder-explain">선택한 사진을 먼저 기기에 저장해줘. Google 검색창의 카메라(Lens) 아이콘을 누르고 저장된 사진을 선택해줘. iPhone에서는 Google 앱 또는 지원 브라우저가 필요할 수 있어. 네이버 버튼은 네이버 검색 첫 화면을 열어줘. 스마트렌즈 카메라 아이콘이 보이면 눌러서 저장한 사진을 선택해줘. 브라우저에서 아이콘이 보이지 않으면 네이버 앱에서 스마트렌즈를 이용해야 해. 사진 자동 전달과 검색 결과 앱 내부 표시는 지원하지 않아.</p>
    </div>:<div className="finder-empty">먼저 인스타그램·쇼핑몰·코디 사진을 선택해줘.</div>}
    {error&&<p role="alert" className="finder-error">{error}</p>}
    <div className="finder-record-title"><h2>검색 기록</h2><small>{records.length}개 · 이 기기에만 저장</small></div>
    <div className="finder-records">{records.map(row=><div key={row.id} className="finder-record">
      <button type="button" className="finder-record-open" onClick={()=>reuse(row)}><Bookmark size={16}/><span><strong>{row.title}</strong><small>{new Date(row.createdAt).toLocaleDateString('ko-KR')}</small></span></button>
      <button type="button" aria-label="검색 기록 삭제" title="삭제" className="finder-delete" onClick={()=>erase(row.id)}><Trash2 size={16}/></button>
    </div>)}</div>
    {!records.length&&<p className="finder-hint">아직 저장한 검색 기록이 없어.</p>}
  </section>;
}
