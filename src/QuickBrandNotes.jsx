import React,{useEffect,useRef,useState} from 'react';
import {filterQuickBrandNotes,isQuickBrandNote,noteTags,quickBrandTags,tagKey,prepareQuickBrandBatch,quickTitleKey} from './quickBrandUtils.js';
const notesForEdit=(records,id)=>records.filter(r=>r.id!==id);
export default function QuickBrandNotes({records=[],saveRecord}){
 const [input,setInput]=useState(''),[filter,setFilter]=useState(''),[query,setQuery]=useState(''),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[editing,setEditing]=useState(null),[showAll,setShowAll]=useState(false);
 const field=useRef(null),lock=useRef(false),recentSaved=useRef(new Set()),acknowledged=useRef(new Set());
 const [progress,setProgress]=useState({done:0,total:0});
 useEffect(()=>{const keys=new Set(records.filter(isQuickBrandNote).map(r=>quickTitleKey(r.title)));acknowledged.current=keys;for(const key of recentSaved.current)if(keys.has(key))recentSaved.current.delete(key)},[records]);
 const notes=records.filter(isQuickBrandNote),visible=filterQuickBrandNotes(records,filter,query),batch=prepareQuickBrandBatch(input,editing?notesForEdit(records,editing):records,recentSaved.current);
 const preview=batch.pending;
 const index=new Map();for(const r of notes)for(const tag of new Map(noteTags(r).map(t=>[tagKey(t),t])).values()){const key=tagKey(tag);if(!index.has(key))index.set(key,{tag,count:0});index.get(key).count++}
 const tags=[...index.values()].sort((a,b)=>b.count-a.count||a.tag.localeCompare(b.tag,'ko'));
 function select(tag){setFilter(tag);setQuery('');setMessage('')}
 async function submit(e){
  e.preventDefault();if(lock.current||!input.trim())return;setError('');setMessage('');
  const plan=prepareQuickBrandBatch(input,editing?notesForEdit(records,editing):records,recentSaved.current);
  if(editing&&plan.lines.length!==1){setError('기존 기록 수정은 한 상품만 가능해요. 여러 상품은 수정 취소 후 새로 등록해 주세요.');return}
  if(plan.errors.length){setError(plan.errors.join(' '));return}
  if(!plan.pending.length){setMessage('모두 이미 등록된 문구예요. 중복 상품은 추가하지 않았어요.');return}
  lock.current=true;setSaving(true);setProgress({done:0,total:plan.pending.length});let done=0;
  try{
   for(const item of plan.pending){
    const prior=editing?notes.find(r=>r.id===editing):null;
    const ok=await saveRecord('research',item.title,{...(prior?.payload||{}),recordType:'quick-brand-note',tags:item.tags,verification:'미확인'},editing);
    if(!ok)throw Error('저장하지 못했어요.');
    if(!acknowledged.current.has(item.key))recentSaved.current.add(item.key);
    done++;setProgress({done,total:plan.pending.length});
   }
   setInput('');setEditing(null);setFilter('');setQuery('');setMessage((editing?'수정 완료':done+'개 상품 등록 완료')+(plan.duplicates.length?' · 중복 '+plan.duplicates.length+'개 제외':'')+'.');
  }catch(e){setInput(plan.pending.slice(done).map(item=>item.title).join('\n'));setError((done?done+'개 저장 완료 · ':'')+'남은 '+(plan.pending.length-done)+'개는 입력창에 남겨뒀어요. 다시 저장해 주세요. '+e.message)}
  finally{lock.current=false;setSaving(false)}
 }

 function edit(r){setInput(r.title);setEditing(r.id);setError('');setMessage('');field.current?.focus()}
 return <div className="quickBrandNotes"><section className="panel"><div className="sectionHead"><h3>{editing?'빠른 기록 수정':'빠른 입력'}</h3><span className="sub">{notes.length}개 기록</span></div><form className="quickNoteForm quickNoteBatchForm" onSubmit={submit}><label className="field"><span className="srOnly">빠른 기록 문구</span><textarea ref={field} value={input} disabled={saving} maxLength={100000} rows={editing?2:4} aria-label="빠른 기록 문구" placeholder={'한소희 경량패딩 에어플로우\n차정원 신발 에샤페\n김나영 코트'} onChange={e=>setInput(e.target.value)}/></label><div className="sectionHead"><span className="sub" aria-live="polite">{batch.lines.length}개 상품{batch.duplicates.length?' · 중복 '+batch.duplicates.length+'개 제외':''}</span><button className="primary" disabled={saving||!input.trim()||!batch.pending.length}>{saving?'저장 중 '+progress.done+'/'+progress.total:editing?'수정 저장':batch.pending.length+'개 등록'}</button></div></form>{preview.length>0&&<div className="quickBatchPreview" aria-label="상품별 태그 미리보기">{preview.slice(0,3).map((item,i)=><div className="quickTagRow" key={item.key}><span className="quickPreviewNumber">{i+1}번</span>{item.tags.map(t=><span className="quickTagPreview" key={tagKey(t)}>#{t}</span>)}</div>)}{preview.length>3&&<p className="hint">외 {preview.length-3}개 상품</p>}</div>}<p className="hint">한 줄 = 한 상품 · Enter로 줄바꿈 · 빈 줄은 제외해요. 한 줄 안의 단어는 태그로 저장돼요.</p>{editing&&<button type="button" className="light" disabled={saving} onClick={()=>{setEditing(null);setInput('');setError('')}}>수정 취소</button>}{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="sub" role="status">{message}</p>}</section>
 <section className="panel"><label className="field"><span>기록 검색</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="스타 · 상품 · 키워드 검색"/></label><div className="quickTagRow"><button className={'chip '+(!filter?'selected':'')} aria-pressed={!filter} onClick={()=>{setFilter('');setQuery('')}}>전체 {notes.length}</button>{(showAll?tags:tags.slice(0,12)).map(({tag,count})=><button type="button" className={'chip '+(tagKey(filter)===tagKey(tag)?'selected':'')} aria-pressed={tagKey(filter)===tagKey(tag)} key={tagKey(tag)} onClick={()=>select(tag)}>#{tag} <small>{count}</small></button>)}</div>{tags.length>12&&<button className="light small" onClick={()=>setShowAll(v=>!v)}>{showAll?'태그 접기':'모든 태그 보기 ('+tags.length+')'}</button>}{filter&&<div className="sectionHead"><strong className="releaseBrand">#{filter} · {visible.length}개</strong><button className="light small" onClick={()=>{setFilter('');setQuery('')}}>필터 해제</button></div>}<p className="sub">태그를 누르면 그 단어가 붙은 기록만 보여요.</p></section>
 <div className="quickNoteList">{visible.map(r=><article className="panel quickNote" key={r.id}><div className="sectionHead"><span className="tagUnverified">빠른 메모 · 미확인</span><button type="button" className="light small" onClick={()=>edit(r)} disabled={saving}>수정</button></div><strong className="quickNoteTitle">{r.title}</strong><div className="quickTagRow">{noteTags(r).map(t=><button type="button" className={'chip '+(tagKey(filter)===tagKey(t)?'selected':'')} aria-pressed={tagKey(filter)===tagKey(t)} key={tagKey(t)} onClick={()=>select(t)}>#{t}</button>)}</div>{(r.created_at||r.updated_at)&&<time className="hint">{new Date(r.created_at||r.updated_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</time>}</article>)}</div>{!visible.length&&<div className="empty">{notes.length?'조건에 맞는 기록이 없어요.':'떠오른 스타·상품·키워드를 위 입력창에 빠르게 남겨보세요.'}</div>}
 </div>
}
