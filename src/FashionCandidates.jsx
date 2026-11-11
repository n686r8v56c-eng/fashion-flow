import React,{useEffect,useState} from 'react';
import QuickBrandNotes from './QuickBrandNotes.jsx';
import {quickTitleKey} from './quickBrandUtils.js';
import {useLocalCollection} from './sync/LocalSync.jsx';
import './FashionCandidates.css';
export default function FashionCandidates({userId}){
 const {read,write,subscribe}=useLocalCollection('candidates');
 const [records,setRecords]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');const refresh=()=>read().then(rows=>{if(active)setRecords(rows)}).catch(()=>{if(active)setError('후보함을 불러오지 못했어요. 다시 시도해 주세요.')}).finally(()=>{if(active)setLoading(false)});refresh();const unsubscribe=subscribe(refresh);return()=>{active=false;unsubscribe()}},[userId,retry,read,subscribe]);
 async function saveRecord(kind,title,payload,id){
  const prior=id?records.find(r=>r.id===id):null;
  if(records.some(r=>r.id!==id&&r.title_key===quickTitleKey(title)))throw Error('이미 등록된 문구예요.');
  const row={id:id||crypto.randomUUID(),user_id:userId,kind,title,title_key:quickTitleKey(title),payload,created_at:prior?.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};
  try{await write(row);setRecords(rows=>[row,...rows.filter(r=>r.id!==row.id)]);return true}catch(e){throw Error(e.name==='ConstraintError'?'이미 등록된 문구예요. 후보함을 다시 열어 확인해 주세요.':'기기 저장 공간과 브라우저 저장 권한을 확인해 주세요.')}
 }
 return <section className="fashion-candidates"><h1>후보함</h1><p className="candidate-storage">스타·상품·키워드를 빠르게 기록해요. 기기에 먼저 저장하고 변경분을 동기화해요.</p>{loading?<p role="status">후보함 불러오는 중…</p>:error?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(v=>v+1)}>다시 시도</button></div>:<QuickBrandNotes records={records} saveRecord={saveRecord}/>}</section>
}
