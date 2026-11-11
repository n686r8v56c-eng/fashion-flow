import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {createSyncEngine} from './engine.js';
import {createAssetCodec} from './assets.js';
import setupSql from '../../supabase/local-sync.sql?raw';
import './sync.css';
const Context=createContext(null);
export function LocalSyncProvider({userId,client,children}){
 const [engine,setEngine]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let cancelled=false,current;setEngine(null);setError('');
  const dbName='fashion-local-sync-v1-'+new URL(client.supabaseUrl).hostname;
  createSyncEngine({client,userId,dbName,...createAssetCodec(client,userId)}).then(value=>{value.projectUrl=client.supabaseUrl;current=value;if(cancelled)value.close();else setEngine(value)}).catch(e=>{if(!cancelled)setError(e.message)});
  return()=>{cancelled=true;current?.close()};
 },[userId,client]);
 useEffect(()=>{if(!engine)return;let timer,lastCheck=0;
  const check=(force=false)=>{if(document.visibilityState==='hidden')return;if(!force&&Date.now()-lastCheck<60000)return;lastCheck=Date.now();engine.sync()};
  const changed=engine.subscribe(()=>{const s=engine.getStatus();if((s.phase==='local'||s.phase==='synced')&&s.pending>s.conflicts){clearTimeout(timer);timer=setTimeout(()=>check(true),2000)}});
  const focus=()=>check(),online=()=>check(true);check(true);
  const interval=setInterval(focus,5*60*1000);window.addEventListener('focus',focus);window.addEventListener('online',online);document.addEventListener('visibilitychange',focus);
  return()=>{clearTimeout(timer);clearInterval(interval);changed();window.removeEventListener('focus',focus);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',focus)};
 },[engine]);
 if(error)return <div className="setup"><p role="alert">기기 저장소를 열지 못했어요: {error}</p><p>기존 자료는 지우지 않았어요. 다른 탭을 닫고 새로고침해 주세요.</p></div>;
 if(!engine||engine.userId!==userId)return <div className="setup">기기 자료 확인 중…</div>;
 return <Context.Provider value={engine}>{children}</Context.Provider>;
}
export function useLocalCollection(collection){
 const engine=useContext(Context);if(!engine)throw Error('LocalSyncProvider가 필요해요.');
 return useMemo(()=>({read:()=>engine.list(collection),write:row=>engine.save(collection,row),writeBatch:rows=>engine.saveBatch(collection,rows),remove:id=>engine.remove(collection,id),subscribe:listener=>engine.subscribe(listener)}),[engine,collection]);
}
export function SyncStatus(){
 const engine=useContext(Context),[status,setStatus]=useState(engine.getStatus()),[details,setDetails]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>engine.subscribe(()=>setStatus(engine.getStatus())),[engine]);
 const labels={local:'기기에 저장됨',offline:'오프라인 · 기기에 저장됨',syncing:'동기화 중…',synced:'동기화 완료',setup:'동기화 설정 필요',error:'동기화 재시도 필요'};
 const text=status.conflicts?'다른 기기 수정 확인 필요':status.pending&&status.phase==='synced'?'전송 대기':labels[status.phase];
 async function exportBackup(){try{const rows=await engine.exportAll(),blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),records:await encodeBlobs(rows)})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fashion-local-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}catch(e){setNotice(e.message)}}
 return <div className="local-sync"><span role="status">{text}{status.pending?' · '+status.pending+'개 대기':''}</span><button type="button" onClick={()=>{window.dispatchEvent(new Event('fashion-manual-sync'));engine.sync()}} disabled={status.phase==='syncing'}>지금 동기화</button><button type="button" onClick={()=>setDetails(!details)} aria-expanded={details}>상태</button>
  {details&&<div className="local-sync-details"><p>{status.lastSync?'마지막 동기화 '+new Date(status.lastSync).toLocaleString('ko-KR'):'아직 서버 전송이 완료되지 않았어요.'}</p><p>후보함·수집·상품은 기기에 먼저 저장돼요. 다른 기기로 옮기기 전 ‘동기화 완료’를 확인해 주세요.</p>
   {status.message&&<p role="alert">{status.message}</p>}
   {status.phase==='setup'&&<><p>패션 프로젝트 SQL Editor에서 아래 설정을 한 번 실행한 뒤 ‘지금 동기화’를 눌러 주세요.</p><button onClick={async()=>{try{await navigator.clipboard.writeText(setupSql);setNotice('설정 SQL을 복사했어요.')}catch{setNotice('아래 SQL을 선택해서 복사해 주세요.')}}}>설정 SQL 복사</button><a href={'https://supabase.com/dashboard/project/'+new URL(engine.projectUrl).hostname.split('.')[0]+'/sql/new'} target="_blank" rel="noopener noreferrer">SQL Editor 열기</a><details><summary>설정 SQL 보기</summary><textarea readOnly value={setupSql} aria-label="동기화 설정 SQL"/></details></>}
   {status.conflicts>0&&<><p>같은 기록을 두 기기에서 수정했어요. 기기 기록을 별도 복사본으로 보존하고 서버 최신 기록을 받을 수 있어요.</p><button onClick={()=>engine.resolveConflicts()}>내 기록 복사 후 최신 받기</button></>}
   <button onClick={exportBackup}>기기 자료 백업 다운로드</button>{notice&&<p role="status">{notice}</p>}
  </div>}
 </div>;
}
async function encodeBlobs(value){if(value instanceof Blob)return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({__blobDataUrl:r.result});r.onerror=()=>reject(r.error);r.readAsDataURL(value)});if(Array.isArray(value))return Promise.all(value.map(encodeBlobs));if(value&&typeof value==='object'){const result={};for(const [k,v] of Object.entries(value))result[k]=await encodeBlobs(v);return result}return value}
