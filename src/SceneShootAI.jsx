import React,{useEffect,useMemo,useState} from 'react';
import {Camera,ImagePlus,ScanEye,Save,Trash2,CheckCircle2,Plus,ArrowUp,ArrowDown} from 'lucide-react';
import {supabase} from './supabase';
import {useLocalCollection} from './sync/LocalSync.jsx';
import './SceneFlow.css';
const inputStyle={width:'100%',boxSizing:'border-box',fontSize:16,padding:'10px 11px',border:'1px solid #dfd4e9',borderRadius:10,background:'#fff',color:'#3c2c48'};
const softButton={padding:'9px 12px',background:'#f5f0fa',color:'#755a94',border:'1px solid #e2d6ed',borderRadius:10,fontSize:14};
async function resized(file){
 if(!file?.type?.startsWith('image/'))throw Error('사진 파일을 선택해 줘.');
 if(file.size>20*1024*1024)throw Error('20MB 이하 사진을 선택해 줘.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();await new Promise((ok,no)=>{image.onload=ok;image.onerror=()=>no(Error('사진을 읽을 수 없어.'));image.src=url});
  const scale=Math.min(1,900/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  const result=canvas.toDataURL('image/jpeg',.62);canvas.width=canvas.height=0;
  if(result.length>2_800_000)throw Error('이미지가 너무 커. 더 작은 사진을 선택해 줘.');
  return result;
 }finally{URL.revokeObjectURL(url)}
}
function useSavedShoots(){
 const collection=useLocalCollection('scene-shoot-projects-v1');
 const [records,setRecords]=useState([]),[error,setError]=useState('');
 useEffect(()=>{let alive=true;const refresh=()=>collection.read().then(items=>{if(alive)setRecords(items.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')))}).catch(e=>{if(alive)setError(e.message)});refresh();const unsub=collection.subscribe(refresh);return()=>{alive=false;unsub()}},[collection]);
 const write=async item=>{try{await collection.write(item);setRecords(old=>[item,...old.filter(x=>x.id!==item.id)].sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')));setError('');return true}catch(e){setError('저장 실패: '+e.message);return false}};
 const remove=async id=>{try{await collection.remove(id);setRecords(old=>old.filter(x=>x.id!==id));setError('')}catch(e){setError('삭제 실패: '+e.message)}};
 return {records,write,remove,error};
}
const normalizedShots=shots=>(shots||[]).map((s,i)=>({id:crypto.randomUUID(),title:s.title||'컷 '+(i+1),description:s.description||'',framing:s.framing||'',pose:s.pose||'',light:s.light||'',props:s.props||'',done:false}));
function ShotList({project,save,remove}){
 const [editing,setEditing]=useState(project.title);
 useEffect(()=>setEditing(project.title),[project.id,project.title]);
 const update=(change)=>save({...project,...change,updatedAt:new Date().toISOString()});
 const changeShot=(id,change)=>update({shots:project.shots.map(s=>s.id===id?{...s,...change}:s)});
 const move=(idx,delta)=>{const rows=[...project.shots],next=idx+delta;if(next<0||next>=rows.length)return;[rows[idx],rows[next]]=[rows[next],rows[idx]];update({shots:rows})};
 const count=project.shots.filter(x=>x.done).length;
 return <article className="scene-panel" style={{marginTop:10}}>
   <div className="scene-heading"><div><b>저장한 촬영 프로젝트</b><p className="scene-hint">{count} / {project.shots.length}컷 완료</p></div><button type="button" className="scene-danger" aria-label="프로젝트 삭제" onClick={()=>{if(window.confirm('이 촬영 프로젝트와 컷 리스트를 삭제할까?'))remove(project.id)}}><Trash2 size={18}/></button></div>
   <input style={inputStyle} value={editing} onChange={e=>setEditing(e.target.value)} onBlur={()=>{if(editing.trim()&&editing.trim()!==project.title)update({title:editing.trim()})}} aria-label="프로젝트 이름"/>
   {project.summary&&<p>{project.summary}</p>}
   {project.shots.map((shot,i)=><div key={shot.id} style={{padding:'10px 0',borderTop:'1px solid #eee6f2',display:'grid',gap:7}}>
      <div style={{display:'flex',alignItems:'center',gap:9}}>
       <input type="checkbox" checked={Boolean(shot.done)} onChange={e=>changeShot(shot.id,{done:e.target.checked})} aria-label={shot.title+' 완료'} style={{width:20,height:20,accentColor:'#8f67c1'}}/>
       <input aria-label={'컷 '+(i+1)+' 이름'} style={{...inputStyle,flex:1,minWidth:0}} value={shot.title} onChange={e=>changeShot(shot.id,{title:e.target.value})}/>
       <button type="button" style={softButton} disabled={i===0} aria-label="컷 위로" onClick={()=>move(i,-1)}><ArrowUp size={14}/></button>
       <button type="button" style={softButton} disabled={i===project.shots.length-1} aria-label="컷 아래로" onClick={()=>move(i,1)}><ArrowDown size={14}/></button>
      </div>
      <textarea aria-label={shot.title+' 촬영 메모'} style={{...inputStyle,resize:'vertical'}} rows={2} value={shot.description} onChange={e=>changeShot(shot.id,{description:e.target.value})}/>
      <small style={{color:'#81718d'}}>구도: {shot.framing||'미정'} · 포즈: {shot.pose||'미정'} · 빛: {shot.light||'미정'} · 소품: {shot.props||'미정'}</small>
    </div>)}
   <button type="button" style={softButton} onClick={()=>update({shots:[...project.shots,{id:crypto.randomUUID(),title:'새 컷',description:'',framing:'',pose:'',light:'',props:'',done:false}]})}><Plus size={16}/> 컷 추가</button>
 </article>;
}
export default function SceneShootAI({initialImage=''}) {
 const [photo,setPhoto]=useState(initialImage),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null),[title,setTitle]=useState(''),[savedMessage,setSavedMessage]=useState('');
 const {records,write,remove,error:storageError}=useSavedShoots();
 const choose=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;setLoading(true);setResult(null);setError('');setSavedMessage('');try{setPhoto(await resized(f))}catch(e){setError(e.message)}finally{setLoading(false)}};
 const analyze=async()=>{
  if(!photo||busy)return;setBusy(true);setError('');setResult(null);setSavedMessage('');
  try{
   const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw Error('로그인이 필요해.');
   let response;try{response=await fetch('/api/analyze-shoot',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({image:photo}),signal:AbortSignal.timeout(60000)})}catch(e){throw Error(e?.name==='TimeoutError'?'분석 시간이 초과됐어. 다시 시도해 줘.':'서버 연결 실패: '+(e?.message||'네트워크 오류'))}
   const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{throw Error('서버 응답이 올바르지 않아. (HTTP '+response.status+')')}
   if(!response.ok)throw Error((data.error||'촬영 분석에 실패했어.')+' (HTTP '+response.status+')');
   if(!data.result)throw Error('촬영 분석 결과가 비어 있어.');
   setResult(data.result);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const saveCurrent=async()=>{if(!result)return;const next={id:crypto.randomUUID(),title:title.trim()||'새 촬영 프로젝트',summary:result.summary||'',analysis:{observations:result.observations||[],composition:result.composition,pose:result.pose,light:result.light,uncertainties:result.uncertainties||[]},shots:normalizedShots(result.shots),updatedAt:new Date().toISOString(),source:'scene-ai'};if(await write(next)){setSavedMessage('컷 리스트를 프로젝트로 저장했어. 아래에서 수정·체크할 수 있어.')}};
 return <section className="scene-section">
  <div className="scene-heading"><div><h2>촬영AI · HOW</h2><p>영감 사진의 구도·포즈·빛을 분석하고 현장에서 쓸 컷 리스트를 만들어.</p></div><Camera size={24} color="#8e70c6"/></div>
  <div className="scene-panel">
   <label className="scene-upload" style={{justifyContent:'center',gap:8}}><ImagePlus size={17}/>{loading?'사진 준비 중…':'참고 사진 선택'}<input type="file" accept="image/*" disabled={loading||busy} onChange={choose}/></label>
   {photo&&<img src={photo} alt="촬영 분석할 참고 사진" style={{maxWidth:'100%',maxHeight:420,objectFit:'contain',borderRadius:13,background:'#f6f1fa'}}/>}
   <button type="button" className="primary" disabled={!photo||busy||loading} onClick={analyze}><ScanEye size={17}/>{busy?'구도·포즈·빛 분석 중…':'AI로 촬영 분석 + 컷 리스트 만들기'}</button>
   {error&&<p role="alert" className="scene-error">{error}</p>}
   {result&&<>
      <h3>분석 결과</h3><p>{result.summary}</p>
      <b>사진에서 직접 관찰된 것</b><ul>{(result.observations||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
      {[[ '구도',result.composition],['포즈',result.pose],['빛',result.light]].map(([name,val])=><div key={name} style={{borderTop:'1px solid #eee6f3',paddingTop:10}}><b>{name}</b><p><b>관찰:</b> {val?.observed||'미확인'}</p><p><b>재현 제안:</b> {val?.tips||'제안 없음'}</p></div>)}
      <b>확인되지 않은 정보</b><ul>{(result.uncertainties||[]).length?result.uncertainties.map((x,i)=><li key={i}>{x}</li>):<li>카메라 설정·정확한 시간과 장소 등은 추가 확인 필요</li>}</ul>
      <h3>AI 추천 컷 리스트 · {(result.shots||[]).length}개</h3>
      {(result.shots||[]).map((s,i)=><div key={i} style={{padding:'11px 0',borderTop:'1px solid #eee6f3'}}><b>{i+1}. {s.title}</b><p>{s.description}</p><p className="scene-hint">구도 {s.framing||'미정'} · 포즈 {s.pose||'미정'} · 빛 {s.light||'미정'} · 소품 {s.props||'미정'}</p></div>)}
      <label style={{fontWeight:600,display:'grid',gap:6}}>프로젝트 이름<input style={inputStyle} value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 성수 카페 스냅"/></label>
      <button type="button" className="primary" onClick={saveCurrent}><Save size={16}/> 분석 결과를 촬영 프로젝트로 저장</button>
      {savedMessage&&<p role="status" className="scene-hint">{savedMessage}</p>}
   </>}
  </div>
  <h3 style={{marginTop:10}}>내 촬영 프로젝트 · {records.length}개</h3>
  {storageError&&<p role="alert" className="scene-error">{storageError}</p>}
  {!records.length&&<p className="scene-hint">AI 컷 리스트를 저장하면 여기에서 순서 편집·메모·촬영 완료 체크를 할 수 있어.</p>}
  {records.map(x=><ShotList key={x.id} project={x} save={write} remove={remove}/>)}
  <p className="scene-hint">분석 버튼을 누를 때만 사진 축소본이 OpenAI API로 전송되며 사용 요금이 발생할 수 있어. 저장되는 것은 분석 텍스트·컷 리스트·체크 상태이고 사진 원본은 저장하지 않아. 실제 카메라 설정·촬영 시각은 사진만으로 확정하지 않아.</p>
 </section>;
}
