import React,{useEffect,useRef,useState} from 'react';
import {Play,Pause,Repeat,Plus,Trash2,Check} from 'lucide-react';
const uid=()=>crypto.randomUUID();
const getYoutubeId=url=>{try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return u.pathname.slice(1).split('/')[0];if(u.hostname.includes('youtube.com'))return u.searchParams.get('v')||u.pathname.split('/').pop()}catch{}return ''};
import './fashion-bookmark-studio.css';
const parse=s=>{const m=String(s||'').match(/^(\d+):([0-5]\d)$/);return m?Number(m[1])*60+Number(m[2]):NaN};
const fmt=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(Math.floor(n%60)).padStart(2,'0');
const levels=['미습득','연습 중','습득 완료'];
function Player({id,ready,onState}){
 const mount=useRef(null);useEffect(()=>{if(!id)return;let player=null,disposed=false;const create=()=>{if(disposed||!window.YT?.Player||!mount.current)return;player=new window.YT.Player(mount.current,{videoId:id,playerVars:{playsinline:1,rel:0},events:{onReady:e=>ready(e.target),onStateChange:e=>onState(e.data)}})};
 if(window.YT?.Player)create();else{const prev=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{prev?.();create()};if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s)}}
 return()=>{disposed=true;ready(null);try{player?.destroy()}catch{}}},[id]);return <div className="ref-video">{id?<div ref={mount}/>:<p>유튜브 링크를 등록하면 여기서 영상이 재생돼.</p>}</div>
}
export default function FashionBookmarkStudio({item,skills,onSave,onDelete,onUpdateMove,notify}){
 const [v,setV]=useState(()=>({id:uid(),title:'',url:'',memo:'',clips:[],...item,clips:(item?.clips||[]).map(c=>({...c,moveId:c.moveId||c.skillIds?.[0]||''}))}));
 const [mode,setMode]=useState(item?'practice':'edit'),[index,setIndex]=useState(0),[repeat,setRepeat]=useState(true),[playing,setPlaying]=useState(false);
 const [time,setTime]=useState(0),[ready,setReady]=useState(false);
 const [zoomed,setZoomed]=useState(false);
 const [reviewStatus,setReviewStatus]=useState(''),[reviewNote,setReviewNote]=useState('');
 const [titleLoading,setTitleLoading]=useState(false),[titleNotice,setTitleNotice]=useState('');
 const titleEdited=useRef(Boolean(item?.title)),lastUrl=useRef(item?.url||'');
 const p=useRef(null),player=useRef(null);
 const clips=v.clips||[],clip=clips[index],videoId=getYoutubeId(v.url);
 const activeClip=mode==='practice'&&playing?clips.find(c=>Number.isFinite(parse(c.start))&&Number.isFinite(parse(c.end))&&time>=parse(c.start)&&time<parse(c.end)):null;
 const change=(key,value)=>{if(key==='title')titleEdited.current=true;if(key==='url'&&value!==lastUrl.current){titleEdited.current=false;lastUrl.current=value}setV(x=>({...x,[key]:value}))};
 useEffect(()=>{
   const id=getYoutubeId(v.url);
   if(!id){setTitleNotice('');setTitleLoading(false);return}
   const ctrl=new AbortController();
   const timer=setTimeout(async()=>{
     setTitleLoading(true);setTitleNotice('');
     try{
       const res=await fetch('https://noembed.com/embed?url='+encodeURIComponent('https://www.youtube.com/watch?v='+id),{signal:ctrl.signal});
       if(!res.ok)throw Error('lookup failed');
       const info=await res.json();
       if(!info.title||info.error)throw Error('missing title');
       setV(old=>old.url===v.url&&!titleEdited.current?{...old,title:info.title}:old);
       setTitleNotice('유튜브 제목 조회 완료 · 직접 수정 가능');
     }catch(err){if(err.name!=='AbortError')setTitleNotice('제목을 가져오지 못했어. 직접 입력해 줘.')}
     finally{if(!ctrl.signal.aborted)setTitleLoading(false)}
   },450);
   return()=>{clearTimeout(timer);ctrl.abort()};
 },[v.url]);
 const update=(key,value)=>change('clips',clips.map((c,i)=>i===index?{...c,[key]:value}:c));
 const seek=(seconds,play=true)=>{if(!Number.isFinite(seconds)||!player.current)return;player.current.seekTo(seconds,true);if(play)player.current.playVideo()};
 useEffect(()=>{if(!ready)return;const timer=setInterval(()=>{try{const t=player.current?.getCurrentTime?.()||0;setTime(t);if(mode==='practice'&&playing&&repeat&&clip){const a=parse(clip.start),b=parse(clip.end);if(Number.isFinite(a)&&Number.isFinite(b)&&b>a&&t>=b-.12)player.current.seekTo(a,true)}}catch{}},200);return()=>clearInterval(timer)},[ready,mode,playing,repeat,index,v.clips]);
 const pick=i=>{setIndex(i);setReviewStatus('');setReviewNote('');seek(parse(clips[i]?.start),true)};
 const save=()=>{if(!v.title.trim())return notify('영상 제목을 입력해 줘.');if(!videoId)return notify('유효한 유튜브 영상 링크를 입력해 줘.');if(clips.some(c=>!skills.some(m=>m.id===c.moveId)||!Number.isFinite(parse(c.start))||!Number.isFinite(parse(c.end))||parse(c.end)<=parse(c.start)))return notify('구간의 연결 기술과 시작·종료 시간을 확인해 줘.');onSave({...v,clips:v.clips.map(c=>({...c,skillIds:c.moveId?[c.moveId]:[]}))})};
 return <div className="ref-studio">
  <div className="ref-switch"><button type="button" className={mode==='practice'?'on':''} onClick={()=>setMode('practice')}>연습 모드</button><button type="button" className={mode==='edit'?'on':''} onClick={()=>setMode('edit')}>편집 모드</button></div>
  <div className={zoomed?'ref-video-shell zoomed':'ref-video-shell'}><Player id={videoId} ready={target=>{player.current=target;setReady(Boolean(target))}} onState={state=>setPlaying(state===1)}/>{activeClip?.caution?.trim()&&<div className="ref-video-caution" role="status"><strong>주의할 점</strong><span>{activeClip.caution}</span></div>}</div>
  {<div className="ref-zoom-bar"><button type="button" className={zoomed?'active':''} aria-pressed={zoomed} onClick={()=>setZoomed(z=>!z)}>{zoomed?'원본 화면':'영상 확대'}</button><small>{zoomed?'가장자리가 잘릴 수 있어. 원본 화면으로 돌아갈 수 있어.':'검은 여백이 있는 영상은 확대해서 볼 수 있어.'}</small></div>}
  <div className="ref-heading"><strong>연결 기술 · 영상 구간</strong>{mode==='edit'&&<button type="button" onClick={()=>{change('clips',[...clips,{id:uid(),moveId:skills.find(m=>true)?.id||'',start:fmt(time),end:fmt(time+10)}]);setIndex(clips.length)}}><Plus size={14}/> 구간 추가</button>}</div>
  {clips.length>0&&<div className="ref-tabs">{clips.map((c,i)=><button type="button" key={c.id||i} className={i===index?'chosen':''} onClick={()=>pick(i)}>{skills.find(m=>m.id===c.moveId)?.name||'기술 선택'}<small>{c.start}–{c.end}</small></button>)}</div>}
  {!clips.length&&<p className="ref-hint">편집 모드에서 영상 속 기술 구간을 추가해 줘. 한 영상에 여러 기술을 연결할 수 있어.</p>}
  {clip&&(mode==='edit'?<div className="ref-fields">
   <label>연결할 기술<select value={clip.moveId||''} onChange={e=>update('moveId',e.target.value)}><option value="">기술 선택</option>{skills.map(m=><option key={m.id} value={m.id}>{{m.name}</option>)}</select></label>
   <div className="ref-two"><label>시작 (mm:ss)<input value={clip.start} onChange={e=>update('start',e.target.value)}/></label><label>종료 (mm:ss)<input value={clip.end} onChange={e=>update('end',e.target.value)}/></label></div>
   <div className="ref-two"><button type="button" onClick={()=>update('start',fmt(time))}>현재 위치 → 시작</button><button type="button" onClick={()=>update('end',fmt(time))}>현재 위치 → 종료</button></div>
   <label>주의할 점<textarea rows="3" value={clip.caution||''} onChange={e=>update('caution',e.target.value)} placeholder="이 구간에서 주의할 자세나 기술 포인트"/></label>
   <button type="button" className="ref-remove" onClick={()=>{change('clips',clips.filter((_,i)=>i!==index));setIndex(Math.max(0,index-1))}}><Trash2 size={13}/> 이 구간 삭제</button>
  </div>:<div className="ref-practice">
   <strong>{skills.find(m=>m.id===clip.moveId)?.name||'삭제된 기술'}</strong><small>{clip.start} – {clip.end}</small>
   <div className="ref-two"><button type="button" disabled={!ready} onClick={()=>seek(parse(clip.start))}><Play size={14}/> 구간 재생</button><button type="button" className={repeat?'selected':''} onClick={()=>setRepeat(x=>!x)}><Repeat size={14}/> 반복 {repeat?'ON':'OFF'}</button></div>
   <label>기술 숙련도<select value={reviewStatus||skills.find(m=>m.id===clip.moveId)?.status||'미습득'} onChange={e=>setReviewStatus(e.target.value)}>{levels.map(x=><option key={x}>{x}</option>)}</select></label><label>이번 연습 평가 메모<textarea rows="3" value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="어려운 점 · 잘한 점 · 다음에 연습할 부분"/></label><button type="button" className="secondary" onClick={()=>{onUpdateMove(clip.moveId,reviewStatus||skills.find(m=>m.id===clip.moveId)?.status||'미습득',reviewNote,v.id);setReviewNote('');setReviewStatus('')}}><Check size={14}/> 평가·메모 기록</button>
   <small>숙련도는 기술 라이브러리와 같은 값을 사용해.</small>
   {skills.find(m=>m.id===clip.moveId)?.lastEvaluatedAt&&<small>마지막 평가: {new Date(skills.find(m=>m.id===clip.moveId).lastEvaluatedAt).toLocaleDateString('ko-KR')}</small>}
   {(skills.find(m=>m.id===clip.moveId)?.statusHistory||[]).length>0&&<div className="ref-evaluation-history"><strong>평가 이력</strong>{[...(skills.find(m=>m.id===clip.moveId).statusHistory||[])].reverse().slice(0,10).map(h=><div key={h.id} className="skill-note-entry"><small>{new Date(h.at).toLocaleDateString('ko-KR')} · {h.status} · {h.source}</small>{h.note&&<p>{h.note}</p>}</div>)}</div>}
  </div>)}
  {mode==='edit'&&<div className="ref-fields">
   <label>유튜브 URL<input type="url" value={v.url} onChange={e=>change('url',e.target.value)}/></label>
   <label>영상 제목<input value={v.title} onChange={e=>change('title',e.target.value)} placeholder={titleLoading?'영상 제목 조회 중…':'영상 제목 자동 입력'}/></label>
   {(titleLoading||titleNotice)&&<small className="ref-hint">{titleLoading?'유튜브 제목을 확인하는 중…':titleNotice}</small>}
  </div>}
  <button className="primary" type="button" onClick={save}><Check size={15}/> 저장</button>
  {item&&mode==='edit'&&<button type="button" className="danger-text" onClick={onDelete}><Trash2 size={14}/> 북마크 삭제</button>}
 </div>
}