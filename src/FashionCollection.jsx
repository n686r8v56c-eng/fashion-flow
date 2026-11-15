import React,{useEffect,useRef,useState} from 'react';
import {Plus,Trash2,ExternalLink,ImagePlus,Check,Pencil,Search,X,LayoutGrid,List,ArchiveRestore,Archive,PencilLine} from 'lucide-react';
import './FashionCollection.css';
import {useLocalCollection} from './sync/LocalSync.jsx';

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
function CollectionCard({item,onUpdate,onDelete,viewMode='list',folders=[]}){
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
 if(viewMode==='gallery')return <article className="collect-gallery-tile">
  <a href={item.url} target="_blank" rel="noopener noreferrer" className="collect-gallery-link" aria-label={(item.title||'수집한 게시물')+' 열기'}>
   {thumbnail&&!thumbFailed?<img src={thumbnail} alt={item.title||'수집한 게시물 썸네일'} loading="lazy" onError={()=>setThumbFailed(true)}/>:<span className="collect-no-photo"><ImagePlus size={19}/> 사진 없음</span>}
  </a>
 </article>;
 return <article className={"collect-card"+(viewMode==="gallery"?" collect-card-gallery":"")}>
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
    <label className="video-folder-move">상위함
     <select aria-label="영상 상위함 이동" value={item.folderId||'all'} onChange={e=>onUpdate(item,{folderId:e.target.value==='all'?null:e.target.value})}>
      <option value="all">겨울 · 경량패딩</option>
      {folders.filter(folder=>folder.categoryId!=='video-default-'+(item.genre||'fashion')).map(folder=><option key={folder.id} value={folder.categoryId}>{(folder.season||'겨울')+' · '+folder.name}</option>)}
     </select>
    </label>
    <div className="collect-actions">
     <button type="button" onClick={()=>{setEdit(!edit);setTitle(item.title||'')}}><Pencil size={14}/> 제목</button>
     <button type="button" onClick={()=>onDelete(item)}><Trash2 size={14}/> 삭제</button>
    </div>
   </div>
  </div>
 </article>
}
export default function FashionCollection({genre='fashion'}){
 const {read,write:save,remove,subscribe}=useLocalCollection('collection');
 const [search,setSearch]=useState(''),[items,setItems]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [searchOpen,setSearchOpen]=useState(false);
 const [showArchived,setShowArchived]=useState(false);
 const [viewMode,setViewMode]=useState('gallery');
 const [categories,setCategories]=useState([]);
 const seasons=['겨울','봄','여름','가을'];
 const [season,setSeason]=useState('겨울');
 const defaultFolderId='video-default-'+genre;
 const [categoryId,setCategoryId]=useState(defaultFolderId);
 const [categoryMenu,setCategoryMenu]=useState(null);
 const [categoryDraft,setCategoryDraft]=useState('');
 const categoryTimer=useRef(null),categoryLongPress=useRef(false);
 const categoryRows=categories.filter(c=>!c.hidden&&(c.season||'겨울')===season).sort((a,b)=>(a.position||0)-(b.position||0));
 const allVisibleFolders=categories.filter(c=>!c.hidden);
 const archivedItems=items.filter(x=>!!x.archivedAt);
 const categoryName=id=>categories.find(c=>c.categoryId===id)?.name||(id===defaultFolderId?'경량패딩':'영상함');
 async function persistCategory(record){await save(record);await reload()}
 async function createCategory(){
  const number=Math.max(0,...categories.map(c=>Number(String(c.name||'').match(/^함(\d+)$/)?.[1])||0))+1;
  const id='video-folder-'+crypto.randomUUID();
  try{await persistCategory({id,type:'video-folder',genre,categoryId:id,name:'함'+number,position:categoryRows.length,season,hidden:false,createdAt:Date.now()});setCategoryId(id)}
  catch(e){setError('상위함 추가 실패: '+e.message)}
 }
 function startCategoryPress(id){clearTimeout(categoryTimer.current);categoryLongPress.current=false;categoryTimer.current=setTimeout(()=>{categoryLongPress.current=true;setCategoryMenu(id);setCategoryDraft(categoryName(id))},550)}
 function stopCategoryPress(){clearTimeout(categoryTimer.current)}
 async function renameCategory(){
  const name=categoryDraft.trim();if(!name)return;
  const row=categories.find(c=>c.categoryId===categoryMenu);if(!row)return;
  try{await persistCategory({...row,name,updatedAt:Date.now()});setCategoryMenu(null)}
  catch(e){setError('이름 편집 실패: '+e.message)}
 }
 async function hideCategory(){
  const row=categories.find(c=>c.categoryId===categoryMenu);if(!row)return;
  if(!confirm('이 상위함을 숨길까? 저장된 영상은 삭제되지 않고 전체에서 계속 볼 수 있어.'))return;
  try{await persistCategory({...row,hidden:true,updatedAt:Date.now()});setCategoryId(defaultFolderId);setCategoryMenu(null)}
  catch(e){setError('상위함 삭제 실패: '+e.message)}
 }
 async function restoreCategory(id){
  const row=categories.find(c=>c.categoryId===id);if(!row)return;
  try{await persistCategory({...row,hidden:false,updatedAt:Date.now()});setCategoryId(id);setCategoryMenu(null)}
  catch(e){setError('상위함 복원 실패: '+e.message)}
 }
 async function reload(){
  const rows=await read()||[];
  const belongs=x=>(genre==='closet'?['fashion','closet'].includes(x.genre||'fashion'):(x.genre||'fashion')===genre);
  const folders=rows.filter(x=>x.type==='video-folder'&&x.genre===genre);
  if(!folders.some(x=>x.categoryId===defaultFolderId)){
   await save({id:defaultFolderId,type:'video-folder',genre,categoryId:defaultFolderId,name:'경량패딩',position:-1,season:'겨울',hidden:false,createdAt:Date.now()});
   return;
  }
  setCategories(folders);
  setItems(rows.filter(x=>x.type!=='video-folder'&&belongs(x)).sort((a,b)=>b.createdAt-a.createdAt));
 }
 useEffect(()=>{const refresh=()=>reload().catch(e=>setError('저장 기록을 읽지 못했어: '+e.message));refresh();return subscribe(refresh)},[read,genre,subscribe]);
 async function addFromClipboard(){
  if(busy)return;
  setError('');setNotice('');
  let clipboardText='';
  try{
   if(!navigator.clipboard?.readText)throw Error('clipboard unavailable');
   clipboardText=await navigator.clipboard.readText();
  }catch{
   setError('클립보드 읽기가 허용되지 않았어. 브라우저에서 붙여넣기 권한을 허용한 뒤 다시 눌러줘.');
   return;
  }
  const parsed=canonicalize(clipboardText);
  if(!parsed){setError('유튜브 영상 또는 인스타그램 게시물 링크를 입력해줘.');return}
  if(items.some(x=>x.url===parsed.url)){setError('이미 수집한 링크야.');return}
  setBusy(true);
  try{
   let info={};
   try{const res=await fetch('/api/collect-metadata?url='+encodeURIComponent(parsed.url));if(res.ok)info=await res.json()}catch{}
   const title=parsed.platform==='youtube'?String(info.title||'').trim().slice(0,250):'';
   const thumb=parsed.platform==='youtube'?'https://i.ytimg.com/vi/'+parsed.id+'/hqdefault.jpg':(String(info.thumbnail||'').startsWith('https://')?info.thumbnail:'');
   await save({id:crypto.randomUUID(),platform:parsed.platform,url:parsed.url,title,tags:[],thumbnail:thumb,genre,folderId:categoryId||defaultFolderId,createdAt:Date.now()});
   await reload();
   setNotice(parsed.platform==='instagram'?'인스타그램 링크 수집 완료! 카드에서 제목과 태그를 추가할 수 있어.':title?'유튜브 수집 완료!':'유튜브 링크 수집 완료! 제목은 수정할 수 있어.');
  }catch(err){setError('수집 실패: '+err.message)}
  finally{setBusy(false)}
 }
 async function update(item,patch){try{await save({...item,...patch,updatedAt:Date.now()});await reload()}catch(err){setError('저장 실패: '+err.message)}}
 async function archiveFolder(){
  if(!categoryId)return;
  const folderItems=items.filter(item=>!item.archivedAt&&(item.folderId||defaultFolderId)===categoryId);
  if(!folderItems.length){setNotice('아카이브할 영상이 없어.');return}
  if(!confirm(categoryName(categoryId)+' 영상 '+folderItems.length+'개를 아카이브할까? 나중에 복원할 수 있어.'))return;
  setBusy(true);setError('');
  try{
   const archivedAt=new Date().toISOString();
   for(const item of folderItems)await save({...item,archivedAt,updatedAt:Date.now()});
   await reload();setNotice(folderItems.length+'개 영상을 보관했어.');
  }catch(e){setError('아카이브 실패: '+e.message)}
  finally{setBusy(false)}
 }
 async function restoreClip(item){await update(item,{archivedAt:null})}
 async function del(item){if(!confirm('이 수집 링크를 삭제할까?'))return;try{await remove(item.id);await reload()}catch(err){setError('삭제 실패: '+err.message)}}
 const keyword=search.trim().replace(/^#/,'').toLocaleLowerCase();
 const scoped=items.filter(item=>!item.archivedAt&&(item.folderId||defaultFolderId)===categoryId);
 const filtered=keyword?scoped.filter(item=>[item.title,item.url,item.platform,...(Array.isArray(item.tags)?item.tags:[])].some(value=>String(value||'').toLocaleLowerCase().includes(keyword))):scoped;
 return <section className="collect">
  <div className="collect-header">
   <div className="collect-title-row">
    <h1>영상</h1>
    <button type="button" className="collect-search-trigger" onClick={()=>setSearchOpen(true)} aria-label="수집 목록 검색 열기" aria-haspopup="dialog"><Search size={22}/>{search&&<span className="collect-search-indicator" aria-hidden="true"/>}</button>
    <button type="button" className={'video-archive-shortcut'+(showArchived?' active':'')} onClick={()=>setShowArchived(v=>!v)} aria-label={showArchived?'영상 목록으로 돌아가기':'아카이브 '+archivedItems.length+'개 보기'} aria-pressed={showArchived}><Archive size={19}/><span>({archivedItems.length})</span></button>
   </div>
  </div>
  {!showArchived&&<><div className="video-season-row" role="tablist" aria-label="영상 계절 분류">
   {seasons.map(value=><button key={value} type="button" role="tab" aria-selected={season===value} className={'video-season-tab'+(season===value?' active':'')} onClick={()=>{
    setSeason(value);
    const first=categories.filter(c=>!c.hidden&&(c.season||'겨울')===value).sort((a,b)=>(a.position||0)-(b.position||0))[0];
    setCategoryId(first?.categoryId||null);
   }}>{value}</button>)}
  </div>
  <div className="video-folder-row" role="tablist" aria-label="영상 상위함">
   {categoryRows.map(c=><button key={c.id} type="button" role="tab" aria-selected={categoryId===c.categoryId} className={'video-folder-tab'+(categoryId===c.categoryId?' active':'')}
    onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;startCategoryPress(c.categoryId)}}
    onPointerUp={stopCategoryPress} onPointerCancel={stopCategoryPress} onPointerLeave={stopCategoryPress} onPointerMove={stopCategoryPress}
    onContextMenu={e=>{e.preventDefault();stopCategoryPress();setCategoryDraft(c.name);setCategoryMenu(c.categoryId)}}
    onClick={()=>{if(categoryLongPress.current){categoryLongPress.current=false;return}setCategoryId(c.categoryId)}} title="길게 눌러 편집·삭제">{c.name}</button>)}
   {categoryId&&<button type="button" className="video-folder-archive" aria-label={categoryName(categoryId)+' 영상 아카이브'} title="현재 함 영상 아카이브" disabled={busy} onClick={archiveFolder}><Archive size={19}/></button>}
   <button type="button" className="video-folder-plus" aria-label="상위함 추가" onClick={createCategory}><Plus size={20}/></button>
   {categories.some(c=>c.hidden)&&<button type="button" className="video-folder-restore" onClick={()=>setCategoryMenu('restore')}>숨긴 함 복원</button>}
  </div>
  </>}
  {error&&<p className="collect-error" role="alert">{error}</p>}
  {notice&&<p className="collect-notice" role="status">{notice}</p>}
  {!showArchived?<><div className="collect-toolbar">
   <span className="collect-count" aria-hidden="true"></span>
   <div className="collect-toolbar-actions">
    <div className="collect-view-toggle" role="group" aria-label="보기 방식">
     <button type="button" className={viewMode==='gallery'?'active':''} aria-label="갤러리 보기" aria-pressed={viewMode==='gallery'} onClick={()=>setViewMode('gallery')}><LayoutGrid size={19}/></button>
     <button type="button" className={viewMode==='list'?'active':''} aria-label="목록 보기" aria-pressed={viewMode==='list'} onClick={()=>setViewMode('list')}><List size={19}/></button>
    </div>
    <button type="button" className="collect-clipboard-add" aria-label="클립보드 링크 바로 수집" title="클립보드 링크 수집" disabled={busy} onClick={addFromClipboard}><Plus size={21}/></button>
   </div>
  </div>
  <div className={viewMode==='gallery'?'collect-grid':'collect-list'}>{filtered.map(item=><CollectionCard key={item.id} item={item} onUpdate={update} onDelete={del} viewMode={viewMode} folders={allVisibleFolders}/>)}</div>
  {!items.length&&<p className="collect-empty">링크를 하나 붙여넣으면 여기에 쌓여 💜</p>}
  {items.length>0&&filtered.length===0&&<p className="collect-empty">{keyword?'검색 결과가 없어.':'이 함에 수집한 영상이 없어.'}</p>}
  </>:<div className="video-archive-list">
    {archivedItems.length===0?<p className="collect-empty">아카이브된 영상이 없어.</p>:archivedItems.map(item=><article className="video-archive-item" key={item.id}>
     <span>{item.title||item.url}</span>
     <button type="button" onClick={()=>restoreClip(item)}><ArchiveRestore size={17}/> 복원</button>
    </article>)}
   </div>}
  {categoryMenu&&<div className="collect-search-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setCategoryMenu(null)}}>
   <div className="collect-search-modal video-folder-dialog" role="dialog" aria-modal="true" aria-label="영상 상위함 편집">
    <div className="collect-search-modal-head"><strong>{categoryMenu==='restore'?'숨긴 상위함 복원':categoryName(categoryMenu)}</strong><button type="button" onClick={()=>setCategoryMenu(null)} aria-label="닫기"><X size={20}/></button></div>
    {categoryMenu==='restore'?categories.filter(c=>c.hidden).map(c=><button type="button" key={c.id} onClick={()=>restoreCategory(c.categoryId)}><ArchiveRestore size={17}/>{c.name} 복원</button>):<>
     <form onSubmit={e=>{e.preventDefault();renameCategory()}}><input aria-label="상위함 이름" maxLength={40} value={categoryDraft} onChange={e=>setCategoryDraft(e.target.value)}/><button type="submit"><Check size={17}/> 이름 저장</button></form>
     <button type="button" onClick={hideCategory}><Trash2 size={17}/> 상위함 삭제</button>
    </>}
   </div>
  </div>}
  {searchOpen&&<div className="collect-search-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSearchOpen(false)}}>
   <div className="collect-search-modal" role="dialog" aria-modal="true" aria-label="수집 검색">
    <div className="collect-search-modal-head"><strong>검색</strong><button type="button" aria-label="검색 닫기" onClick={()=>setSearchOpen(false)}><X size={20}/></button></div>
    <div className="collect-search"><Search size={18}/><input autoFocus type="search" aria-label="제목 태그 링크 검색" placeholder="제목 · 태그 · 링크 검색" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false)}}/>{search&&<button type="button" aria-label="검색어 지우기" onClick={()=>setSearch('')}><X size={17}/></button>}</div>
    <div className="collect-search-footer"><button type="button" onClick={()=>setSearchOpen(false)}>결과 보기 ({filtered.length}개)</button></div>
   </div>
  </div>}
 </section>
}
