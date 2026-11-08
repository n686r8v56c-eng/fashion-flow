import React,{useMemo,useState} from 'react';
import {Plus,ChevronDown,ChevronRight,Search,Pencil,Bookmark,ImagePlus} from 'lucide-react';
import {CosmeticImg} from './cosmeticMedia.jsx';
const fallbackCats=['베이스','눈썹','아이섀도','아이라인','속눈썹','윤곽','립','피니싱'];
const titleOf=s=>s.name||s.en||'이름 없음';
const imageOf=s=>s.photos?.find(p=>p.primary)?.url||s.photos?.[0]?.url||s.image||'';
const linkedTo=(b,id)=>b.skillId===id||(b.skillIds||[]).includes(id)||(b.segments||[]).some(x=>x.skillId===id||(x.skillIds||[]).includes(id));
export default function CosmeticTechniqueLibrary({skills=[],bookmarks=[],categories=fallbackCats,onAdd,onEdit,onVideos,onStatus}){
 const [search,setSearch]=useState('');
 const [opened,setOpened]=useState([]);
 const [expanded,setExpanded]=useState([]);
 const [tagFilter,setTagFilter]=useState('');
 const [showAll,setShowAll]=useState(false);
 const sections=useMemo(()=>[...new Set([...categories,...skills.map(s=>s.category).filter(Boolean)])],[categories,skills]);
 const text=search.trim().toLocaleLowerCase();
 const getTags=s=>[...(Array.isArray(s.tags)?s.tags:[]),s.subcategory].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
 const visible=s=>(!text||[titleOf(s),s.en,s.category,s.subcategory,s.memo,s.description,s.posture,...getTags(s)].filter(Boolean).join(' ').toLocaleLowerCase().includes(text))&&(!tagFilter||getTags(s).includes(tagFilter));
 const total=skills.filter(visible).length;
 const toggle=(setter,key)=>setter(a=>a.includes(key)?a.filter(x=>x!==key):[...a,key]);
 const status=s=>s.status||(s.mastered?'습득 완료':'연습 중');
 return <section className="ctl">
  <div className="ctl-heading"><h2>기술 라이브러리</h2><button className="ctl-primary" onClick={onAdd}><Plus size={15}/> 새 기술</button></div>
  <div className="ctl-search"><Search size={17}/><input type="search" placeholder="기술명 · 대분류 · 태그 검색" value={search} onChange={e=>{setSearch(e.target.value);setOpened([])}}/></div>
  <div className="ctl-toolbar"><span>전체 {skills.length}개 · 검색 {total}개</span><button onClick={()=>setShowAll(v=>!v)}>{showAll?'모두 접기':'모두 펼치기'}</button></div>
  {tagFilter&&<button className="ctl-tag-selected" onClick={()=>setTagFilter('')}>태그: {tagFilter} ×</button>}
  {sections.map((category,index)=>{const rows=skills.filter(s=>s.category===category&&visible(s));if(text&&!rows.length)return null;const expandedSection=showAll||opened.includes(category)||Boolean(text);return <div className="ctl-section" key={category}>
   <button className="ctl-section-head" onClick={()=>toggle(setOpened,category)} aria-expanded={expandedSection}>
    <span className="ctl-count">{String(index+1).padStart(2,'0')}</span><strong>{category}</strong><small>{rows.length}개</small>{expandedSection?<ChevronDown size={18}/>:<ChevronRight size={18}/>}
   </button>
   {expandedSection&&<div className="ctl-section-body">{rows.map(s=>{const isExpanded=expanded.includes(s.id);const refs=bookmarks.filter(b=>linkedTo(b,s.id));const tags=getTags(s);return <article className="ctl-item" key={s.id}>
    <button className="ctl-item-head" onClick={()=>toggle(setExpanded,s.id)} aria-expanded={isExpanded}>
     {imageOf(s)?<CosmeticImg className="ctl-thumb" value={imageOf(s)} alt=""/>:<span className="ctl-empty-img"><ImagePlus size={17}/></span>}
     <span className="ctl-item-name"><b>{titleOf(s)}</b><small>{s.subcategory||'소분류 미지정'} · {status(s)}</small></span>{isExpanded?<ChevronDown size={17}/>:<ChevronRight size={17}/>}
    </button>
    {isExpanded&&<div className="ctl-detail">
     {imageOf(s)&&<CosmeticImg className="ctl-photo" value={imageOf(s)} alt={titleOf(s)}/>}
     {s.en&&<p><b>영문명</b> {s.en}</p>}
     {s.description&&<p><b>설명</b> {s.description}</p>}
     {s.memo&&<p><b>노트</b> {s.memo}</p>}
     <div className="ctl-tags">{tags.map(t=><button key={t} className={tagFilter===t?'selected':''} onClick={()=>setTagFilter(tagFilter===t?'':t)}>{t}</button>)}</div>
     <label className="ctl-status">숙련도 <select value={status(s)} onChange={e=>onStatus(s.id,e.target.value)}>{['미습득','연습 중','습득 완료'].map(x=><option key={x}>{x}</option>)}</select></label>
     <div className="ctl-actions"><button onClick={()=>onEdit(s)}><Pencil size={15}/> 수정 · 사진</button><button onClick={()=>onVideos(s)}><Bookmark size={15}/> 영상 {refs.length}개</button></div>
    </div>}
   </article>})}{!rows.length&&<div className="ctl-none">등록된 기술이 없어.</div>}</div>}
  </div>})}
 </section>;
}
