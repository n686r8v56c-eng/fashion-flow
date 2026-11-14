import React,{useEffect,useRef,useState} from 'react';
import {Plus,Check,X,NotebookPen} from 'lucide-react';
import {useLocalCollection} from './sync/LocalSync.jsx';
import {uploadPhoto,photoUrl} from './supabase.js';
import './ClosetLookbook.css';

export default function ClosetLookbook({userId}){
 const collection=useLocalCollection('closet-lookbook-boards');
 const [boards,setBoards]=useState([]);
 const [boardType,setBoardType]=useState('wish');
 const [loaded,setLoaded]=useState(false);
 const [pictures,setPictures]=useState({});
 const [busy,setBusy]=useState('');
 const [editing,setEditing]=useState(null);
 const [draft,setDraft]=useState('');
 const [error,setError]=useState('');
 const [memoTarget,setMemoTarget]=useState(null);
 const [memoDraft,setMemoDraft]=useState('');
 const scrolling=useRef(null);
 const seeding=useRef(new Set());
 const pressTimer=useRef(null);
 const longPressed=useRef(false);
 const fileRefs=useRef({});
 const activeBoards=boards.filter(b=>(b.boardType||'wish')===boardType);
 const sorted=[...activeBoards].sort((a,b)=>(a.position??0)-(b.position??0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
 const nextNumber=()=>Math.max(0,...activeBoards.map(b=>Number(b.number)||0))+1;
 useEffect(()=>{
  let alive=true;
  const reload=()=>collection.read().then(async rows=>{
   if(!alive)return;
   const mine=rows.filter(r=>r.userId===userId);
   setBoards(mine);
   setLoaded(true);
  }).catch(e=>{if(alive)setError(e.message)});
  reload();
  const unsubscribe=collection.subscribe(reload);
  return()=>{alive=false;unsubscribe();clearTimeout(pressTimer.current)};
 },[collection,userId]);
 useEffect(()=>{
  if(!loaded||activeBoards.length||seeding.current.has(boardType))return;
  seeding.current.add(boardType);
  const now=new Date().toISOString();
  const first={id:crypto.randomUUID(),userId,type:'lookbook-board',boardType,number:1,name:'보드1',position:0,slots:Array(8).fill(null),created_at:now,updated_at:now};
  collection.write(first).catch(e=>{setError('첫 보드 저장 실패: '+e.message);seeding.current.delete(boardType)});
 },[loaded,boardType,activeBoards.length,collection,userId]);
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
  const board={id:crypto.randomUUID(),userId,type:'lookbook-board',boardType,number,name:'보드'+number,position:sorted.length,slots:Array(8).fill(null),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
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
 function openMemo(board,index){
  setMemoTarget({boardId:board.id,index});
  setMemoDraft(String((board.memos||{})[index]||''));
 }
 async function saveMemo(){
  if(!memoTarget)return;
  const board=boards.find(b=>b.id===memoTarget.boardId);
  if(!board)return;
  setBusy('memo');setError('');
  try{
   await collection.write({...board,memos:{...(board.memos||{}),[memoTarget.index]:memoDraft},updated_at:new Date().toISOString()});
   setMemoTarget(null);
  }catch(e){setError('메모 저장 실패: '+e.message)}
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
  <div className="lookbook-heading"><h1>LOOKBOOK</h1><div className="lookbook-type-tabs" role="tablist" aria-label="룩북 분류"><button type="button" role="tab" className={boardType==='wish'?'active':''} aria-selected={boardType==='wish'} onClick={()=>{setBoardType('wish');setEditing(null);setMemoTarget(null);scrolling.current?.scrollTo({left:0})}}>Wish</button><button type="button" role="tab" className={boardType==='look'?'active':''} aria-selected={boardType==='look'} onClick={()=>{setBoardType('look');setEditing(null);setMemoTarget(null);scrolling.current?.scrollTo({left:0})}}>Look</button></div></div>
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
      {path&&<button type="button" className={'lookbook-memo'+(String((board.memos||{})[index]||'').trim()?' has-memo':'')} aria-label={board.name+' '+(index+1)+'번 사진 메모'} onClick={()=>openMemo(board,index)}><NotebookPen size={17}/></button>}
      {path&&<button type="button" className="lookbook-clear" aria-label={board.name+' '+(index+1)+'번 사진 제거'} disabled={!!busy} onClick={()=>clearSlot(board,index)}><X size={15}/></button>}
     </div>})}
    </div>
   </article>)}
   <button type="button" className="lookbook-add-board" onClick={createBoard} disabled={!!busy}><Plus size={25}/><span>보드 추가</span></button>
  </div>
  {memoTarget&&<div className="lookbook-memo-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setMemoTarget(null)}}>
    <section className="lookbook-memo-dialog" role="dialog" aria-modal="true" aria-labelledby="lookbook-memo-title">
      <div className="lookbook-memo-heading"><h2 id="lookbook-memo-title">메모</h2><button type="button" aria-label="닫기" onClick={()=>setMemoTarget(null)}><X size={21}/></button></div>
      <textarea autoFocus aria-label="사진 메모" value={memoDraft} onChange={e=>setMemoDraft(e.target.value)} rows={7}/>
      <div className="lookbook-memo-actions"><button type="button" disabled={!!busy} onClick={()=>setMemoTarget(null)}>취소</button><button type="button" disabled={!!busy} onClick={saveMemo}>저장</button></div>
    </section>
  </div>}
 </section>;
}
