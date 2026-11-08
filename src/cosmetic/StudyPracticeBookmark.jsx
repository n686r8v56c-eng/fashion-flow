import React,{useEffect,useRef,useState} from 'react';
import {Plus,Trash2,Play,Check,BookmarkPlus} from 'lucide-react';
import './studyPractice.css';
const uid=()=>globalThis.crypto?.randomUUID?.()||String(Date.now()+Math.random());
export const youtubeId=value=>{
 try{
  const u=new URL(String(value||'').trim());
  const h=u.hostname.replace(/^www\./,'');
  if(h==='youtu.be')return u.pathname.split('/').filter(Boolean)[0]||'';
  if(['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(h)){
   return u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop()||'';
  }
 }catch{}
 return '';
};
const seconds=value=>{
 if(typeof value==='number')return value;
 const s=String(value??'').trim();
 if(/^\d+:\d{1,2}$/.test(s)){const [m,v]=s.split(':').map(Number);return m*60+v}
 if(/^\d+:\d{1,2}:\d{1,2}$/.test(s)){const [h,m,v]=s.split(':').map(Number);return h*3600+m*60+v}
 return s!==''&&Number.isFinite(Number(s))?Number(s):NaN;
};
const clock=n=>{n=Math.max(0,Math.floor(Number(n)||0));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
export function parseTimeMarkers(text){
 const items=[],errors=[];
 String(text||'').split(/\r?\n/).forEach((raw,i)=>{
  const line=raw.trim();if(!line)return;
  const m=line.match(/^[\[(]?((?:\d{1,3}:)?\d{1,2}:\d{2})[\])]?\s*(?:[-–—|]\s*)?(.+?)\s*$/);
  if(!m){errors.push(i+1);return}
  const parts=m[1].split(':').map(Number);
  if(parts.slice(1).some(x=>x>=60)){errors.push(i+1);return}
  const start=parts.reduce((a,v)=>a*60+v,0);
  items.push({start,label:m[2].trim()});
 });
 return {items,errors};
}
export const makeMarkers=items=>items.map(x=>({id:uid(),start:clock(x.start),end:clock(x.start+1),label:x.label,skillId:'',memo:'',caution:'',quickMarked:true}));
function Video({url,apiRef,onTime,onReady}){
 const holder=useRef(null);
 useEffect(()=>{
  const id=youtubeId(url);
  if(!id){apiRef.current=null;onReady(false);return}
  let player,disposed=false;
  const mount=()=>{
   if(disposed||!window.YT?.Player||!holder.current)return;
   player=new window.YT.Player(holder.current,{videoId:id,playerVars:{playsinline:1,rel:0},events:{onReady:e=>{apiRef.current=e.target;onReady(true)}}});
  };
  if(window.YT?.Player)mount();
  else{
   const previous=window.onYouTubeIframeAPIReady;
   window.onYouTubeIframeAPIReady=()=>{previous?.();mount()};
   if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';document.head.appendChild(script);
   }
  }
  return()=>{disposed=true;apiRef.current=null;onReady(false);try{player?.destroy()}catch{}};
 },[url]);
 useEffect(()=>{
  const timer=setInterval(()=>{try{const n=apiRef.current?.getCurrentTime?.();if(Number.isFinite(n))onTime(n)}catch{}},350);
  return()=>clearInterval(timer);
 },[onTime]);
 return <div className="muscle-study-video">{youtubeId(url)?<div ref={holder}/>:<div className="muscle-study-video-empty">유튜브 URL이 없는 타임마커 노트야.</div>}</div>;
}
function SkillPicker({skills,selectedId,onChoose,onCreate}){
 const selected=skills.find(x=>x.id===selectedId);
 const [area,SetArea]=useState(()=>selected?.area||'전체');
 const [muscle,SetMuscle]=useState(()=>selected?.muscle||'전체');
 const [adding,SetAdding]=useState(false),[newName,SetNewName]=useState('');
 const areas=[...new Set(skills.map(x=>x.area||'미분류'))].sort((a,b)=>a.localeCompare(b,'ko'));
 const byArea=skills.filter(x=>area==='전체'||(x.area||'미분류')===area);
 const muscles=[...new Set(byArea.map(x=>x.muscle||'미분류'))].sort((a,b)=>a.localeCompare(b,'ko'));
 const available=byArea.filter(x=>muscle==='전체'||(x.muscle||'미분류')===muscle);
 const create=()=>{
  const name=newName.trim();if(!name)return;
  const existing=skills.find(x=>x.name?.trim().toLocaleLowerCase()===name.toLocaleLowerCase());
  const id=existing?.id||onCreate?.(name);if(!id)return;
  SetArea(existing?.area||'미분류');SetMuscle(existing?.muscle||'전체');
  onChoose(id);SetAdding(false);SetNewName('');
 };
 return <div className="muscle-study-picker">
  <b>기술 연결</b>
  <div className="muscle-study-categories">
   <label>대분류<select value={area} onChange={e=>{SetArea(e.target.value);SetMuscle('전체')}}><option value="전체">전체</option>{areas.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   <label>소분류<select value={muscle} onChange={e=>SetMuscle(e.target.value)}><option value="전체">전체</option>{muscles.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
  </div>
  <select aria-label="연결할 기술" value={available.some(x=>x.id===selectedId)?selectedId:''} onChange={e=>onChoose(e.target.value)}>
   <option value="">기술 선택 ({available.length}개)</option>{available.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
  </select>
  {selected&&<small>연결됨 · {selected.name}{!selected.area||selected.area==='미분류'?' · 미분류':''}</small>}
  {!adding?<button className="muscle-study-create-link" type="button" onClick={()=>SetAdding(true)}><Plus size={13}/> 없으면 이름만 임시 등록</button>:
   <div className="muscle-study-create"><input autoFocus aria-label="새 기술 이름" placeholder="새 기술 이름" value={newName} onChange={e=>SetNewName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();create()}}}/><button type="button" disabled={!newName.trim()} onClick={create}>등록·연결</button><button type="button" onClick={()=>{SetAdding(false);SetNewName('')}}>취소</button></div>}
 </div>;
}
export default function StudyPracticeBookmark({bookmark,skills=[],history=[],onSave,onAutoSave,onEvaluate,onDelete,onClose,onCreateSkill}){
 const storageKey='muscle-study-draft-v1:'+bookmark.id;
 const restore=()=>{try{const data=JSON.parse(localStorage.getItem(storageKey)||'null');return data?.id===bookmark.id?data:null}catch{return null}};
 const [initial]=useState(restore);
 const [draft,SetDraft]=useState(()=>({...bookmark,...(initial?.draft||{}),segments:Array.isArray(initial?.draft?.segments)?initial.draft.segments:(bookmark.segments||[]).map(s=>({...s}))}));
 const [mode,Mode]=useState('study'),[active,Active]=useState(0),[time,Time]=useState(0),[ready,Ready]=useState(false),[status,Status]=useState(''),[practiceNote,PracticeNote]=useState(''),[busy,Busy]=useState(false);
 const apiRef=useRef(null),saveRef=useRef(onAutoSave),changed=useRef(false);
 const markers=draft.segments||[],selected=markers[Math.min(active,Math.max(0,markers.length-1))],skill=skills.find(x=>x.id===selected?.skillId);
 const historyForSkill=history.filter(h=>h.skillId===selected?.skillId).sort((a,b)=>new Date(b.at)-new Date(a.at));
 const set=value=>{changed.current=true;SetDraft(value)};
 const patchMarker=(markerId,change)=>set(old=>({...old,segments:old.segments.map(m=>m.id===markerId?{...m,...change}:m)}));
 const jump=t=>{try{const p=apiRef.current;if(p){p.seekTo(seconds(t),true);p.playVideo?.()}}catch{}};
 const addPoint=()=>{
  if(!ready)return alert('영상이 준비된 뒤 시점을 찍어 줘.');
  const n=Number(apiRef.current?.getCurrentTime?.());
  if(!Number.isFinite(n))return alert('현재 시간을 읽지 못했어.');
  const mark=makeMarkers([{start:Math.floor(n),label:''}])[0];
  set(old=>({...old,segments:[...(old.segments||[]),mark]}));Active(markers.length);
 };
 const finalize=()=>{
  if(!String(draft.title||'').trim())return {...draft,title:markers[0]?.label||'타임마커 노트'};
  return {...draft};
 };
 const save=async()=>{const result=finalize();if(result.url&&!youtubeId(result.url))return alert('유튜브 URL을 확인해 줘.');Busy(true);try{await onSave(result);try{localStorage.removeItem(storageKey)}catch{}}finally{Busy(false)}};
 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify({id:bookmark.id,draft}))}catch{}},[storageKey,draft]);
 saveRef.current=onAutoSave;
 useEffect(()=>{
  if(!changed.current||!saveRef.current||!markers.length)return;
  if(draft.url&&!youtubeId(draft.url))return;
  const timer=setTimeout(()=>saveRef.current(finalize()),750);
  return()=>clearTimeout(timer);
 },[draft]);
 useEffect(()=>{const flush=()=>{try{localStorage.setItem(storageKey,JSON.stringify({id:bookmark.id,draft}))}catch{}};window.addEventListener('pagehide',flush);return()=>window.removeEventListener('pagehide',flush)},[draft,storageKey]);
 return <div className="muscle-study-root">
  <div className="muscle-study-modes"><button type="button" className={mode==='study'?'selected':''} onClick={()=>Mode('study')}>스터디</button><button type="button" className={mode==='practice'?'selected':''} onClick={()=>{Mode('practice');Active(0);Status('')}}>연습</button></div>
  <div className="muscle-study-timeline" hidden={mode!=='practice'}>{markers.map((mark,i)=><button key={mark.id||i} type="button" className={i===active?'selected':''} onClick={()=>{Active(i);Status('');jump(mark.start)}}>{mark.start}</button>)}{!markers.length&&<small>스터디에서 타임마커를 등록해 줘.</small>}</div>
  <Video url={draft.url} apiRef={apiRef} onTime={Time} onReady={Ready}/>
  {mode==='study'?<>
   <div className="muscle-study-markers">
    <div className="muscle-study-markers-title"><b>타임마커</b><button type="button" disabled={!ready} onClick={addPoint}><BookmarkPlus size={14}/> 지금 시점 찍기 <small>{clock(time)}</small></button></div>
    {markers.map(mark=><div className="muscle-study-marker-card" key={mark.id}>
     <div className="muscle-study-marker-head"><button type="button" disabled={!ready} onClick={()=>jump(mark.start)}><Play size={13}/> {mark.start}</button><input placeholder="핵심 내용" aria-label="핵심 내용" value={mark.label||''} onChange={e=>patchMarker(mark.id,{label:e.target.value})}/><button type="button" aria-label="타임마커 삭제" onClick={()=>set(old=>({...old,segments:old.segments.filter(x=>x.id!==mark.id)}))}><Trash2 size={14}/></button></div>
     <SkillPicker key={mark.id} skills={skills} selectedId={mark.skillId||''} onChoose={id=>patchMarker(mark.id,{skillId:id})} onCreate={onCreateSkill}/>
     <textarea rows={2} aria-label="타임마커 메모" placeholder="메모 (선택)" value={mark.memo||mark.caution||''} onChange={e=>patchMarker(mark.id,{memo:e.target.value})}/>
    </div>)}
    {!markers.length&&<small>영상의 현재 시점을 찍거나 북마크 목록에서 목차를 일괄 등록할 수 있어.</small>}
   </div>
   <button className="muscle-study-save" type="button" disabled={busy} onClick={save}><Check size={15}/> 저장</button>
  </>:<>
   {selected&&<section className="muscle-study-selected"><b>{selected.label||'타임마커'} · {selected.start}</b>{skill&&<small>연결 기술 · {skill.name}</small>}<p>{selected.memo||selected.caution||'작성된 메모가 없어.'}</p></section>}
   <section className="muscle-study-practice">
    <label>현재 숙련도<select value={status||skill?.status||'미습득'} onChange={e=>Status(e.target.value)}>{['미습득','연습 중','습득 완료'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>이번 연습 평가 메모<textarea rows={3} value={practiceNote} onChange={e=>PracticeNote(e.target.value)} placeholder="느낀 점 · 잘한 점 · 다음 연습"/></label>
    <button type="button" className="muscle-study-evaluate" disabled={!skill} onClick={()=>{onEvaluate({skillId:skill.id,status:status||skill.status||'미습득',memo:practiceNote,source:'기술 북마크',bookmarkId:bookmark.id});PracticeNote('')}}><Check size={14}/> 평가·메모 기록</button>
    <b>이 기술의 평가 이력</b>{historyForSkill.length?historyForSkill.map((h,i)=><div className="muscle-study-history" key={h.id||i}><small>{new Date(h.at).toLocaleString('ko-KR')} · {h.status}</small><p>{h.memo||'메모 없음'}</p></div>):<small>아직 평가 기록이 없어.</small>}
   </section>
  </>}
 </div>;
}
