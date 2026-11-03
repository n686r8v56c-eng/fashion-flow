import React,{useState,useEffect,useRef} from 'react';
import {Plus,X,Pencil,Trash2,Search,Play,BookOpen,Copy,Download,ExternalLink,Bookmark,Check,ImagePlus,Layers} from 'lucide-react';
import {supabase,uploadPhoto,photoUrl} from './supabase';
import StudyPracticeBookmark,{parseTimeMarkers,makeMarkers,youtubeId} from './StudyPracticeBookmark';
import FashionLearningNotes from './FashionLearningNotes';
const uid=()=>crypto.randomUUID(),SEASONS=['사계절','봄','여름','가을','겨울'],STATUS=['미습득','연습 중','습득 완료'];
const empty=()=>({skills:[],videos:[],notes:[]});
const seconds=v=>{const a=String(v||'0').split(':').map(Number);return a.length===2?a[0]*60+a[1]:Math.max(0,Number(v)||0)};
const stamp=s=>{s=Math.max(0,Math.floor(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const ytId=url=>{try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return u.pathname.slice(1).split('/')[0];if(u.hostname.includes('youtube.com'))return u.searchParams.get('v')||u.pathname.split('/').pop()}catch{}return ''};
const copy=text=>navigator.clipboard?.writeText(text).catch(()=>{});
export default function FashionLearning({references,urls,userId,onRefresh,onUse,inventory=[],inventoryUrls={},onPractice}){
 const [state,setState]=useState(empty),[tab,setTab]=useState('videos'),[bulkText,setBulkText]=useState(''),[bulkNotice,setBulkNotice]=useState(''),[linkedSkill,setLinkedSkill]=useState(null),[search,setSearch]=useState(''),[season,setSeason]=useState('전체'),[color,setColor]=useState('전체'),[item,setItem]=useState('전체'),[editing,setEditing]=useState(null),[guide,setGuide]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[photos,setPhotos]=useState({}),[upload,setUpload]=useState(null),[playing,setPlaying]=useState(false),[selectedClip,setSelectedClip]=useState(0),[availability,setAvailability]=useState('전체'),[itemSearch,setItemSearch]=useState('');
 useEffect(()=>{let active=true;setLoading(true);supabase.from('fashion_learning_data').select('payload').eq('user_id',userId).maybeSingle().then(({data,error})=>{if(!active)return;if(error)setError('학습 데이터 테이블 설정 필요: supabase-fashion-learning.sql');else {setState({...empty(),...(data?.payload||{})});setError('')}setLoading(false)}).catch(e=>{if(active){setError(e.message);setLoading(false)}});return()=>{active=false}},[userId]);
 useEffect(()=>{let active=true;Promise.all(state.skills.filter(s=>s.image_path).map(async s=>[s.id,await photoUrl(s.image_path)])).then(a=>{if(active)setPhotos(Object.fromEntries(a))});return()=>{active=false}},[state.skills]);
 const stateRef=useRef(state);stateRef.current=state;
 async function commit(next){stateRef.current=next;setState(next);const {error}=await supabase.from('fashion_learning_data').upsert({user_id:userId,payload:next,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error){setError(error.message);alert('저장 실패: '+error.message)}else setError('')}
 const toStudio=video=>({...video,segments:(video.clips||[]).map(c=>({...c,skillId:c.moveId||c.skillId||c.skillIds?.[0]||'',label:c.label||''}))});
 const fromStudio=video=>{const {segments,...other}=video;return {...other,clips:(segments||[]).map(c=>({...c,moveId:c.skillId||'',skillIds:c.skillId?[c.skillId]:[]}))}};
 const storeVideo=async video=>{
  const value=fromStudio(video),next=structuredClone(stateRef.current);
  const i=next.videos.findIndex(x=>x.id===value.id);
  if(i<0)next.videos.push(value);else next.videos[i]=value;
  await commit(next);
 };
 const createStudySkill=name=>{
  const clean=String(name||'').trim();if(!clean)return '';
  const existing=stateRef.current.skills.find(x=>x.name?.trim().toLocaleLowerCase()===clean.toLocaleLowerCase());
  if(existing)return existing.id;
  const id=uid(),next=structuredClone(stateRef.current);
  next.skills.push({id,name:clean,season:'미분류',item:'',color:'',occasion:'',status:'미습득',memo:'',image_path:'',reference_id:'',inventoryIds:[],createdFrom:'bookmark-study'});
  commit(next).catch(e=>alert(e.message));return id;
 };
 const importBulkBookmarks=async()=>{
  const lines=bulkText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const urls=lines.filter(x=>/^https?:\/\/\S+$/i.test(x));
  if(urls.length>1)return setBulkNotice('유튜브 URL은 하나만 넣어 줘.');
  const url=urls[0]||'';
  if(url&&!youtubeId(url))return setBulkNotice('유효한 유튜브 URL을 입력해 줘.');
  const {items,errors}=parseTimeMarkers(lines.filter(x=>x!==url).join('\n'));
  if(errors.length)return setBulkNotice('목차 형식 오류: '+errors.join(', ')+'번째 줄');
  if(!url&&!items.length)return setBulkNotice('URL 또는 목차를 입력해 줘.');
  if(items.some((x,i)=>i>0&&x.start<=items[i-1].start))return setBulkNotice('목차는 시각 순서대로 넣어 줘.');
  if(url&&stateRef.current.videos.some(v=>youtubeId(v.url)===youtubeId(url))&&!confirm('이미 등록된 영상이야. 별도로 북마크할까?'))return;
  const id=uid(),title=url?'유튜브 영상 · '+youtubeId(url):(items[0]?.label||'타임마커 노트');
  await storeVideo({id,title,url,segments:makeMarkers(items)});
  setBulkText('');setBulkNotice('북마크 1개 · 타임마커 '+items.length+'개 등록 완료');
  if(url)fetch('https://noembed.com/embed?url='+encodeURIComponent('https://www.youtube.com/watch?v='+youtubeId(url))).then(r=>r.json()).then(meta=>{
   if(meta.title&&!meta.error){
    const next=structuredClone(stateRef.current),v=next.videos.find(x=>x.id===id);
    if(v&&v.title===title){v.title=meta.title;commit(next).catch(()=>{})}
   }
  }).catch(()=>{});
 };
 const start=(kind,x)=>{setUpload(null);setGuide(false);setPlaying(false);setSelectedClip(0);setItemSearch('');setEditing({kind,data:x?structuredClone(x):kind==='skills'?{id:uid(),name:'',season:'사계절',color:'',item:'',occasion:'',status:'미습득',memo:'',image_path:'',reference_id:'',inventoryIds:[]}:kind==='videos'?{id:uid(),title:'',url:'',clips:[]}: {id:uid(),title:'',skillId:'',memo:'',at:new Date().toISOString()}})};
 const edit=(k,v)=>setEditing(old=>({...old,data:{...old.data,[k]:v}}));
 const save=async()=>{if(!editing?.data)return;const {kind}=editing;let x={...editing.data};if(!(x.name||x.title)?.trim())return alert('이름을 입력해 줘.');try{if(kind==='skills'&&upload){const path=await uploadPhoto(upload,userId);x.image_path=path}const next=structuredClone(state),i=next[kind].findIndex(v=>v.id===x.id);if(i<0)next[kind].push(x);else next[kind][i]=x;await commit(next);setEditing(null)}catch(e){alert(e.message)}};
 const remove=async(kind,id)=>{if(!confirm('삭제할까요?'))return;const next=structuredClone(state);next[kind]=next[kind].filter(v=>v.id!==id);await commit(next);setEditing(null)};
 const addClip=()=>edit('clips',[...(editing.data.clips||[]),{id:uid(),start:'00:00',end:'00:30',skillIds:[],caution:'',memo:''}]);
 const patchClip=(id,key,value)=>edit('clips',editing.data.clips.map(c=>c.id===id?{...c,[key]:value}:c));
 const removeClip=id=>edit('clips',editing.data.clips.filter(c=>c.id!==id));
 const chooseCategory=(cat,value)=>{edit(cat,value);setGuide(false)};
 const linkedItems=skill=>(skill.inventoryIds||[]).map(id=>inventory.find(i=>i.id===id)).filter(Boolean);
 const isReady=skill=>linkedItems(skill).length>0;
 const suggested=skill=>inventory.filter(i=>{const color=(skill.color||'').trim().toLowerCase(),kind=(skill.item||'').trim().toLowerCase();if(!color&&!kind)return false;const itemText=[i.title,i.category,i.subcategory,i.style,i.notes].filter(Boolean).join(' ').toLowerCase(),colorText=[i.color,i.title].filter(Boolean).join(' ').toLowerCase();return (!color||colorText.includes(color))&&(!kind||itemText.includes(kind))});
 const toggleInventory=id=>edit('inventoryIds',(editing.data.inventoryIds||[]).includes(id)?editing.data.inventoryIds.filter(x=>x!==id):[...(editing.data.inventoryIds||[]),id]);
 const filtered=state.skills.filter(s=>(availability==='전체'||(availability==='연습 가능'?isReady(s):!isReady(s)))&&(season==='전체'||s.season===season)&&(color==='전체'||s.color===color)&&(item==='전체'||s.item===item)&&[s.name,s.occasion,s.memo,s.season,s.color,s.item].join(' ').toLowerCase().includes(search.toLowerCase()));
 const opts=k=>['전체',...new Set(state.skills.map(x=>x[k]).filter(Boolean))];
 const getSkill=id=>state.skills.find(s=>s.id===id);
 const linked=skillId=>state.videos.flatMap(v=>(v.clips||[]).filter(c=>c.skillIds?.includes(skillId)).map(c=>({...c,video:v})));
 const videosForSkill=skillId=>state.videos.filter(v=>(v.clips||[]).some(c=>(c.skillIds||[]).includes(skillId)));
 const showLinkedVideos=skill=>{setLinkedSkill(skill.id);setSearch('');setTab('videos');setEditing(null)};
 const exportJson=()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='fashion-learning.json';a.click();URL.revokeObjectURL(url)};
 const media=(url,start=0,end=null)=>{const id=ytId(url);return id?'https://www.youtube-nocookie.com/embed/'+id+'?start='+seconds(start)+(end?'&end='+seconds(end):'')+'&autoplay=1':null};
 const seedGuide={season:SEASONS,color:['블랙','화이트','그레이','베이지','브라운','네이비','레드','블루','핑크','퍼플'],item:['목도리','코트','니트','셔츠','청바지','스커트','원피스','부츠','가방','모자','액세서리']};
 return <div className="fashion-learn">
 <div className="fl-tabs">{[['videos','북마크'],['skills','기술'],['notes','학습 노트']].map(([id,name])=><button key={id} className={tab===id?'active':''} onClick={()=>{setTab(id);setLinkedSkill(null);setSearch('')}}>{name} ({state[id].length})</button>)}</div>
 <div className="fl-heading"><h2>{tab==='skills'?'코디 기술 라이브러리':tab==='videos'?'영상 북마크':'학습 노트'}</h2><div>{tab!=='notes'&&<button className="fl-icon" title="JSON 다운로드" onClick={exportJson}><Download size={16}/></button>}<button className="primary" onClick={()=>start(tab)}><Plus size={15}/> 추가</button></div></div>
 {error&&<p className="fl-alert">{error}</p>}{loading&&<p className="muted">학습 데이터 불러오는 중…</p>}
 {tab==='videos'&&<div className="fashion-bulk-import"><b>영상 URL · 타임스탬프 한 번에 등록</b><textarea rows={4} value={bulkText} onChange={e=>{setBulkText(e.target.value);setBulkNotice('')}} placeholder={'https://www.youtube.com/watch?v=XXXXXXXXXXX\n00:00 도입\n01:03 코디 설명\n04:03 실전 활용'}/><div className="fashion-bulk-footer"><small>URL만 · 목차만 · 둘 다 등록 가능</small><button type="button" disabled={!bulkText.trim()} onClick={importBulkBookmarks}><Plus size={14}/> 한 번에 등록</button></div>{bulkNotice&&<small role="status">{bulkNotice}</small>}</div>}
 {tab==='videos'&&linkedSkill&&<div className="linked-bookmark-filter"><span>{getSkill(linkedSkill)?.name||'선택한 기술'} · 연결 영상 {videosForSkill(linkedSkill).length}개</span><button type="button" onClick={()=>{setLinkedSkill(null);setSearch('')}}>전체 보기 ×</button></div>}
 <div className="fl-search"><Search size={15}/><input placeholder="기술·메모 검색" value={search} onChange={e=>setSearch(e.target.value)}/></div>
 {tab==='skills'&&<div className="fl-ready-filter"><button className={availability==='전체'?'active':''} onClick={()=>setAvailability('전체')}>전체</button><button className={availability==='연습 가능'?'active':''} onClick={()=>setAvailability('연습 가능')}>연습 가능</button><button className={availability==='아이템 없음'?'active':''} onClick={()=>setAvailability('아이템 없음')}>아이템 없음</button></div>}{tab==='skills'&&<div className="fl-filters"><select value={season} onChange={e=>setSeason(e.target.value)}>{['전체',...SEASONS].map(x=><option key={x}>{x}</option>)}</select><select value={color} onChange={e=>setColor(e.target.value)}>{opts('color').map(x=><option key={x}>{x}</option>)}</select><select value={item} onChange={e=>setItem(e.target.value)}>{opts('item').map(x=><option key={x}>{x}</option>)}</select></div>}
 <div className="fl-list">
 {tab==='skills'&&filtered.map(s=><div className="fl-row" key={s.id}><button className="fl-thumbnail" onClick={()=>start('skills',s)}>{photos[s.id]||urls[s.reference_id]?<img src={photos[s.id]||urls[s.reference_id]}/>:<BookOpen size={18}/>}</button><button className="fl-rowtext" onClick={()=>start('skills',s)}><b>{s.name}</b><small>{[s.season,s.color,s.item,s.status].filter(Boolean).join(' · ')} · {isReady(s)?'연습 가능':'아이템 없음'}</small></button><button type="button" className="linked-bookmark-btn" title="연결된 영상 북마크 보기" onClick={()=>showLinkedVideos(s)}><Bookmark size={14}/>{videosForSkill(s.id).length}</button><button className="fl-icon" onClick={()=>start('skills',s)}><Pencil size={15}/></button></div>)}
 {tab==='videos'&&state.videos.filter(v=>(!linkedSkill||videosForSkill(linkedSkill).some(b=>b.id===v.id))&&[v.title,v.url,...(v.clips||[]).map(x=>x.memo)].join(' ').toLowerCase().includes(search.toLowerCase())).map(v=><div className="fl-row" key={v.id}><button className="fl-thumbnail" onClick={()=>start('videos',v)}>{ytId(v.url)?<img src={'https://img.youtube.com/vi/'+ytId(v.url)+'/mqdefault.jpg'}/>:<Bookmark size={17}/>}</button><button className="fl-rowtext" onClick={()=>start('videos',v)}><b>{v.title}</b><small>연결 구간 {(v.clips||[]).length}개 · {[...new Set((v.clips||[]).flatMap(c=>c.skillIds||[]))].length}개 기술</small></button><button className="fl-icon" onClick={()=>start('videos',v)}><Pencil size={15}/></button></div>)}
 
 </div>
 {tab==='notes'&&<FashionLearningNotes skills={state.skills} videos={state.videos} notes={state.notes} photos={photos} urls={urls} query={search} onEdit={n=>n&&start('notes',n)}/>}
 {tab==='skills'&&references.length>0&&<div className="fl-legacy"><h3>기존 활용 레퍼런스 ({references.length})</h3>{references.map(r=><div className="fl-row" key={r.id}><button className="fl-thumbnail">{urls[r.id]&&<img src={urls[r.id]}/>}</button><button className="fl-rowtext" onClick={()=>start('skills',{id:uid(),name:r.title,season:r.season,color:r.main_color,item:r.main_item,occasion:r.occasion,status:'미습득',memo:r.notes||'',reference_id:r.id})}><b>{r.title}</b><small>기술로 가져오기 · {r.season} · {r.main_color} · {r.main_item}</small></button><button className="fl-icon" onClick={()=>onUse(r)} title="코디 참고"><Layers size={15}/></button></div>)}</div>}
 {editing&&<div className="fl-veil" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null)}}><section className="fl-modal"><div className="fl-modalhead"><b>{editing.kind==='skills'?'코디 기술':editing.kind==='videos'?'영상 북마크':'학습 노트'} 편집</b><button onClick={()=>setEditing(null)}><X size={18}/></button></div>
 {editing.kind==='skills'?<>
 <label>기술 이름<input value={editing.data.name} onChange={e=>edit('name',e.target.value)} placeholder="예: 겨울 회색 목도리 코디"/></label>
 <div className="fl-guidehead"><b>분류</b><button onClick={()=>setGuide(!guide)}><BookOpen size={14}/> 분류 가이드</button></div>
 {guide&&<div className="fl-guide">{Object.entries(seedGuide).map(([key,arr])=><div key={key}><b>{key==='season'?'계절':key==='color'?'주요 컬러':'주요 아이템'}</b><div className="fl-chips">{arr.map(x=><button onClick={()=>chooseCategory(key,x)} key={x}>{x}</button>)}</div></div>)}</div>}
 <div className="fl-two"><label>계절<select value={editing.data.season} onChange={e=>edit('season',e.target.value)}>{SEASONS.map(x=><option key={x}>{x}</option>)}</select></label><label>주요 컬러<input value={editing.data.color} onChange={e=>edit('color',e.target.value)}/></label></div>
 <div className="fl-two"><label>주요 아이템<input value={editing.data.item} onChange={e=>edit('item',e.target.value)}/></label><label>TPO<input value={editing.data.occasion||''} onChange={e=>edit('occasion',e.target.value)}/></label></div>
 <label>대표 사진<input type="file" accept="image/*" onChange={e=>setUpload(e.target.files?.[0]||null)}/>{(photos[editing.data.id]||urls[editing.data.reference_id])&&<img className="fl-preview" src={photos[editing.data.id]||urls[editing.data.reference_id]}/>}</label>
 <label>숙련도<select value={editing.data.status} onChange={e=>edit('status',e.target.value)}>{STATUS.map(x=><option key={x}>{x}</option>)}</select></label>
 <div className="fl-inventory-connector"><div className="fl-guidehead"><b>내 인벤토리 연결 · {linkedItems(editing.data).length}개</b></div><input value={itemSearch} onChange={e=>setItemSearch(e.target.value)} placeholder="내 옷 검색 · 여러 개 선택 가능"/><div className="fl-inventory-list">{inventory.filter(i=>[i.title,i.category,i.color,i.subcategory].join(' ').toLowerCase().includes(itemSearch.toLowerCase())).sort((a,b)=>Number(suggested(editing.data).some(x=>x.id===b.id))-Number(suggested(editing.data).some(x=>x.id===a.id))).map(i=><label key={i.id} className="fl-inventory-item"><input type="checkbox" checked={(editing.data.inventoryIds||[]).includes(i.id)} onChange={()=>toggleInventory(i.id)}/>{inventoryUrls[i.id]&&<img src={inventoryUrls[i.id]} alt=""/>}<span><b>{i.title}</b><small>{[i.color,i.category].filter(Boolean).join(' · ')}{suggested(editing.data).some(x=>x.id===i.id)?' · 추천':''}</small></span></label>)}</div><small className="fl-inventory-help">컬러·아이템이 일치하는 옷을 먼저 보여줘. 선택한 옷만 기술에 연결돼.</small>{linkedItems(editing.data).length>0&&<button className="fl-practice-btn" type="button" onClick={()=>{const selected=linkedItems(editing.data);onPractice?.({skill:editing.data,items:selected});setEditing(null)}}><Layers size={15}/> 이 아이템으로 코디 연습</button>}</div><label>메모<textarea value={editing.data.memo||''} onChange={e=>edit('memo',e.target.value)}/></label>
 {state.skills.some(x=>x.id===editing.data.id)&&<div className="fl-linked"><b>이 기술이 연결된 영상 구간</b>{linked(editing.data.id).map(c=><div className="fl-clip" key={c.id}><span>{c.video.title} · {c.start}–{c.end}</span><button onClick={()=>window.open('https://www.youtube.com/watch?v='+ytId(c.video.url)+'&t='+seconds(c.start)+'s','_blank')}><ExternalLink size={14}/></button>{c.caution&&<small>주의: {c.caution}</small>}{c.memo&&<small>{c.memo}</small>}</div>)}</div>}
 </>:editing.kind==='videos'?<StudyPracticeBookmark key={editing.data.id} bookmark={toStudio(editing.data)} skills={state.skills.map(x=>({...x,area:x.season||'미분류',muscle:x.item||''}))} history={state.skills.flatMap(x=>(x.statusHistory||[]).map(h=>({...h,skillId:x.id,memo:h.note||h.memo||''})))} onCreateSkill={createStudySkill} onAutoSave={video=>storeVideo(video).catch(err=>setError(err.message))} onSave={async video=>{await storeVideo(video);setEditing(null)}} onEvaluate={async entry=>{const next=structuredClone(stateRef.current),skill=next.skills.find(x=>x.id===entry.skillId);if(!skill)return;skill.status=entry.status;skill.statusHistory=[...(skill.statusHistory||[]),{id:uid(),status:entry.status,at:new Date().toISOString(),note:entry.memo||'',bookmarkId:entry.bookmarkId,source:'북마크 연습'}];await commit(next)}} onDelete={()=>remove('videos',editing.data.id)}/>>:<><label>제목<input value={editing.data.title} onChange={e=>edit('title',e.target.value)}/></label><label>연결 기술<select value={editing.data.skillId||''} onChange={e=>edit('skillId',e.target.value)}><option value="">자유 메모</option>{state.skills.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>메모<textarea value={editing.data.memo||''} onChange={e=>edit('memo',e.target.value)}/></label></>}
 {editing.kind!=='videos'&&<div className="fl-actions"><button className="primary" onClick={save}><Check size={15}/> 저장</button>{state[editing.kind].some(x=>x.id===editing.data.id)&&<button className="fl-small" onClick={()=>remove(editing.kind,editing.data.id)}><Trash2 size={15}/> 삭제</button>}</div>}
 </section></div>}
 </div>
}
