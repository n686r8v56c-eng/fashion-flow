import React,{useEffect,useRef,useState} from 'react';
import {Plus,Check,X,NotebookPen,Archive,ArchiveRestore,Pencil,Trash2} from 'lucide-react';
import {useLocalCollection} from './sync/LocalSync.jsx';
import {uploadPhoto,photoUrl} from './supabase.js';
import './ClosetLookbook.css';

export default function ClosetLookbook({userId}){
 const collection=useLocalCollection('closet-lookbook-boards');
 const [boards,setBoards]=useState([]);
 const [boardType,setBoardType]=useState('wish');
 const [categoryMenu,setCategoryMenu]=useState(null);
 const [categoryNameDraft,setCategoryNameDraft]=useState(null);
 const [boardMenu,setBoardMenu]=useState(null);
 const [showArchived,setShowArchived]=useState(false);
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
 const categoryTimer=useRef(null);
 const categoryPressFired=useRef(false);
 const categoryMeta=boards.filter(b=>b.type==='lookbook-category');
 const customCategories=categoryMeta.filter(b=>b.categoryId&&!['wish','look'].includes(b.categoryId)).sort((a,b)=>(a.position??0)-(b.position??0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
 const categoryIds=['wish','look',...customCategories.map(b=>b.categoryId)];
 const categorySettings=id=>categoryMeta.find(b=>b.id===`lookbook-category:${userId}:${id}`);
 const visibleCategories=categoryIds.filter(id=>!categorySettings(id)?.hidden);
 const categoryLabel=id=>categorySettings(id)?.name|| (id==='wish'?'Wish':id==='look'?'Look':'새 함');
 const categoryBoards=boards.filter(b=>b.type!=='lookbook-category'&&(b.boardType||'wish')===boardType);
 const activeBoards=categoryBoards.filter(b=>!b.archivedAt);
 const archivedBoards=categoryBoards.filter(b=>!!b.archivedAt).sort((a,b)=>String(b.archivedAt).localeCompare(String(a.archivedAt)));
 const sorted=[...activeBoards].sort((a,b)=>(a.position??0)-(b.position??0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
 const nextNumber=()=>Math.max(0,...categoryBoards.map(b=>Number(b.number)||0))+1;
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
  return()=>{alive=false;unsubscribe();clearTimeout(pressTimer.current);clearTimeout(categoryTimer.current)};
 },[collection,userId]);
 useEffect(()=>{
  if(!loaded||!['wish','look'].includes(boardType)||!visibleCategories.includes(boardType)||categoryBoards.length||seeding.current.has(boardType))return;
  seeding.current.add(boardType);
  const now=new Date().toISOString();
  const first={id:crypto.randomUUID(),userId,type:'lookbook-board',boardType,number:1,name:'보드1',position:0,slots:Array(8).fill(null),created_at:now,updated_at:now};
  collection.write(first).catch(e=>{setError('첫 보드 저장 실패: '+e.message);seeding.current.delete(boardType)});
 },[loaded,boardType,categoryBoards.length,collection,userId,visibleCategories.join('|')]);
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
 
 async function createCategory(){
  if(busy)return;
  const id=`custom-${crypto.randomUUID()}`;
  const number=Math.max(0,...customCategories.map(c=>Number(String(c.name||'').match(/^함(\\d+)$/)?.[1])||0))+1;
  const now=new Date().toISOString();
  const record={id:`lookbook-category:${userId}:${id}`,type:'lookbook-category',userId,categoryId:id,name:`함${number}`,hidden:false,position:customCategories.length,created_at:now,updated_at:now};
  setBusy('category');setError('');
  try{await collection.write(record);setBoardType(id);setShowArchived(false);setCategoryMenu(null);scrolling.current?.scrollTo({left:0});}
  catch(e){setError('새 함 추가 실패: '+e.message)}finally{setBusy('')}
 }
 function openCategoryMenu(id){categoryPressFired.current=true;setCategoryMenu(id);setBoardMenu(null);setEditing(null);}
 function startCategoryPress(id){clearTimeout(categoryTimer.current);categoryPressFired.current=false;categoryTimer.current=setTimeout(()=>openCategoryMenu(id),550);}
 function stopCategoryPress(){clearTimeout(categoryTimer.current);}
 function selectCategory(id){if(categoryPressFired.current){categoryPressFired.current=false;return;}setBoardType(id);setShowArchived(false);setEditing(null);setMemoTarget(null);scrolling.current?.scrollTo({left:0});}
 async function persistCategory(id,changes){
  const existing=categorySettings(id);
  const record={id:`lookbook-category:${userId}:${id}`,type:'lookbook-category',userId,categoryId:id,name:categoryLabel(id),hidden:false,...existing,...changes,updated_at:new Date().toISOString()};
  setBusy('category');setError('');
  try{await collection.write(record);return true}catch(e){setError('분류 저장 실패: '+e.message);return false}finally{setBusy('')}
 }
 async function renameCategory(id){
  const name=(categoryNameDraft||'').trim();if(!name){setError('이름을 입력해 줘.');return}
  if(await persistCategory(id,{name})){setCategoryNameDraft(null);setCategoryMenu(null)}
 }
 async function hideCategory(id){
  if(visibleCategories.length<=1){setError('마지막 분류는 숨길 수 없어요.');return}
  if(!window.confirm(`${categoryLabel(id)} 탭을 목록에서 숨길까? 보드와 사진은 삭제되지 않으며 다시 복원할 수 있어요.`))return;
  if(await persistCategory(id,{hidden:true})){setBoardType(visibleCategories.find(x=>x!==id));setCategoryMenu(null);setShowArchived(false)}
 }
 async function restoreCategory(id){if(await persistCategory(id,{hidden:false})){setBoardType(id);setShowArchived(false)}}
 function beginBoardMenu(board){longPressed.current=true;setBoardMenu(board.id);setCategoryMenu(null)}
 async function deleteBoard(board){
  if(!window.confirm(`${board.name} 보드를 삭제할까? 데이터 보호를 위해 보관함으로 이동하며 복원할 수 있어요.`))return;
  setBusy(board.id);setError('');
  try{await collection.write({...board,archivedAt:new Date().toISOString(),deletedAt:new Date().toISOString(),updated_at:new Date().toISOString()});setBoardMenu(null)}
  catch(e){setError('보드 보관 실패: '+e.message)}finally{setBusy('')}
 }

 async function changeArchive(board,archive){
  if(busy)return;
  if(archive&&!window.confirm('이 보드를 아카이브할까? 사진과 메모는 그대로 보관돼요.'))return;
  setBusy(board.id);setError('');
  try{
   await collection.write({...board,archivedAt:archive?new Date().toISOString():null,deletedAt:archive?board.deletedAt||null:null,updated_at:new Date().toISOString()});
  }catch(e){setError((archive?'아카이브':'복원')+' 실패: '+e.message)}
  finally{setBusy('')}
 }
 async function createBoard(){
  const number=nextNumber();
  const board={id:crypto.randomUUID(),userId,type:'lookbook-board',boardType,number,name:'보드'+number,position:Math.max(-1,...categoryBoards.map(b=>Number(b.position)||0))+1,slots:Array(8).fill(null),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  setBusy('create');setError('');
  try{
   await collection.write(board);
   requestAnimationFrame(()=>scrolling.current?.scrollTo({left:scrolling.current.scrollWidth,behavior:'smooth'}));
  }catch(e){setError('보드 추가 실패: '+e.message)}finally{setBusy('')}
 }
 function beginPress(board){
  longPressed.current=false;
  clearTimeout(pressTimer.current);
  pressTimer.current=setTimeout(()=>beginBoardMenu(board),550);
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
  <div className="lookbook-heading"><div className="lookbook-heading-left"><h1>LOOKBOOK</h1><button type="button" className={"lookbook-archive-shortcut"+(showArchived?" active":"")} aria-label={showArchived?"보드로 돌아가기":`아카이브 ${archivedBoards.length}개 보기`} aria-pressed={showArchived} onClick={()=>{setShowArchived(v=>!v);setEditing(null);setMemoTarget(null)}}><Archive size={19}/><span>({archivedBoards.length})</span></button></div></div>
  <div className="lookbook-category-row" role="tablist" aria-label="룩북 분류">
   {visibleCategories.map(id=><button key={id} type="button" role="tab" aria-selected={boardType===id} className={"lookbook-category-label"+(boardType===id?" active":"")} onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;startCategoryPress(id)}} onPointerUp={stopCategoryPress} onPointerCancel={stopCategoryPress} onPointerMove={stopCategoryPress} onPointerLeave={stopCategoryPress} onContextMenu={e=>{e.preventDefault();stopCategoryPress();openCategoryMenu(id)}} onClick={()=>selectCategory(id)} title="길게 눌러 이름 편집·삭제">{categoryLabel(id)}</button>)}
   <button type="button" className="lookbook-category-plus" onClick={createCategory} disabled={!!busy} aria-label="새 룩북 함 추가" title="새 함 추가"><Plus size={21}/></button>
   {visibleCategories.length<categoryIds.length&&<button type="button" className="lookbook-category-restore" onClick={()=>setCategoryMenu('restore')}>숨긴 탭 복원</button>}
  </div>
  {categoryMenu&&<div className="lookbook-category-menu-backdrop" onClick={()=>{setCategoryMenu(null);setCategoryNameDraft(null)}}><div className="lookbook-category-menu" role="dialog" aria-modal="true" aria-label="룩북 분류 편집" onClick={e=>e.stopPropagation()}>
   <strong>{categoryMenu==='restore'?'숨긴 탭 복원':categoryLabel(categoryMenu)}</strong>
   {categoryMenu==='restore'?categoryIds.filter(id=>!visibleCategories.includes(id)).map(id=><button key={id} type="button" onClick={()=>{restoreCategory(id);setCategoryMenu(null)}}><ArchiveRestore size={18}/>{categoryLabel(id)} 복원</button>):categoryNameDraft!==null?<form onSubmit={e=>{e.preventDefault();renameCategory(categoryMenu)}}><input autoFocus maxLength={40} aria-label="분류 이름" value={categoryNameDraft} onChange={e=>setCategoryNameDraft(e.target.value)}/><button type="submit" disabled={!!busy}><Check size={18}/> 저장</button></form>:<>
    <button type="button" onClick={()=>setCategoryNameDraft(categoryLabel(categoryMenu))}><Pencil size={18}/> 이름 편집</button>
    <button type="button" disabled={!!busy||visibleCategories.length<=1} onClick={()=>hideCategory(categoryMenu)}><Trash2 size={18}/> 탭 삭제</button>
   </>}
   <button type="button" onClick={()=>{setCategoryMenu(null);setCategoryNameDraft(null)}}><X size={18}/> 취소</button>
  </div></div>}
  {error&&<p role="alert" className="lookbook-error">{error}</p>}
  {!showArchived?<div className="lookbook-scroller" ref={scrolling} aria-label="룩북 보드 가로 스크롤">
   {sorted.map(board=><article key={board.id} className="lookbook-board">
    <div className="lookbook-board-heading">
     {editing===board.id?
      <form className="lookbook-rename" onSubmit={e=>{e.preventDefault();saveName(board)}}>
       <input aria-label="보드 이름" autoFocus maxLength={40} value={draft} onChange={e=>setDraft(e.target.value)}/>
       <button type="submit" aria-label="이름 저장"><Check size={18}/></button>
       <button type="button" onClick={()=>setEditing(null)} aria-label="취소"><X size={18}/></button>
      </form>
      :<button type="button" className="lookbook-board-title" onPointerDown={()=>beginPress(board)} onPointerUp={cancelPress} onPointerMove={cancelPress} onPointerLeave={cancelPress} onPointerCancel={cancelPress} onContextMenu={e=>{e.preventDefault();beginBoardMenu(board)}} onClick={()=>{if(longPressed.current){longPressed.current=false;return}}} title="길게 누르면 이름 편집 또는 삭제">{board.name}</button>}
     <button type="button" className="lookbook-archive-action" disabled={!!busy} onClick={()=>changeArchive(board,true)} aria-label={board.name+' 아카이브'} title="사진과 메모를 보존하고 아카이브"><Archive size={17}/></button>
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
   <button type="button" className="lookbook-add-board" onClick={createBoard} disabled={!!busy} aria-label={categoryLabel(boardType)+" 보드 추가"}><Plus size={25}/><span>보드 추가</span></button>
  </div>:<div className="lookbook-archive-list" aria-label={categoryLabel(boardType)+' 아카이브'}>
   {archivedBoards.length===0?<p>아카이브한 보드가 없어요.</p>:archivedBoards.map(board=><div className="lookbook-archive-item" key={board.id}><div><strong>{board.name}</strong><small>{(board.slots||[]).filter(Boolean).length}장 사진 · {board.archivedAt?.slice(0,10)}</small></div><button type="button" disabled={!!busy} onClick={()=>changeArchive(board,false)}><ArchiveRestore size={17}/> 복원</button></div>)}
  </div>}
  {boardMenu&&<div className="lookbook-category-menu-backdrop" onClick={()=>setBoardMenu(null)}><div className="lookbook-category-menu" role="dialog" aria-modal="true" aria-label="보드 편집" onClick={e=>e.stopPropagation()}><strong>{boards.find(b=>b.id===boardMenu)?.name}</strong><button type="button" onClick={()=>{const b=boards.find(b=>b.id===boardMenu);if(b){setDraft(b.name);setEditing(b.id)}setBoardMenu(null)}}><Pencil size={18}/> 이름 편집</button><button type="button" disabled={!!busy} onClick={()=>{const b=boards.find(b=>b.id===boardMenu);if(b)deleteBoard(b)}}><Trash2 size={18}/> 보드 삭제</button><button type="button" onClick={()=>setBoardMenu(null)}><X size={18}/> 취소</button></div></div>}
  {memoTarget&&<div className="lookbook-memo-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setMemoTarget(null)}}>
    <section className="lookbook-memo-dialog" role="dialog" aria-modal="true" aria-labelledby="lookbook-memo-title">
      <div className="lookbook-memo-heading"><h2 id="lookbook-memo-title">메모</h2><button type="button" aria-label="닫기" onClick={()=>setMemoTarget(null)}><X size={21}/></button></div>
      <textarea autoFocus aria-label="사진 메모" value={memoDraft} onChange={e=>setMemoDraft(e.target.value)} rows={7}/>
      <div className="lookbook-memo-actions"><button type="button" disabled={!!busy} onClick={()=>setMemoTarget(null)}>취소</button><button type="button" disabled={!!busy} onClick={saveMemo}>저장</button></div>
    </section>
  </div>}
 </section>;
}
