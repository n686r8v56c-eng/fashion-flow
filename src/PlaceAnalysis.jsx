import React,{useState} from 'react';
import {ImagePlus,MapPin,Search,ExternalLink,Trash2} from 'lucide-react';
import {supabase} from './supabase';
import {useLocalCollection} from './sync/LocalSync.jsx';
const field={border:'1px solid #e2d5ed',borderRadius:12,padding:12,fontSize:16,width:'100%',boxSizing:'border-box'};
async function prepare(file){
 if(!file?.type?.startsWith('image/'))throw Error('이미지 파일을 선택해 줘.');
 if(file.size>20*1024*1024)throw Error('20MB 이하 사진을 선택해 줘.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;
  await new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth)return resolve();img.onload=resolve;img.onerror=()=>reject(Error('사진을 읽을 수 없어.'))});
  const scale=Math.min(1,800/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const image=canvas.toDataURL('image/jpeg',.58);canvas.width=canvas.height=0;
  if(image.length>2_800_000)throw Error('이미지가 너무 커. 더 작은 사진을 선택해 줘.');
  return image;
 }finally{URL.revokeObjectURL(url)}
}
export default function PlaceAnalysis({onSaved,initialImage=''}){
 const candidates=useLocalCollection('scene-place-candidates-v1');
 const [saveStatus,setSaveStatus]=useState('');
 const saveCandidate=async(name)=>{try{const item={id:crypto.randomUUID(),name,address:'',url:'',source:'AI 분석',status:'후보',purpose:'사진 촬영',notes:[result.background,result.mood,...(result.visualClues||[]),notes].filter(Boolean).join(' · '),verified:false,updatedAt:new Date().toISOString()};await candidates.write(item);setSaveStatus('장소 후보함에 저장했어.');onSaved?.()}catch(e){setSaveStatus('저장 실패: '+e.message)}};
 const [image,setImage]=useState(initialImage),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notes,setNotes]=useState('');
 const clear=()=>{setImage('');setResult(null);setNotes('');setError('')};
 const choose=async(e)=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{clear();setImage(await prepare(file))}catch(err){setError(err.message)}};
 const analyze=async()=>{
  if(!image||busy)return;setBusy(true);setError('');setResult(null);
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session?.access_token)throw Error('로그인이 필요해.');
   let response;
   try{
    response=await fetch('/api/analyze-location',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({image}),cache:'no-store'});
   }catch(networkError){
    throw Error('서버 연결 실패: 아이폰 브라우저가 요청을 완료하지 못했어. 인터넷 연결이나 Cloudflare Pages 배포 상태를 확인해 줘. ('+(networkError?.message||'네트워크 오류')+')');
   }
   const raw=await response.text();
   let data;try{data=JSON.parse(raw)}catch{throw Error('분석 서버 응답 오류 (HTTP '+response.status+'). Cloudflare Functions 배포·로그를 확인해 줘.');}
   if(!response.ok)throw Error((data.error||'분석하지 못했어.')+' (HTTP '+response.status+')');
   if(!data.result)throw Error('AI 분석 결과가 비어 있어. 서버 로그를 확인해 줘.');
   setResult(data.result);
  }catch(err){setError(err?.message||'알 수 없는 오류가 발생했어.')}finally{setBusy(false)}
 };
 return <section style={{maxWidth:760,margin:'0 auto',padding:'8px 0 40px',display:'grid',gap:14}}>
  <h2 style={{margin:0}}>AI 장소 분석</h2>
  <p style={{color:'#87758e',fontSize:14,margin:0}}>사진 속 배경·간판·공개 장소 단서를 분석해. 결과는 촬영 위치의 확정 정보가 아니라 AI 추정이야.</p>
  <label style={{...field,background:'#f5f0fa',color:'#8057ac',display:'flex',justifyContent:'center',alignItems:'center',gap:8,cursor:'pointer',fontWeight:600}}><ImagePlus size={20}/> 사진 선택<input type="file" accept="image/*" onChange={choose} style={{display:'none'}}/></label>
  {image&&<><img src={image} alt="장소 분석할 사진" style={{maxWidth:'100%',maxHeight:440,objectFit:'contain',borderRadius:12,background:'#f5f0fa'}}/>
  <div style={{display:'flex',gap:9}}><button className="primary" type="button" disabled={busy} onClick={analyze} style={{flex:1}}><Search size={17}/>{busy?'분석 중…':'AI로 장소 분석'}</button><button type="button" className="light" disabled={busy} onClick={clear} aria-label="사진 지우기"><Trash2 size={18}/></button></div></>}
  {error&&<p role="alert" style={{color:'#ad4964'}}>{error}</p>}
  {result&&<div style={{border:'1px solid #e5d9ee',borderRadius:16,padding:17,display:'grid',gap:11}}>
  <h3 style={{margin:0,display:'flex',alignItems:'center',gap:7}}><MapPin size={19}/> AI 추정 결과</h3>
  <div><b>배경 유형</b><p>{result.background}</p></div>
  <div><b>분위기</b><p>{result.mood}</p></div>
  <div><b>관찰한 단서</b>{result.visualClues?.length?<ul>{result.visualClues.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>명확한 단서 없음</p>}</div>
  <div><b>공개 장소 후보</b>{result.placeCandidates?.length?<ul>{result.placeCandidates.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>특정 장소는 확인되지 않았어.</p>}</div>
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{result.placeCandidates?.length?result.placeCandidates.map((name,i)=><button type="button" key={i} className="light" onClick={()=>saveCandidate(name)}>후보 저장: {name}</button>):<button type="button" className="light" onClick={()=>saveCandidate(result.background||'장소 미확인')}>가칭으로 후보 저장</button>}</div>{saveStatus&&<p role="status">{saveStatus}</p>}
  <div><b>추정 근거 수준</b><p>{result.certainty}</p></div>
  <p style={{fontSize:13,color:'#8d789b'}}>{result.caution}</p>
  <label style={{fontWeight:600}}>내가 확인한 장소 / 메모<textarea rows={2} style={{...field,display:'block',marginTop:8}} placeholder="확인된 정보는 직접 기록해 줘." value={notes} onChange={e=>setNotes(e.target.value)}/></label>
  <p style={{fontSize:12,color:'#8d789b',margin:0}}>메모와 분석 결과는 자동 저장되지 않아. 사진을 다시 선택하거나 화면을 나가면 초기화돼.</p>
  <a href="https://lens.google/" target="_blank" rel="noopener noreferrer" style={{display:'flex',gap:7,alignItems:'center'}}><ExternalLink size={16}/> Google Lens에서 직접 확인</a>
  </div>}
  <p style={{fontSize:12,color:'#8d789b',lineHeight:1.6}}>분석을 누르면 사진의 축소본이 OpenAI API로 전송돼. 앱 서버나 Supabase에 사진을 저장하지 않으며 API 사용 비용이 발생할 수 있어. 개인 주거지나 사람의 정확한 위치는 추정하지 않아.</p>
 </section>;
}
