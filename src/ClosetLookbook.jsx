import React,{useEffect,useRef,useState} from 'react';
import {Plus,Images,Check,X,Trash2} from 'lucide-react';
import {useLocalCollection} from './sync/LocalSync.jsx';
import {uploadPhoto,photoUrl} from './supabase.js';
import './ClosetLookbook.css';

export default function ClosetLookbook({userId}){
 const collection=useLocalCollection('closet-lookbook-boards');
 const [boards,setBoards]=useState([]);
 const [pictures,setPictures]=useState({});
 const [busy,setBusy]=useState('');
 const [editing,setEditing]=useState(null);
 const [draft,setDraft]=useState('');
 const [error,setError]=useState('');
 const scrolling=useRef(null);
 const seeded=useRef(false);
 const pressTimer=useRef(null);
 const longPressed=useRef(false);
 const fileRefs=useRef({});
 const sorted=[...boards].sort((a,b)=>(a.position??0)-(b.position??0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
 const nextNumber=()=>Math.max(0,...boards.map(b=>Number(b.number)||0))+1;
 useEffect(()=>{
  let alive=true;
  const reload=()=>collection.read().then(async rows=>{
   if(!alive)return;
   const mine=rows.filter(r=>r.userId===userId);
   setBoards(mine);
   if(mine.length===0&&!seeded.current){
    seeded.current=true;
    const now=new Date().toISOString();
    const first={id:crypto.randomUUID(),userId,type:'lookbook-board',number:1,name:'보드1',position:0,slots:Array(8).fill(null),created_at:now,updated_at:now};
    try{await collection.write(first)}catch(e){if(alive)setError('첫 보드 저장 실패: '+e.message)}
   }
  }).catch(e=>{if(alive)setError(e.message)});
  reload();
  const unsubscribe=collection.subscribe(reload);
  return()=>{alive=false;unsubscribe();clearTimeout(pressTimer.current)};
 },[collection,userId]);
 useEffect(()=>{
  let active=true;
  (async()=>{
   const next={};
   await Promise.all(sorted.flatMap(board=>(board.slots||[]).map(async(path,index)=>{
    if(path){const url=await photoUrl(path);if(url)next[board.id+':'+index]=url}
   })));
   if(active)setPictures(next);
  })().catch(e=>{if(active)setError('사진 불러오기 실패: '+e.message)});
  return()=>{active=false};
 },[boards,userId]);
 async function createBoard(){
  const number=nextNumber();
  const board={id:crypto.randomUUID(),userId,type:'lookbook-board',number,name:'보드'+number,position:sorted.length,slots:Array(8).fill(null),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  setBusy('create');setError('');
  try{
   await collection.write(board);
   requestAnimationFrame(()=>scrolling.current?.scrollTo({left:scrolling.current.scrollWidth,behavior:'smooth'}));
  }catch(e){setError('보드 추가 실패: '+e.message)}finally{setBusy('')}
 }
 function beginPress(board){
  longPressed.current=false;
  clearTimeout(pressTimer.current);
  pressTimer.current=setTimeout(()=>{longPressed.current=true;setDraft(board.name);setEditing(board.id)},550);
 }
 function cancelPress(){clearTimeout(pressTimer.current)}
 async function saveName(board){
  const name=draft.trim();
  if(!name){setEditing(null);return}
  setBusy(board.id);
  try{await collection.write({...board,name,updated_at:new Date().toISOString()});setEditing(null)}
  catch(e){setError('보드 이름 저장 실패: '+e.message)}
  finally{setBusy('')}
 }
 async function upload(board,index,event){
  const file=event.currentTarget.files?.[0];
  event.currentTarget.value='';
  if(!file)return;
  if(!file.type.startsWith('image/')){setError('사진 파일만 등록할 수 있어요.');return}
  const key=board.id+':'+index;
  setBusy(key);setError('');
  try{
   const path=await uploadPhoto(file,userId);
   const slots=[...(board.slots||Array(8).fill(null))];
   slots[index]=path;
   await collection.write({...board,slots,updated_at:new Date().toISOString()});
  }catch(e){setError('사진 저장 실패: '+e.message)}
  finally{setBusy('')}
 }
 async function clearSlot(board,index){
  const slots=[...(board.slots||Array(8).fill(null))];
  slots[index]=null;
  setBusy(board.id+':'+index);
  try{await collection.write({...board,slots,updated_at:new Date().toISOString()})}
  catch(e){setError('사진 제거 실패: '+e.message)}
  finally{setBusy('')}
 }
 return <section className="closet-lookbook">
  <div className="lookbook-heading"><h1>LOOKBOOK</h1></div>
  {error&&<p role="alert" className="lookbook-error">{error}</p>}
  <div className="lookbook-scroller" ref={scrolling} aria-label="룩북 보드 가로 스크롤">
   {sorted.map(board=><article key={board.id} className="lookbook-board">
    <div className="lookbook-board-heading">
     {editing===board.id?
      <form className="lookbook-rename" onSubmit={e=>{e.preventDefault();saveName(board)}}>
       <input aria-label="보드 이름" autoFocus maxLength={40} value={draft} onChange={e=>setDraft(e.target.value)}/>
       <button type="submit" aria-label="이름 저장"><Check size={18}/></button>
       <button type="button" onClick={()=>setEditing(null)} aria-label="취소"><X size={18}/></button>
      </form>
      :<button type="button" className="lookbook-board-title" onPointerDown={()=>beginPress(board)} onPointerUp={cancelPress} onPointerMove={cancelPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress} onContextMenu={e=>{e.preventDefault();setDraft(board.name);setEditing(board.id)}} onClick={()=>{longPressed.current=false}} title="길게 누르면 이름 편집">{board.name}</button>}
    </div>
    <div className="lookbook-tiles">
     {Array.from({length:8},(_,index)=>index).map(index=>{const path=(board.slots||[])[index],url=pictures[board.id+':'+index],key=board.id+':'+index;return <div className="lookbook-tile" key={index}>
      <input ref={el=>{if(el)fileRefs.current[key]=el;else delete fileRefs.current[key]}} type="file" accept="image/*" aria-label={board.name+' '+(index+1)+'번 사진 선택'} onChange={e=>upload(board,index,e)} hidden/>
      <button type="button" className="lookbook-photo-button" disabled={!!busy} aria-label={board.name+' '+(index+1)+'번 사진 '+(path?'교체':'추가')} onClick={()=>fileRefs.current[key]?.click()}>
       {url?<img src={url} alt={board.name+' '+(index+1)+'번 사진'}/>:<span className="lookbook-empty"><Plus size={23}/></span>}
       {busy===key&&<span className="lookbook-loading">저장 중</span>}
      </button>
      {path&&<button type="button" className="lookbook-clear" aria-label={board.name+' '+(index+1)+'번 사진 제거'} disabled={!!busy} onClick={()=>clearSlot(board,index)}><X size={15}/></button>}
     </div>})}
    </div>
   </article>)}
   <button type="button" className="lookbook-add-board" onClick={createBoard} disabled={!!busy}><Plus size={25}/><span>보드 추가</span></button>
  </div>
 </section>;
}
