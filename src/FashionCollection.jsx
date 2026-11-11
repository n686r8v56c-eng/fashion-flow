import React,{useEffect,useRef,useState} from 'react';
import {Plus,Trash2,ExternalLink,ImagePlus,Check,Pencil,Search,X} from 'lucide-react';
import './FashionCollection.css';

const DB='fashion-collection-v1',STORE='links';
function dbOpen(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function query(mode,fn){const db=await dbOpen();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode);const req=fn(tx.objectStore(STORE));tx.oncomplete=()=>resolve(req?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
const read=()=>query('readonly',s=>s.getAll());
const save=x=>query('readwrite',s=>s.put(x));
const remove=id=>query('readwrite',s=>s.delete(id));
const canonicalize=raw=>{try{
 const u=new URL(raw.trim());if(u.protocol!=='https:')return null;
 const h=u.hostname.toLowerCase().replace(/^(www\.|m\.)/,'');
 if(h==='youtube.com'||h==='youtu.be'){
  const id=h==='youtu.be'?u.pathname.split('/')[1]:u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1];
  if(!/^[\w-]{11}$/.test(id||''))return null;
  return {platform:'youtube',url:'https://www.youtube.com/watch?v='+id,id};
 }
 if(h==='instagram.com'){
  const m=u.pathname.match(/^\/(p|reel|tv)\/([a-zA-Z0-9_-]+)\/?/);
  if(!m)return null;
  return {platform:'instagram',url:'https://www.instagram.com/'+m[1]+'/'+m[2]+'/'};
 }
 return null;
}catch{return null}};
const thumbFor=(row)=>row.manualThumbnail||row.thumbnail||'';
const parseTags=text=>[...new Set(String(text||'').split(/[,\n#]+/).map(t=>t.trim().replace(/^#+/,'').slice(0,40)).filter(Boolean))].slice(0,20);
async function resize(file){
 if(!file.type.startsWith('image/'))throw Error('사진 파일만 올릴 수 있어.');
 if(file.size>15*1024*1024)throw Error('15MB 이하 사진을 선택해줘.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('사진을 읽지 못했어.'));img.src=url});
  const max=750,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.73));
  if(!blob)throw Error('사진 압축에 실패했어.');
  return blob;
 }finally{URL.revokeObjectURL(url)}
}
function CollectionCard({item,onUpdate,onDelete}){
 const [edit,setEdit]=useState(false),[title,setTitle]=useState(item.title||''),[editingTags,setEditingTags]=useState(false),[tagDraft,setTagDraft]=useState('');
 const [thumbFailed,setThumbFailed]=useState(false),fileRef=useRef(null);
 const [localUrl,setLocalUrl]=useState('');
 useEffect(()=>{if(!item.manualThumbnail){setLocalUrl('');return}const u=URL.createObjectURL(item.manualThumbnail);setLocalUrl(u);return()=>URL.revokeObjectURL(u)},[item.manualThumbnail]);
 useEffect(()=>{setTitle(item.title||'')},[item.title]);
 useEffect(()=>setThumbFailed(false),[item.thumbnail,item.manualThumbnail]);
 const thumbnail=item.manualThumbnail?localUrl:thumbFor(item);
 async function upload(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;try{await onUpdate(item,{manualThumbnail:await resize(file)})}catch(ex){alert(ex.message)}}
 async function changeTitle(){if(item.platform==='youtube'&&!title.trim())return;await onUpdate(item,{title:title.trim().slice(0,250)});setEdit(false)}
 async function addTags(){
  const next=parseTags(tagDraft);
  if(!next.length){setEditingTags(false);return}
  const existing=Array.isArray(item.tags)?item.tags:[];
  const merged=[...new Set([...existing,...next])].slice(0,20);
  await onUpdate(item,{tags:merged});
  setTagDraft('');setEditingTags(false);
 }
 async function deleteTag(tag){
  await onUpdate(item,{tags:(item.tags||[]).filter(x=>x!==tag)});
 }
 return <article className="collect-card">
  <div className="collect-item-main">
   <div className="collect-photo-wrap">
    {item.platform==='instagram'?<button className="collect-photo-trigger" type="button" aria-label="인스타그램 썸네일 사진 선택" onClick={()=>fileRef.current?.click()}>
      {thumbnail&&!thumbFailed?<img src={thumbnail} alt="" loading="lazy" onError={()=>setThumbFailed(true)}/>:<span className="collect-no-photo"><ImagePlus size={19}/> 사진 추가</span>}
      <span className="collect-photo-upload"><ImagePlus size={14}/></span>
    </button>:thumbnail&&!thumbFailed?<img src={thumbnail} alt="" loading="lazy" onError={()=>setThumbFailed(true)}/>:<span className="collect-no-photo"><ImagePlus size={19}/> 사진 없음</span>}
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload}/>
   </div>
   <div className="collect-info">
    <small>{item.platform==='youtube'?'YouTube':'Instagram'}</small>
    {edit?<div className="collect-title-edit"><input aria-label="수집 제목 수정" value={title} placeholder={item.platform==='instagram'?'인스타그램 제목 직접 입력':'영상 제목'} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();changeTitle()};if(e.key==='Escape'){setEdit(false);setTitle(item.title||'')}}} autoFocus/><button type="button" aria-label="제목 저장" onClick={changeTitle}><Check size={17}/></button></div>:<a href={item.url} target="_blank" rel="noopener noreferrer" className="collect-title">{item.title||(item.platform==='instagram'?'인스타그램 게시물 보기':'제목 입력 필요')} <ExternalLink size={13}/></a>}
    <span className="collect-url">{item.url}</span>
    <div className="collect-tags">
      {(item.tags||[]).map(tag=><span className="collect-tag-chip" key={tag}>#{tag}<button type="button" aria-label={tag+' 태그 삭제'} onClick={()=>deleteTag(tag)}>×</button></span>)}
      {!editingTags&&<button type="button" onClick={()=>{setTagDraft('');setEditingTags(true)}}><Plus size={14}/> 태그 추가</button>}
    </div>
    {editingTags&&<div className="collect-tags-edit">
      <input aria-label="태그 입력" value={tagDraft} placeholder="태그 입력 · 쉼표로 여러 개 가능" onChange={e=>setTagDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTags()};if(e.key==='Escape'){setEditingTags(false);setTagDraft('')}}} autoFocus/>
      <button type="button" onClick={addTags} aria-label="태그 추가 저장"><Check size={16}/> 추가</button>
      <button type="button" onClick={()=>{setEditingTags(false);setTagDraft('')}} aria-label="태그 추가 취소">취소</button>
    </div>}
    <div className="collect-actions">
     <button type="button" onClick={()=>{setEdit(!edit);setTitle(item.title||'')}}><Pencil size={14}/> 제목</button>
     <button type="button" onClick={()=>onDelete(item)}><Trash2 size={14}/> 삭제</button>
    </div>
   </div>
  </div>
 </article>
}
export default function FashionCollection({genre='fashion'}){
 const [url,setUrl]=useState(''),[search,setSearch]=useState(''),[items,setItems]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function reload(){setItems((await read()||[]).filter(x=>(x.genre||'fashion')===genre).sort((a,b)=>b.createdAt-a.createdAt))}
 useEffect(()=>{reload().catch(e=>setError('저장 기록을 읽지 못했어: '+e.message))},[]);
 async function add(e){
  e.preventDefault();setError('');setNotice('');
  const parsed=canonicalize(url);
  if(!parsed){setError('유튜브 영상 또는 인스타그램 게시물 링크를 입력해줘.');return}
  if(items.some(x=>x.url===parsed.url)){setError('이미 수집한 링크야.');return}
  setBusy(true);
  try{
   let info={};
   try{const res=await fetch('/api/collect-metadata?url='+encodeURIComponent(parsed.url));if(res.ok)info=await res.json()}catch{}
   const title=parsed.platform==='youtube'?String(info.title||'').trim().slice(0,250):'';
   const thumb=parsed.platform==='youtube'?'https://i.ytimg.com/vi/'+parsed.id+'/hqdefault.jpg':(String(info.thumbnail||'').startsWith('https://')?info.thumbnail:'');
   await save({id:crypto.randomUUID(),platform:parsed.platform,url:parsed.url,title,tags:[],thumbnail:thumb,genre,createdAt:Date.now()});
   await reload();setUrl('');
   setNotice(parsed.platform==='instagram'?'인스타그램 링크 수집 완료! 카드에서 제목과 태그를 추가할 수 있어.':title?'유튜브 수집 완료!':'유튜브 링크 수집 완료! 제목은 수정할 수 있어.');
  }catch(err){setError('수집 실패: '+err.message)}
  finally{setBusy(false)}
 }
 async function update(item,patch){try{await save({...item,...patch,updatedAt:Date.now()});await reload()}catch(err){setError('저장 실패: '+err.message)}}
 async function del(item){if(!confirm('이 수집 링크를 삭제할까?'))return;try{await remove(item.id);await reload()}catch(err){setError('삭제 실패: '+err.message)}}
 const keyword=search.trim().replace(/^#/,'').toLocaleLowerCase();
 const filtered=keyword?items.filter(item=>[item.title,item.url,item.platform,...(Array.isArray(item.tags)?item.tags:[])].some(value=>String(value||'').toLocaleLowerCase().includes(keyword))):items;
 return <section className="collect">
  <div className="collect-header"><h1>수집</h1><p>유튜브 · 인스타그램 링크를 모아두는 공간</p></div>
  <div className="collect-search"><Search size={18}/><input type="search" aria-label="수집 목록 검색" placeholder="제목 · 태그 · 링크 검색" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="검색어 지우기" onClick={()=>setSearch('')}><X size={17}/></button>}</div>
  <form className="collect-entry" onSubmit={add}>
   <div><input aria-label="수집할 URL" type="url" required placeholder="유튜브 또는 인스타그램 링크 붙여넣기" value={url} onChange={e=>setUrl(e.target.value)} /><button type="submit" disabled={busy}><Plus size={17}/>{busy?'불러오는 중':'수집'}</button></div>
  </form>
  {error&&<p className="collect-error" role="alert">{error}</p>}
  {notice&&<p className="collect-notice" role="status">{notice}</p>}
  <div className="collect-counter">수집한 링크 <strong>{keyword?filtered.length+' / '+items.length:items.length}개</strong></div>
  <div className="collect-list">{filtered.map(item=><CollectionCard key={item.id} item={item} onUpdate={update} onDelete={del}/>)}</div>
  {!items.length&&<p className="collect-empty">링크를 하나 붙여넣으면 여기에 쌓여 💜</p>}
  {items.length>0&&filtered.length===0&&<p className="collect-empty">검색 결과가 없어.</p>}
  <p className="collect-foot">YouTube 제목은 공개 정보를 사용하고, YouTube와 Instagram 모두 태그를 직접 붙일 수 있어. Instagram도 제목을 직접 입력할 수 있고 썸네일을 수동 등록할 수 있어. 수집 링크와 수동 사진은 이 기기의 IndexedDB에 저장돼.</p>
 </section>
}
