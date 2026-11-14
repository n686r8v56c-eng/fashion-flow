import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Archive,ArchiveRestore,Check,ExternalLink,Link2,NotebookPen,Plus,X} from 'lucide-react';
import {useLocalCollection} from './sync/LocalSync.jsx';
import './ClosetNotes.css';

const DEFAULT_TITLES=['메모리랩','뷰티건강','Write','Fashion','Money','Thread'];
const blank=()=>({id:crypto.randomUUID(),text:'',done:false,archived:false,link:''});
const newSection=(userId,index)=>({id:'section-'+index,userId,type:'closet-checklist',order:index,title:DEFAULT_TITLES[index],entries:[],updated_at:new Date().toISOString()});
const safeUrl=value=>{const text=String(value||'').trim();if(!text)return '';try{const url=new URL(text);if(url.protocol!=='http:'&&url.protocol!=='https:')return null;return url.href}catch{return null}};

export default function ClosetNotes({userId}){
 const collection=useLocalCollection('closet-notes-v1');
 const [sections,setSections]=useState([]);
 const [archiveView,setArchiveView]=useState(false);
 const [renameId,setRenameId]=useState(null);
 const [titleDraft,setTitleDraft]=useState('');
 const [linkTarget,setLinkTarget]=useState(null);
 const [linkDraft,setLinkDraft]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const sectionsRef=useRef([]);
 const inputs=useRef({});
 const hold=useRef(null);
 const editing=useRef(false);
 const queuedFocus=useRef(null);
 const initialized=useRef(false);
 const timers=useRef(new Map());
 const pending=useRef(new Map());
 const writeQueue=useRef(Promise.resolve());

 const setLocal=rows=>{sectionsRef.current=rows;setSections(rows)};
 const persist=useCallback((section,immediate=false)=>{
  const value={...section,updated_at:new Date().toISOString()};
  const rows=sectionsRef.current.map(row=>row.id===value.id?value:row);
  setLocal(rows);
  pending.current.set(value.id,value);
  const flush=()=>{
   const latest=pending.current.get(value.id);
   if(!latest)return;
   pending.current.delete(value.id);
   writeQueue.current=writeQueue.current.catch(()=>{}).then(()=>collection.write(latest));
   writeQueue.current.catch(e=>setError('저장 실패: '+e.message));
  };
  clearTimeout(timers.current.get(value.id));
  if(immediate)flush();
  else timers.current.set(value.id,setTimeout(flush,320));
 },[collection]);
 const flushAll=()=>{
  for(const [id,value] of pending.current){
   clearTimeout(timers.current.get(id));
   pending.current.delete(id);
   writeQueue.current=writeQueue.current.catch(()=>{}).then(()=>collection.write(value));
   writeQueue.current.catch(e=>setError('저장 실패: '+e.message));
  }
 };

 useEffect(()=>{
  let live=true;
  const load=async()=>{
   try{
    const rows=(await collection.read()).filter(x=>x.userId===userId&&x.type==='closet-checklist');
    if(!live)return;
    if(!rows.length&&!initialized.current){
     initialized.current=true;
     const defaults=DEFAULT_TITLES.map((_,i)=>newSection(userId,i));
     setLocal(defaults);
     await collection.writeBatch(defaults);
     return;
    }
    if(pending.current.size===0){
     const sorted=[...rows].sort((a,b)=>(a.order||0)-(b.order||0));
     setLocal(sorted);
    }
   }catch(e){if(live)setError('불러오기 실패: '+e.message)}
  };
  load();
  const off=collection.subscribe(load);
  return()=>{live=false;off()};
 },[collection,userId]);
 useEffect(()=>()=>{
  for(const timer of timers.current.values())clearTimeout(timer);
  for(const value of pending.current.values()){
   writeQueue.current=writeQueue.current.catch(()=>{}).then(()=>collection.write(value));
  }
 },[collection]);
 useEffect(()=>{
  const id=queuedFocus.current;
  if(id&&inputs.current[id]){
   const node=inputs.current[id];
   node.focus();
   const len=node.value.length;
   node.setSelectionRange(len,len);
   queuedFocus.current=null;
  }
 },[sections]);

 const updateEntry=(section,id,patch,immediate=false)=>{
  persist({...section,entries:(section.entries||[]).map(entry=>entry.id===id?{...entry,...patch}:entry)},immediate);
 };
 const addAt=(section,index)=>{
  const entry=blank();
  const entries=[...(section.entries||[])];
  entries.splice(index,0,entry);
  queuedFocus.current=entry.id;
  persist({...section,entries},true);
 };
 const archive=(section,entry)=>{
  if(!entry.text.trim()&&!entry.link){
   persist({...section,entries:(section.entries||[]).filter(x=>x.id!==entry.id)},true);
   return;
  }
  updateEntry(section,entry.id,{archived:true},true);
 };
 const handleKey=(event,section,entry,index)=>{
  if(event.nativeEvent?.isComposing||event.keyCode===229)return;
  if(event.key==='Enter'){
   event.preventDefault();addAt(section,index+1);
  }else if(event.key==='Backspace'&&!entry.text&&event.currentTarget.selectionStart===0&&event.currentTarget.selectionEnd===0){
   const visible=(section.entries||[]).filter(x=>!x.archived);
   const position=visible.findIndex(x=>x.id===entry.id);
   const above=visible[position-1];
   if(above){
    event.preventDefault();
    queuedFocus.current=above.id;
    persist({...section,entries:(section.entries||[]).filter(x=>x.id!==entry.id)},true);
   }
  }
 };
 const openLink=(section,entry)=>{
  editing.current=true;
  setLinkTarget({sectionId:section.id,entryId:entry.id});
  setLinkDraft(entry.link||'');
 };
 const saveLink=()=>{
  if(!linkTarget)return;
  const url=safeUrl(linkDraft);
  if(url===null){setError('http 또는 https 링크를 입력해 주세요.');return}
  const section=sectionsRef.current.find(x=>x.id===linkTarget.sectionId);
  if(section)updateEntry(section,linkTarget.entryId,{link:url},true);
  setLinkTarget(null);
  setError('');
 };
 const saveTitle=()=>{
  const section=sectionsRef.current.find(x=>x.id===renameId);
  if(section&&titleDraft.trim())persist({...section,title:titleDraft.trim()},true);
  setRenameId(null);
 };
 const sectionRows=sections.filter(x=>x.userId===userId);
 return <section className="closet-notes">
  <div className="closet-notes-head"><h1>메모장</h1><button type="button" className={archiveView?'active':''} aria-pressed={archiveView} onClick={()=>{flushAll();setArchiveView(v=>!v)}}><Archive size={18}/>{archiveView?'전체':'아카이브'}</button></div>
  {error&&<p className="closet-notes-error" role="alert">{error}</p>}
  <div className="closet-notes-grid">
   {sectionRows.map(section=>{
    const entries=(section.entries||[]).filter(x=>Boolean(x.archived)===archiveView);
    return <div className="closet-notes-section" key={section.id}>
     {renameId===section.id?<form className="closet-notes-rename" onSubmit={e=>{e.preventDefault();saveTitle()}}>
       <input autoFocus value={titleDraft} maxLength={35} onChange={e=>setTitleDraft(e.target.value)} aria-label="영역 제목"/>
       <button type="submit" aria-label="제목 저장"><Check size={18}/></button>
      </form>:<button type="button" className="closet-notes-section-title" onClick={()=>{setRenameId(section.id);setTitleDraft(section.title)}}>{section.title}</button>}
     <div className="closet-notes-entries">
      {entries.map((entry,index)=><div className="closet-notes-entry" key={entry.id}
       onContextMenu={e=>{e.preventDefault();if(!archiveView)openLink(section,entry)}}>
       <input type="checkbox" aria-label={entry.text||'체크 항목'} checked={!!entry.done} disabled={archiveView} onChange={e=>updateEntry(section,entry.id,{done:e.target.checked},true)}/>
       <input className="closet-notes-input" ref={el=>{if(el)inputs.current[entry.id]=el;else delete inputs.current[entry.id]}}
        value={entry.text} readOnly={archiveView} aria-label="체크 항목 수정" onChange={e=>updateEntry(section,entry.id,{text:e.target.value})}
        onKeyDown={e=>handleKey(e,section,entry,(section.entries||[]).findIndex(x=>x.id===entry.id))}
        onPointerDown={()=>{if(archiveView)return;clearTimeout(hold.current);hold.current=setTimeout(()=>openLink(section,entry),600)}}
        onPointerUp={()=>clearTimeout(hold.current)}
        onPointerCancel={()=>clearTimeout(hold.current)}
        onPointerMove={()=>clearTimeout(hold.current)}
        onBlur={()=>flushAll()}/>
       {entry.link&&<a className="closet-notes-link" href={entry.link} target="_blank" rel="noopener noreferrer" aria-label="링크 열기"><Link2 size={15}/></a>}
       <button type="button" className="closet-notes-archive-action" aria-label={archiveView?'아카이브 복원':'항목 아카이브'}
        onClick={()=>archiveView?updateEntry(section,entry.id,{archived:false},true):archive(section,entry)}>
        {archiveView?<ArchiveRestore size={16}/>:<Archive size={16}/>}
       </button>
      </div>)}
     </div>
     {!archiveView&&<button type="button" className="closet-notes-add" aria-label={section.title+' 항목 추가'} onClick={()=>addAt(section,(section.entries||[]).length)}><Plus size={18}/></button>}
    </div>;
   })}
  </div>
  {linkTarget&&<div className="closet-notes-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setLinkTarget(null)}}>
   <section className="closet-notes-modal" role="dialog" aria-modal="true" aria-labelledby="closet-notes-link-title">
    <div className="closet-notes-modal-head"><h2 id="closet-notes-link-title">링크</h2><button type="button" aria-label="닫기" onClick={()=>setLinkTarget(null)}><X size={20}/></button></div>
    <input autoFocus type="url" inputMode="url" aria-label="링크 주소" placeholder="https://" value={linkDraft} onChange={e=>setLinkDraft(e.target.value)}/>
    <div className="closet-notes-modal-actions"><button type="button" onClick={()=>setLinkTarget(null)}>취소</button><button type="button" onClick={saveLink}>저장</button></div>
   </section>
  </div>}
 </section>;
}
