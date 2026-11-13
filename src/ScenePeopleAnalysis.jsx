import React,{useState} from 'react';
import {ImagePlus,Users,Search,ExternalLink} from 'lucide-react';
import {supabase} from './supabase.js';
import './SceneFlow.css';
async function prepare(file){
 if(!file?.type?.startsWith('image/'))throw Error('사진 파일을 선택해 줘.');
 if(file.size>20*1024*1024)throw Error('20MB 이하 사진만 가능해.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('사진을 열 수 없어.'));img.src=url;});
  const scale=Math.min(1,800/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/jpeg',0.58);canvas.width=canvas.height=0;
  if(data.length>2800000)throw Error('사진 크기가 너무 커.');
  return data;
 }finally{URL.revokeObjectURL(url)}
}
export default function ScenePeopleAnalysis(){
 const [image,setImage]=useState(''),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [keywords,setKeywords]=useState('');
 const choose=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;setError('');setResult(null);try{setImage(await prepare(f))}catch(err){setError(err.message)}};
 const analyze=async()=>{
  if(!image||busy)return;setBusy(true);setError('');setResult(null);
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session?.access_token)throw Error('로그인이 필요해.');
   let response;try{response=await fetch('/api/analyze-people-style',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({image})})}catch(e){throw Error('분석 서버 연결 실패: '+e.message)}
   const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{throw Error('서버 응답 오류 (HTTP '+response.status+')')}
   if(!response.ok)throw Error((data.error||'스타일 분석 실패')+' (HTTP '+response.status+')');
   setResult(data.result);
   setKeywords((data.result?.placeCandidates||[]).join(' / '));
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 return <section className="scene-section"><h2>인물 스타일 · WHO</h2>
  <p>사진 속 사람들의 의상·헤어·액세서리·커플 스타일을 분석하고, 비슷한 패션 콘텐츠를 검색해.</p>
  <div className="scene-panel">
   <label className="scene-upload" style={{justifyContent:'center'}}><ImagePlus size={18}/> 사진 선택<input type="file" accept="image/*" onChange={choose}/></label>
   {image&&<img src={image} alt="분석할 참고 사진" style={{maxWidth:'100%',maxHeight:400,objectFit:'contain',borderRadius:10}}/>}
   <button type="button" className="primary" disabled={!image||busy} onClick={analyze}><Search size={17}/>{busy?'분석 중…':'AI로 인물 스타일 분석'}</button>
   {error&&<p role="alert" className="scene-error">{error}</p>}
   {result&&<><h3><Users size={18}/> 분석 결과</h3><p>{result.background}</p><p>스타일 무드: {result.mood}</p>
    <b>사진에서 확인된 스타일 단서</b><ul>{(result.visualClues||[]).map((v,i)=><li key={i}>{v}</li>)}</ul>
    <b>검색어</b><div className="scene-actions">{(result.placeCandidates||[]).map((q,i)=><a key={i} target="_blank" rel="noopener noreferrer" href={'https://www.google.com/search?tbm=isch&q='+encodeURIComponent(q)}>{q} <ExternalLink size={12}/></a>)}</div>
    <p className="scene-hint">{result.caution}</p></>}
  </div>
  <div className="scene-panel"><h3>직접 스타일 검색</h3><label className="scene-field">검색 키워드<input value={keywords} onChange={e=>setKeywords(e.target.value)} placeholder="예: 남자 회색 니트 블랙 슬랙스"/></label>
   <div className="scene-actions"><a href={'https://search.naver.com/search.naver?where=image&query='+encodeURIComponent(keywords)} target="_blank" rel="noopener noreferrer">네이버 이미지 <ExternalLink size={13}/></a><a href={'https://www.google.com/search?tbm=isch&q='+encodeURIComponent(keywords)} target="_blank" rel="noopener noreferrer">구글 이미지 <ExternalLink size={13}/></a></div>
  </div>
  <p className="scene-hint">얼굴과 실존 인물은 식별·매칭하지 않아. 분석 시 축소 사진이 OpenAI API로 전송되며 비용이 발생할 수 있어. 결과나 사진은 자동 저장하지 않아.</p>
 </section>;
}
