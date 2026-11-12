import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {LogOut,Settings,HardDrive,RefreshCw} from 'lucide-react';
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
export const formatBytes=n=>Number.isFinite(n)?(n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB'):'확인 불가';
async function inspectStorage(){
 const estimate=typeof navigator.storage?.estimate==='function'?await navigator.storage.estimate():{};
 const names=typeof indexedDB.databases==='function'?(await indexedDB.databases()).map(d=>d.name).filter(Boolean):[];
 const known=['closet-checklist-photos-v1','fashion-closet-inbox-v1',...names.filter(n=>n.startsWith('fashion-'))];
 const unique=[...new Set(known)];
 const rows=await Promise.all(unique.map(name=>new Promise(resolve=>{let created=false;const request=indexedDB.open(name);request.onupgradeneeded=()=>{created=true;request.transaction.abort()};request.onerror=()=>resolve(null);request.onsuccess=()=>{const db=request.result;if(created){db.close();resolve(null);return}const stores=Array.from(db.objectStoreNames);if(!stores.length){db.close();resolve(null);return}const tx=db.transaction(stores,'readonly');let count=0;stores.forEach(store=>{const req=tx.objectStore(store).count();req.onsuccess=()=>{count+=req.result}});tx.oncomplete=()=>{db.close();resolve({name,count})};tx.onerror=()=>{db.close();resolve(null)}}})));
 return {estimate,rows:rows.filter(Boolean)};
}
function SyncStatus({compact=false,onLogout}){
 const engine=useContext(Context),[status,setStatus]=useState(engine.getStatus()),[details,setDetails]=useState(false),[notice,setNotice]=useState(''),[storageOpen,setStorageOpen]=useState(false),[storage,setStorage]=useState(null),[storageBusy,setStorageBusy]=useState(false);
 async function refreshStorage(){setStorageBusy(true);try{setStorage(await inspectStorage());setNotice('')}catch(e){setNotice('저장공간 조회 실패: '+e.message)}finally{setStorageBusy(false)}}
 useEffect(()=>engine.subscribe(()=>setStatus(engine.getStatus())),[engine]);
 const labels={local:'기기에 저장됨',offline:'오프라인 · 기기에 저장됨',syncing:'동기화 중…',synced:'동기화 완료',setup:'동기화 설정 필요',error:'동기화 재시도 필요'};
 const text=status.conflicts?'다른 기기 수정 확인 필요':status.pending&&status.phase==='synced'?'전송 대기':labels[status.phase];
 async function exportBackup(){try{const rows=await engine.exportAll(),blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),records:await encodeBlobs(rows)})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fashion-local-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}catch(e){setNotice(e.message)}}
 if(compact)return <div className="local-sync-account"><button type="button" className="iconbtn" title="설정" aria-label="설정" aria-expanded={details} onClick={()=>setDetails(v=>!v)}><Settings size={18}/>{(status.pending>0||status.conflicts>0||['error','offline','setup'].includes(status.phase))&&<span className="sync-indicator" aria-hidden="true"/>}</button>{details&&<><div className="local-sync-dismiss" onClick={()=>setDetails(false)}/><div className="local-sync-popover" role="dialog" aria-label="계정 및 동기화"><div className="local-sync-popover-heading"><strong>설정 · 동기화</strong><button type="button" onClick={()=>setDetails(false)} aria-label="메뉴 닫기">×</button></div><p role="status">{text}{status.pending?' · '+status.pending+'개 대기':''}</p><button type="button" onClick={()=>{window.dispatchEvent(new Event('fashion-manual-sync'));engine.sync()}} disabled={status.phase==='syncing'}>지금 동기화</button><p>{status.lastSync?'마지막 동기화 '+new Date(status.lastSync).toLocaleString('ko-KR'):'아직 서버 전송이 완료되지 않았어요.'}</p><p>다른 기기로 옮기기 전 동기화 완료를 확인해 주세요.</p>{status.message&&<p role="alert">{status.message}</p>}{status.phase==='setup'&&<><p>Supabase 동기화 설정이 필요해요.</p><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(setupSql);setNotice('설정 SQL을 복사했어요.')}catch{setNotice('SQL 복사에 실패했어요.')}}}>설정 SQL 복사</button><a href={'https://supabase.com/dashboard/project/'+new URL(engine.projectUrl).hostname.split('.')[0]+'/sql/new'} target="_blank" rel="noopener noreferrer">SQL Editor 열기</a><details><summary>설정 SQL 보기</summary><textarea readOnly value={setupSql}/></details></>}{status.conflicts>0&&<button type="button" onClick={()=>engine.resolveConflicts()}>내 기록 복사 후 최신 받기</button>}<button type="button" onClick={()=>{setStorageOpen(v=>!v);if(!storageOpen)refreshStorage()}}><HardDrive size={16}/> 저장공간 관리</button>{storageOpen&&<div className="fashion-storage-panel"><div className="fashion-storage-heading"><strong>이 기기의 저장공간</strong><button type="button" disabled={storageBusy} onClick={refreshStorage}><RefreshCw size={14}/> 새로고침</button></div>{storageBusy?<p>저장공간 확인 중…</p>:storage&&<><p>이 사이트 사용량: <b>{formatBytes(storage.estimate.usage)}</b></p><p>브라우저 할당량: {formatBytes(storage.estimate.quota)}</p><p className="fashion-storage-note">브라우저 추정치이며 IndexedDB·캐시 등을 포함할 수 있어요. Supabase 서버 저장량은 포함되지 않아요.</p>{storage.rows.length>0&&<details><summary>로컬 데이터베이스별 기록 수</summary>{storage.rows.map(row=><p key={row.name}>{row.name}: {row.count}개</p>)}<p>기록 수는 파일 용량이 아니에요.</p></details>}</>}<p className="fashion-storage-warning">사진과 체크리스트 원본이 이 기기에만 있을 수 있어요. iPhone 설정에서 웹사이트 데이터 전체 삭제는 기록 손실 위험이 있으니 하지 마세요.</p><p>공간을 줄이려면 앱에서 불필요한 사진·항목을 개별 삭제하고, 삭제 전 백업과 동기화 상태를 확인해 주세요.</p></div>}<button type="button" onClick={exportBackup}>기기 자료 백업 다운로드</button>{notice&&<p role="status">{notice}</p>}<button type="button" className="local-sync-logout" onClick={onLogout}><LogOut size={16}/> 로그아웃</button></div></>}</div>;
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
