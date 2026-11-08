import React,{useMemo,useState} from 'react';
import {Copy,ExternalLink} from 'lucide-react';
import './LearningNotes.css';
const videoId=url=>{try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return u.pathname.split('/')[1]||'';if(u.hostname.includes('youtube.com')||u.hostname.includes('youtube-nocookie.com'))return u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop()||''}catch{}return ''};
const timestamp=v=>{const a=String(v||'').split(':').map(Number);return a.length===2&&a.every(Number.isFinite)?Math.max(0,a[0]*60+a[1]):0};
const sourceUrl=(url,start)=>{const id=videoId(url);return id?'https://www.youtube.com/watch?v='+id+'&t='+timestamp(start)+'s':''};
export default function LearningNotes({skills=[],bookmarks=[],evaluations=[],kind='skill'}){
 const [major,setMajor]=useState('전체'),[minor,setMinor]=useState('전체'),[skillId,setSkillId]=useState('전체'),[noteType,setNoteType]=useState('전체'),[query,setQuery]=useState('');
 const majors=[...new Set(skills.map(s=>s.category).filter(Boolean))];
 const minorOptions=[...new Set(skills.filter(s=>major==='전체'||s.category===major).map(s=>s.subcategory).filter(Boolean))];
 const matching=skills.filter(s=>(major==='전체'||s.category===major)&&(minor==='전체'||s.subcategory===minor)&&(skillId==='전체'||s.id===skillId));
 const entries=useMemo(()=>matching.flatMap(skill=>{
   const photo=skill.photo||skill.images?.[0]?.url||skill.images?.[0]?.src||skill.photos?.find(p=>p.primary)?.url||skill.photos?.[0]?.url||skill.photos?.[0]?.src||null;
   const basic={skillId:skill.id,skill:skill.name,category:skill.category||'',subcategory:skill.subcategory||'',representativePhoto:photo};
   const caution=bookmarks.flatMap(b=>(b.segments||b.clips||[]).filter(c=>(c.skillId||c.moveId)===skill.id&&c.caution?.trim()).map(c=>({...basic,type:'주의할 점',content:c.caution,bookmarkTitle:b.title||'',bookmarkId:b.id,start:c.start,end:c.end,at:null,youtubeUrl:sourceUrl(b.url,c.start)})));
   const reviews=evaluations.filter(h=>h.skillId===skill.id&&h.memo?.trim()||h.skillId===skill.id&&h.note?.trim()).map(h=>({...basic,type:'연습 메모',content:h.memo||h.note,at:h.at||null,status:h.status||'',source:h.source||'',bookmarkId:h.bookmarkId||null}));
   return [...caution,...reviews]
 }),[matching,bookmarks,evaluations]);
 const shown=entries.filter(x=>(noteType==='전체'||x.type===noteType)&&[x.skill,x.category,x.subcategory,x.content,x.bookmarkTitle].join(' ').toLowerCase().includes(query.toLowerCase()));
 const [copied,setCopied]=useState('');
 const copyAll=async()=>{
  if(!shown.length)return;
  const content=shown.map(n=>String(n.content||'').trim()).filter(Boolean).join('\n\n');
  try{
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(content);
   else{const t=document.createElement('textarea');t.value=content;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();if(!ok)throw Error('복사 실패')}
   setCopied('메모 '+shown.length+'개 복사됨');
  }catch{setCopied('복사 권한을 확인해 줘.')}
 };
 return <div className="learning-notes">
  <div className="learning-notes-filters">
  <select aria-label="대분류" value={major} onChange={e=>{setMajor(e.target.value);setMinor('전체');setSkillId('전체')}}><option value="전체">전체 대분류</option>{majors.map(x=><option key={x} value={x}>{x}</option>)}</select>
  <select aria-label="소분류" value={minor} onChange={e=>{setMinor(e.target.value);setSkillId('전체')}}><option value="전체">전체 소분류</option>{minorOptions.map(x=><option key={x} value={x}>{x}</option>)}</select>
  <select aria-label="기술" value={skillId} onChange={e=>setSkillId(e.target.value)}><option value="전체">전체 기술</option>{skills.filter(s=>(major==='전체'||s.category===major)&&(minor==='전체'||s.subcategory===minor)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
  <select aria-label="메모 종류" value={noteType} onChange={e=>setNoteType(e.target.value)}><option>전체</option><option>주의할 점</option><option>연습 메모</option></select>
  </div>
  <input className="learning-notes-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="기술·메모 내용 검색"/>
  <div className="learning-notes-header"><b>학습 노트 {shown.length}개</b><button type="button" disabled={!shown.length} onClick={copyAll}><Copy size={14}/> 전체 복사</button></div>{copied&&<small className="learning-notes-feedback" role="status">{copied}</small>}
  {shown.map((n,i)=><div className="learning-notes-entry" key={n.type+'-'+n.skillId+'-'+i}>{n.representativePhoto&&<img src={n.representativePhoto} alt="" loading="lazy"/>}<div><b>{n.skill}</b><small>{n.category} · {n.subcategory} · {n.type}</small>{n.bookmarkTitle&&<small>{n.bookmarkTitle} · {n.start}–{n.end}</small>}{n.at&&<small>{new Date(n.at).toLocaleDateString('ko-KR')} · {n.status||''}</small>}<div className="learning-notes-copyrow"><p>{n.content}</p>{n.youtubeUrl&&<a className="learning-notes-video" href={n.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label={n.skill+" 원본 유튜브 구간 열기"} title="유튜브 구간 열기"><ExternalLink size={15}/></a>}</div></div></div>)}
  {!shown.length&&<p className="learning-notes-empty">선택한 조건에 해당하는 메모가 없어.</p>}
 </div>
}