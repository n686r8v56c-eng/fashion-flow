import React,{useCallback,useEffect,useState} from 'react';
import {MapPin,Plus,Trash2,ExternalLink,ArrowUp,ArrowDown,Navigation,Check,Camera,Users,ImagePlus,Shirt,Search,CalendarDays,Copy} from 'lucide-react';
import {useLocalCollection} from './sync/LocalSync.jsx';
import './SceneFlow.css';
const uid=()=>crypto.randomUUID();
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch{return ''}};
const mapsQuery=value=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(value);
function useRecords(collection){
 const sync=useLocalCollection(collection),[records,setRecords]=useState([]),[error,setError]=useState('');
 const refresh=useCallback(()=>sync.read().then(rows=>setRecords(rows.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')))).catch(e=>setError(e.message)),[sync]);
 useEffect(()=>{refresh();return sync.subscribe(refresh)},[refresh,sync]);
 const save=async row=>{try{const next={...row,id:row.id||uid(),updatedAt:new Date().toISOString()};await sync.write(next);await refresh();setError('');return next}catch(e){setError('저장 실패: '+e.message);return null}};
 const remove=async id=>{try{await sync.remove(id);await refresh()}catch(e){setError('삭제 실패: '+e.message)}};
 return {records,save,remove,error};
}
const btn=(variant='light')=>({border:'1px solid #e1d3ef',background:variant==='primary'?'#8961b6':'#f8f2fd',color:variant==='primary'?'white':'#745394',borderRadius:11,padding:'10px 12px',fontSize:14,cursor:'pointer'});
const emptyPlace=()=>({name:'',address:'',url:'',source:'직접 등록',status:'후보',purpose:'사진 촬영',notes:'',visitDate:'',verified:false});
export function ScenePlaces({incoming}){
 const {records,save,remove,error}=useRecords('scene-place-candidates-v1');
 const {records:plans,save:savePlan,remove:removePlan,error:planError}=useRecords('scene-route-plans-v1');
 const [draft,setDraft]=useState(null),[selected,setSelected]=useState([]),[route,setRoute]=useState([]),[visitDate,setVisitDate]=useState(''),[message,setMessage]=useState(''),[filter,setFilter]=useState('전체');
 useEffect(()=>{if(incoming?.name)setDraft({...emptyPlace(),...incoming})},[incoming]);
 const checked=records.filter(x=>selected.includes(x.id)),byId=Object.fromEntries(records.map(x=>[x.id,x]));
 const ordered=route.filter(id=>selected.includes(id)&&byId[id]);
 const routeItems=[...ordered,...checked.filter(x=>!ordered.includes(x.id)).map(x=>x.id)].map(id=>byId[id]).filter(Boolean);
 const set=(key,value)=>setDraft(old=>({...old,[key]:value}));
 const submit=async e=>{e.preventDefault();const name=draft.name.trim();if(!name){setMessage('장소 이름을 입력해 줘.');return}if(draft.verified&&!draft.address.trim()){setMessage('장소 확인 시 주소를 입력해 줘.');return}const saved=await save({...draft,name});if(saved){setDraft(null);setMessage('장소 후보함에 저장했어.')}}; 
 const mapAddress=p=>p.address?.trim()||p.name?.trim();
 const makeRoute=()=>{
  if(routeItems.length<2)return '';
  if(routeItems.some(p=>!p.verified||!p.address?.trim()))return '';
  const list=routeItems.slice(0,9);
  const params=new URLSearchParams({api:'1',origin:list[0].address,destination:list[list.length-1].address,travelmode:'walking'});
  if(list.length>2)params.set('waypoints',list.slice(1,-1).map(p=>p.address).join('|'));
  return 'https://www.google.com/maps/dir/?'+params.toString();
 };
 const routeUrl=makeRoute();
 return <section className="scene-section">
  <div className="scene-heading"><div><h2>장소 후보함</h2><p>키워드 후보처럼 모아두고, 검증한 장소로 방문 동선을 만들어.</p></div><button style={btn('primary')} onClick={()=>{setDraft(emptyPlace());setMessage('')}}><Plus size={15}/> 추가</button></div>
  {(error||planError)&&<p role="alert" className="scene-error">{error||planError}</p>}{message&&<p role="status" className="scene-hint">{message}</p>}
  {draft&&<form className="scene-panel scene-form" onSubmit={submit}>
   <h3>{draft.id?'장소 수정':'장소 후보 등록'}</h3>
   <label>장소명 / 가칭<input required value={draft.name} onChange={e=>set('name',e.target.value)} placeholder="예: 벽돌 카페 (정확한 상호 미확인)"/></label>
   <label>확인한 주소<input value={draft.address||''} onChange={e=>set('address',e.target.value)} placeholder="미확인이라면 비워두기"/></label>
   <label>공식 링크·지도 링크<input type="url" value={draft.url||''} onChange={e=>set('url',e.target.value)} placeholder="https://..."/></label>
   <div className="scene-grid-two"><label>상태<select value={draft.status||'후보'} onChange={e=>set('status',e.target.value)}>{['후보','검증 중','방문 계획','방문 완료','보류'].map(x=><option key={x}>{x}</option>)}</select></label><label>방문 목적<select value={draft.purpose||'사진 촬영'} onChange={e=>set('purpose',e.target.value)}>{['사진 촬영','카페','쇼핑','전시','데이트','기타'].map(x=><option key={x}>{x}</option>)}</select></label></div>
   <label>방문 예정일<input type="date" value={draft.visitDate||''} onChange={e=>set('visitDate',e.target.value)}/></label>
   <label>단서·메모<textarea rows={3} value={draft.notes||''} onChange={e=>set('notes',e.target.value)}/></label>
   <label className="scene-checkbox"><input type="checkbox" checked={Boolean(draft.verified)} onChange={e=>set('verified',e.target.checked)}/> 주소와 장소를 직접 확인했음</label>
   <div className="scene-actions"><button style={btn('primary')} type="submit">저장</button><button style={btn()} type="button" onClick={()=>setDraft(null)}>취소</button></div>
  </form>}
  <div className="scene-filter">{['전체','후보','검증 중','방문 계획','방문 완료'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)}>{x}</button>)}</div>
  {!records.length&&<p className="scene-hint">아직 장소 후보가 없어. AI 분석에서 후보를 저장하거나 직접 추가해 봐.</p>}
  {records.filter(x=>filter==='전체'||x.status===filter).map(p=><article className="scene-panel scene-place-row" key={p.id}>
   <label className="scene-checkbox"><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))} aria-label={p.name+' 동선 선택'}/></label>
   <div className="scene-place-body"><b>{p.name}</b><small>{p.verified?'✓ 확인한 장소':'? 추정·미확인'} · {p.status||'후보'} · {p.purpose||'사진 촬영'}</small><small>{p.address||'주소 미확인'}{p.visitDate?' · '+p.visitDate:''}</small>{p.notes&&<p>{p.notes}</p>}
    <div className="scene-actions"><button style={btn()} onClick={()=>setDraft({...p})}>수정</button><a href={safeUrl(p.url)||mapsQuery(mapAddress(p))} target="_blank" rel="noopener noreferrer">검색·지도 <ExternalLink size={13}/></a><button className="scene-danger" onClick={()=>{if(window.confirm('장소 후보를 삭제할까?')){remove(p.id);setSelected(x=>x.filter(id=>id!==p.id))}}} aria-label="삭제"><Trash2 size={16}/></button></div>
   </div>
  </article>)}
  <div className="scene-panel scene-route">
   <h3><Navigation size={18}/> 방문 동선 만들기</h3>
   <p className="scene-hint">목록에서 여러 장소를 체크하고 순서를 정해 줘. 지도 경로는 주소를 직접 확인한 장소만 연결해.</p>
   <label>방문 날짜<input type="date" value={visitDate} onChange={e=>setVisitDate(e.target.value)}/></label>
   {routeItems.map((p,i)=><div className="scene-stop" key={p.id}><b>{i+1}. {p.name}</b><div className="scene-actions"><button aria-label="위로" disabled={i===0} onClick={()=>setRoute(routeItems.map(x=>x.id).filter(id=>id!==p.id).toSpliced(i-1,0,p.id))}><ArrowUp size={16}/></button><button aria-label="아래로" disabled={i===routeItems.length-1} onClick={()=>setRoute(routeItems.map(x=>x.id).filter(id=>id!==p.id).toSpliced(i+1,0,p.id))}><ArrowDown size={16}/></button></div></div>)}
   {routeItems.length>9&&<p className="scene-hint">지도 링크는 한 번에 최대 9개 장소만 포함해.</p>}
   <div className="scene-actions">{routeUrl?<a href={routeUrl} target="_blank" rel="noopener noreferrer" className="scene-primary-link"><Navigation size={16}/> 지도에서 동선 열기</a>:<span className="scene-hint">2곳 이상 선택하고 각 장소의 실제 주소를 확인하면 지도 경로를 열 수 있어.</span>}</div>
   {routeItems.length>=2&&<button style={btn('primary')} onClick={async()=>{const saved=await savePlan({title:(visitDate||'날짜 미정')+' · SCENE 동선',visitDate,stops:routeItems.map(p=>({id:p.id,name:p.name,address:p.address||'',verified:Boolean(p.verified)}))});if(saved)setMessage('방문 동선을 저장했어.')}}><CalendarDays size={16}/> 이 동선 저장</button>}
   {routeItems.length>0&&<button style={btn()} onClick={async()=>{const lines=[visitDate?'방문일 '+visitDate:'방문일 미정',...routeItems.map((p,i)=>(i+1)+'. '+p.name+' / '+(p.address||'주소 미확인'))];try{await navigator.clipboard.writeText(lines.join('\n'));setMessage('방문 계획을 복사했어.')}catch{setMessage('복사 실패: 브라우저 권한을 확인해 줘.')}}}><Copy size={15}/> 방문 순서 복사</button>}
   <p className="scene-hint">이동시간·영업시간·예약은 지도와 공식 사이트에서 확인해야 해. 이 화면은 아직 경로 자동 최적화를 하지 않아.</p>
  </div>
  <div className="scene-panel"><h3>저장한 방문 동선 · {plans.length}개</h3>
    {!plans.length&&<p className="scene-hint">아직 저장한 동선이 없어. 장소를 선택해 저장해 봐.</p>}
    {plans.map(plan=>{const stops=plan.stops||[];const complete=stops.length>=2&&stops.every(p=>p.verified&&p.address);
      const link=()=>{const listed=stops.slice(0,9);const q=new URLSearchParams({api:'1',origin:listed[0].address,destination:listed[listed.length-1].address,travelmode:'walking'});if(listed.length>2)q.set('waypoints',listed.slice(1,-1).map(p=>p.address).join('|'));return 'https://www.google.com/maps/dir/?'+q};
      return <div key={plan.id} className="scene-saved-route"><div><b>{plan.title}</b><p>{stops.map((x,i)=>(i+1)+'. '+x.name).join(' → ')}</p></div><div className="scene-actions">{complete&&<a href={link()} target="_blank" rel="noopener noreferrer"><Navigation size={14}/> 지도 열기</a>}<button style={btn()} onClick={()=>{setSelected(stops.map(p=>p.id).filter(id=>byId[id]));setRoute(stops.map(p=>p.id).filter(id=>byId[id]));setVisitDate(plan.visitDate||'');setMessage('동선을 편집하려면 위 목록에서 주소와 순서를 확인한 뒤 다시 저장해 줘.')}}>불러오기</button><button className="scene-danger" aria-label="저장 동선 삭제" onClick={()=>{if(window.confirm('저장된 동선만 삭제할까? 장소 후보는 그대로 유지돼.'))removePlan(plan.id)}}><Trash2 size={16}/></button></div></div>})}
  </div>
 </section>
}
export function SceneHome({onGo,image,onImage}){
 const [loading,setLoading]=useState(false);
 const choose=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setLoading(true);try{const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('사진을 열 수 없어.'));img.src=url});const scale=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);onImage(canvas.toDataURL('image/jpeg',.65));canvas.width=canvas.height=0}finally{URL.revokeObjectURL(url)}}catch(err){alert(err.message)}finally{setLoading(false)}};
 const features=[['WHERE','장소 · 카페 · 분위기','place-analysis',MapPin],['WHAT','착장 · 컬러 · 아이템','outfit-analysis',Shirt],['WHO','인물 스타일 · 함께할 장면','scene-people',Users],['HOW','포즈 · 구도 · 촬영 팁','scene-shoot',Camera]];
 return <section className="scene-section scene-home"><h2>PHOTO → REAL LIFE</h2><div className="scene-panel">
  <div className="scene-intro"><div className="scene-hero-image">{image?<img src={image} alt="선택한 영감 사진"/>:<ImagePlus size={34}/>}</div><div><small>STEP 01 · INSPIRATION</small><h3>갖고 싶은 순간의 사진 한 장</h3><p>인스타그램·핀터레스트·내가 저장한 코디 사진</p><label className="scene-upload">{loading?'사진 준비 중…':image?'다른 영감 사진 선택':'영감 사진 선택'}<input type="file" accept="image/*" onChange={choose}/></label></div></div>
  <hr/><small>STEP 02 · AI 분석</small><div className="scene-home-grid">{features.map(([title,desc,id,Icon])=><button key={id} onClick={()=>onGo(id)}><Icon size={22}/><b>{title}</b><small>{desc}</small></button>)}</div>
  <p className="scene-hint">홈에서 고른 사진은 착장AI·장소AI·인물 탭으로 전달돼. 실제 AI 분석은 각 탭의 분석 버튼을 눌러야 시작돼. 사진은 현재 앱 실행 중 메모리에만 유지해.</p>
  <hr/><small>STEP 03 · REALIZATION</small><h3>그 장면을 내 현실로 만들기</h3><p>장소 후보 저장 → 방문 동선 → 착장 준비 → 촬영 → 실제 사진 기록</p><button style={btn('primary')} onClick={()=>onGo('scene-realize')}><Check size={16}/> 실현 계획 열기</button>
 </div></section>
}
export function ScenePeople(){
 const [keywords,setKeywords]=useState('그레이 니트 블랙 슬랙스 미니멀 데이트룩');
 const links=[['인스타 해시태그','https://www.instagram.com/explore/tags/'+encodeURIComponent(keywords.replace(/\s+/g,''))+'/'],['네이버 이미지','https://search.naver.com/search.naver?where=image&query='+encodeURIComponent(keywords)],['구글 이미지','https://www.google.com/search?tbm=isch&q='+encodeURIComponent(keywords)]];
 return <section className="scene-section"><h2>인물 스타일</h2><div className="scene-panel"><h3>WHO · 함께할 장면</h3><p>얼굴이 닮은 실제 사람을 찾는 대신, 사진 속 옷·헤어·액세서리·커플 스타일을 키워드로 탐색해.</p><label className="scene-field">찾고 싶은 스타일 키워드<input value={keywords} onChange={e=>setKeywords(e.target.value)} placeholder="예: 남자 그레이 니트 미니멀룩"/></label><div className="scene-actions">{links.map(([label,link])=><a key={label} href={link} target="_blank" rel="noopener noreferrer">{label} <ExternalLink size={13}/></a>)}</div><p className="scene-hint">검색 링크는 웹의 공개 콘텐츠를 여는 방식이며 인스타그램에서 자동으로 닮은 사람을 찾거나 실제 계정을 식별하지 않아.</p></div></section>
}
const shootDefaults=['장소 촬영 허용 여부 확인','원하는 시간대·자연광 확인','원본 사진의 전신·반신 구도 확인','카메라 높이·각도 맞추기','손·시선·포즈 연습','의상·가방·꽃 등 소품 준비','촬영 후 실제 사진 비교'];
export function SceneShoot(){
 const {records,save,error}=useRecords('scene-shoot-checks-v1');
 const rows=shootDefaults.map((label,i)=>records.find(x=>x.name===label)||{id:'shoot-'+i,name:label,done:false});
 return <section className="scene-section"><h2>촬영 · HOW</h2><p>영감 사진 속 장면을 재현하기 위한 촬영 체크리스트</p>{error&&<p className="scene-error">{error}</p>}<div className="scene-panel">{rows.map(row=><label className="scene-check-row" key={row.id}><input type="checkbox" checked={Boolean(row.done)} onChange={e=>save({...row,done:e.target.checked})}/><span>{row.name}</span></label>)}</div><p className="scene-hint">체크 상태는 계정의 로컬 우선 동기화 기록에 저장돼.</p></section>
}
export function SceneRealize({onGo}){
 const {records,save,remove,error}=useRecords('scene-realization-v1');
 const [name,setName]=useState(''),[place,setPlace]=useState(''),[date,setDate]=useState('');
 return <section className="scene-section"><h2>실현 · REAL LIFE</h2><p>동경하는 한 장면을 실제 일정과 실행 기록으로 바꿔봐.</p>{error&&<p className="scene-error">{error}</p>}
  <form className="scene-panel scene-form" onSubmit={async e=>{e.preventDefault();if(await save({title:name.trim(),place:place.trim(),date,phase:'준비',completed:false})){setName('');setPlace('');setDate('')}}}>
   <h3>새 장면 계획</h3><label>장면 이름<input value={name} onChange={e=>setName(e.target.value)} required placeholder="예: 성수 카페 거리 스냅"/></label><label>장소 / 후보<input value={place} onChange={e=>setPlace(e.target.value)} placeholder="장소 후보함에서 확인한 장소"/></label><label>계획 날짜<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button style={btn('primary')} type="submit"><Plus size={15}/> 계획 저장</button>
  </form>
  {records.map(x=><article className="scene-panel scene-realize-row" key={x.id}><div><b>{x.title}</b><p>{x.place||'장소 미정'} · {x.date||'날짜 미정'}</p></div><select aria-label={x.title+' 진행 상태'} value={x.phase||'준비'} onChange={e=>save({...x,phase:e.target.value,completed:e.target.value==='완료'})}>{['준비','방문 예정','촬영 예정','완료','보류'].map(v=><option key={v}>{v}</option>)}</select><button className="scene-danger" onClick={()=>{if(window.confirm('이 장면 계획을 삭제할까?'))remove(x.id)}} aria-label="계획 삭제"><Trash2 size={16}/></button></article>)}
  {!records.length&&<p className="scene-hint">아직 계획이 없어. 방문하고 싶은 장면부터 하나 만들어 봐.</p>}
  <button style={btn()} onClick={()=>onGo('place-analysis')}><MapPin size={15}/> 장소 후보함으로 이동</button>
  <p className="scene-hint">현재 버전은 일정·진행 상태 기록까지 지원해. 영감 사진과 결과 사진의 영구 저장·비교는 아직 연결되지 않았어.</p>
 </section>;
}
