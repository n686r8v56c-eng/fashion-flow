import React,{useMemo,useState} from 'react';
import {Copy,ExternalLink} from 'lucide-react';
import './FashionLearningNotes.css';
const ytId=url=>{try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return u.pathname.split('/')[1]||'';if(u.hostname.includes('youtube.com')||u.hostname.includes('youtube-nocookie.com'))return u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop()||''}catch{}return ''};
const seconds=v=>{const p=String(v||'').split(':').map(Number);return p.length===2&&p.every(Number.isFinite)?Math.max(0,p[0]*60+p[1]):0};
const videoLink=(url,start)=>{const id=ytId(url);return id?'https://www.youtube.com/watch?v='+id+'&t='+seconds(start)+'s':''};
export default function FashionLearningNotes({skills=[],videos=[],notes=[],photos={},urls={},query='',onEdit}){
 const [season,S]=useState('전체'),[color,C]=useState('전체'),[skillId,I]=useState('전체'),[type,T]=useState('전체'),[copied,P]=useState('');
 const skillOptions=skills.filter(s=>(season==='전체'||s.season===season)&&(color==='전체'||s.color===color));
 const entries=useMemo(()=>{
  const result=[];
  for(const s of skills){
   const base={skillId:s.id,skill:s.name,season:s.season||'',color:s.color||'',item:s.item||'',photo:photos[s.id]||urls[s.reference_id]||''};
   if(s.memo?.trim())result.push({...base,type:'기술 메모',content:s.memo});
   for(const h of s.statusHistory||[])if(h.note?.trim())result.push({...base,type:'연습 메모',content:h.note,date:h.at});
   for(const v of videos)for(const c of v.clips||[]){
    if(!(c.skillIds||[]).includes(s.id)&&c.moveId!==s.id&&c.skillId!==s.id)continue;
    const meta={...base,bookmarkTitle:v.title,start:c.start,end:c.end,youtubeUrl:videoLink(v.url,c.start)};
    if(c.caution?.trim())result.push({...meta,type:'주의할 점',content:c.caution});
    if(c.memo?.trim())result.push({...meta,type:'구간 메모',content:c.memo});
   }
  }
  for(const n of notes){
   const s=skills.find(x=>x.id===n.skillId);
   result.push({id:n.id,skillId:n.skillId||'',skill:s?.name||n.title||'자유 메모',season:s?.season||'',color:s?.color||'',item:s?.item||'',photo:s?(photos[s.id]||urls[s.reference_id]||''):'',type:'자유 메모',content:n.memo||'',title:n.title});
  }
  return result;
 },[skills,videos,notes,photos,urls]);
 const shown=entries.filter(n=>(season==='전체'||n.season===season)&&(color==='전체'||n.color===color)&&(skillId==='전체'||n.skillId===skillId)&&(type==='전체'||n.type===type)&&[n.skill,n.content,n.title,n.bookmarkTitle,n.color,n.item].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const copyAll=async()=>{if(!shown.length)return;const value=shown.map(n=>String(n.content||'').trim()).filter(Boolean).join('\n\n');try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
  else{const t=document.createElement('textarea');t.value=value;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();if(!ok)throw Error('copy failed')}
  P('메모 '+shown.length+'개 복사됨');
 }catch{P('복사 권한을 확인해 줘.')}};
 return <div className="fl-learning-notes">
  <div className="fl-note-filters">
   <select aria-label="계절" value={season} onChange={e=>{S(e.target.value);I('전체')}}><option value="전체">전체 계절</option>{[...new Set(skills.map(s=>s.season).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</select>
   <select aria-label="컬러" value={color} onChange={e=>{C(e.target.value);I('전체')}}><option value="전체">전체 컬러</option>{[...new Set(skills.filter(s=>season==='전체'||s.season===season).map(s=>s.color).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</select>
   <select aria-label="기술" value={skillId} onChange={e=>I(e.target.value)}><option value="전체">전체 기술</option>{skillOptions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
   <select aria-label="메모 유형" value={type} onChange={e=>T(e.target.value)}>{['전체','기술 메모','주의할 점','구간 메모','연습 메모','자유 메모'].map(x=><option key={x}>{x}</option>)}</select>
  </div>
  <div className="fl-note-title"><b>학습 노트 {shown.length}개</b><button type="button" disabled={!shown.length} onClick={copyAll}><Copy size={14}/> 전체 복사</button></div>
  {copied&&<small className="fl-note-feedback" role="status">{copied}</small>}
  <div className="fl-note-list">{shown.map((n,i)=><article className="fl-note-entry" key={(n.id||n.skillId||'note')+'-'+i}>
   {n.photo&&<img src={n.photo} alt="" loading="lazy"/>}
   <div className="fl-note-info">{n.id?<button type="button" className="fl-note-edit-title" onClick={()=>onEdit?.(notes.find(m=>m.id===n.id))} title="자유 메모 편집">{n.skill}</button>:<strong>{n.skill}</strong>}<small>{[n.season,n.color,n.item,n.type].filter(Boolean).join(' · ')}</small>
   {n.bookmarkTitle&&<small>{n.bookmarkTitle} · {n.start}–{n.end}</small>}
   {n.date&&<small>{new Date(n.date).toLocaleDateString('ko-KR')}</small>}
   <div className="fl-note-content"><p>{n.content}</p>
   {n.youtubeUrl&&<a href={n.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="원본 유튜브 구간 열기" title="유튜브 구간 열기"><ExternalLink size={15}/></a>}
   
   </div></div>
  </article>)}</div>
  {!shown.length&&<p className="fl-note-empty">선택한 조건에 해당하는 메모가 없어.</p>}
 </div>;
}
