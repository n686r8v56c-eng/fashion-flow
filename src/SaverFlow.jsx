import React,{useState} from 'react';
import {Instagram,ExternalLink,Link2,Download} from 'lucide-react';
import './saver-flow.css';
import {makeZip} from './zipPhotos.js';
import {compressImageForZip} from './compressImages.js';
import {getCachedPost,saveCachedPost} from './saverCache.js';
const valid=(raw,kind)=>{try{const u=new URL(raw.trim());const h=u.hostname.toLowerCase();return u.protocol==='https:'&&(kind==='instagram'?(h==='instagram.com'||h==='www.instagram.com')&&/^\/(p|reel)\//.test(u.pathname):(['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(h)))}catch{return false}};
function SaverSection(){
 const [apifyImages,setApifyImages]=useState([]),[apifySelected,setApifySelected]=useState([]),[apifyBusy,setApifyBusy]=useState(false),[apifyNotice,setApifyNotice]=useState(''),[images,setImages]=useState([]),[selectedPhotos,setSelectedPhotos]=useState([]),[saving,setSaving]=useState(false),[busy,setBusy]=useState(false),[url,setUrl]=useState(''),[notice,setNotice]=useState('');
 const ok=valid(url,'instagram');
 const loadPhotos=async()=>{setBusy(true);setImages([]);setSelectedPhotos([]);setNotice('사진을 불러오는 중…');try{const r=await fetch('/api/instagram?url='+encodeURIComponent(url.trim()));const data=await r.json();if(!r.ok)throw Error(data.error||'사진을 가져올 수 없어');setImages(data.images||[]);setSelectedPhotos((data.images||[]).map((_,i)=>i));setNotice(data.note||'사진을 불러왔어.')}catch(e){setNotice(e.message||'사진을 불러오지 못했어.')}finally{setBusy(false)}};
 const getBlob=async(src)=>{const r=await fetch(src.startsWith('blob:')?src:'/api/instagram?mode=image&url='+encodeURIComponent(src));if(!r.ok)throw Error('사진 다운로드 실패');return r.blob()};
 const loadApify=async()=>{if(!ok||apifyBusy)return;
  try{const previous=await getCachedPost(url.trim()).catch(()=>null);
   if(previous&&!window.confirm('⚠️ 이전에 Apify로 가져온 게시물입니다. 다시 실행하면 추가 비용이 발생할 수 있어요. 그래도 실행할까요?'))return;
  }catch{}
  setApifyBusy(true);setApifyImages([]);setApifySelected([]);setApifyNotice('Apify에서 사진을 가져오는 중… (수집 비용 발생 가능)');
  try{const r=await fetch('/api/apify-instagram',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:url.trim()})}),data=await r.json();if(!r.ok)throw Error(data.error||'Apify 추출 실패');
   const sources=data.images||[];if(!sources.length)throw Error('가져온 사진이 없어.');
   setApifyImages(sources);setApifySelected(sources.map((_,i)=>i));
   try{await saveCachedPost(url.trim());setApifyNotice(sources.length+'장을 가져왔어. 링크 실행 기록만 저장했어 (사진 원본 저장 안 함).')}catch{setApifyNotice(sources.length+'장을 가져왔지만 실행 기록 저장에 실패했어.')}
  }catch(e){setApifyNotice(e.message||'사진을 불러오지 못했어.')}finally{setApifyBusy(false)}
 };
 const downloadApifyZip=async(compressed=false)=>{
  if(saving||!apifySelected.length)return;
  setSaving(true);setApifyNotice(compressed?'선택한 사진을 압축 중…':'원본 사진을 ZIP으로 묶는 중…');
  try{
    const entries=[];
    for(const i of apifySelected){
      try{
        const blob=await getBlob(apifyImages[i]);
        if(compressed){
          const light=await compressImageForZip(blob);
          entries.push({name:'instagram-photo-'+String(i+1).padStart(2,'0')+'.jpg',data:light});
        }else{
          const ext=blob.type.includes('png')?'png':blob.type.includes('webp')?'webp':'jpg';
          entries.push({name:'instagram-photo-'+String(i+1).padStart(2,'0')+'.'+ext,data:blob});
        }
      }catch(e){console.warn('사진 ZIP 처리 실패',i+1,e)}
    }
    if(!entries.length)throw Error('ZIP에 넣을 수 있는 사진이 없어.');
    const zip=await makeZip(entries),object=URL.createObjectURL(zip),a=document.createElement('a');
    a.href=object;a.download=compressed?'instagram-photos-compressed.zip':'instagram-photos.zip';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(object),30000);
    setApifyNotice(entries.length+'장 '+(compressed?'압축 ZIP':'원본 ZIP')+' 다운로드를 요청했어.'+(entries.length<apifySelected.length?' 일부 사진은 처리할 수 없어 제외했어.':'')+' 사진은 서버에 별도 저장하지 않아.');
  }catch(e){setApifyNotice(e.message||'ZIP 생성 실패')}finally{setSaving(false)}
 };
 const downloadPhoto=async(src,i)=>{try{setNotice('사진 저장 준비 중…');const blob=await getBlob(src);const object=URL.createObjectURL(blob);const a=document.createElement('a');a.href=object;a.download='instagram-photo-'+(i+1)+'.jpg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(object),10000);setNotice('다운로드를 요청했어. 아이폰에서는 파일 앱의 다운로드 폴더도 확인해 줘.')}catch(e){setNotice(e.message)}};
 const downloadSelected=async()=>{if(!selectedPhotos.length||saving)return;setSaving(true);let success=0;for(const i of selectedPhotos){try{const r=await fetch('/api/instagram?mode=image&url='+encodeURIComponent(images[i]));if(!r.ok)continue;const blob=await r.blob();const object=URL.createObjectURL(blob);const a=document.createElement('a');a.href=object;a.download='instagram-photo-'+(i+1)+'.jpg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(object),15000);success++}catch{}}setSaving(false);setNotice(success+'장 다운로드를 요청했어.'+(success<selectedPhotos.length?' 일부 사진은 저장하지 못했어.':'' )+' 아이폰에서는 파일 앱의 다운로드 폴더를 확인해 줘.');};
 return <><section className="saver-panel"><div className="saver-title"><Instagram size={21}/><h3>Instagram Saver</h3></div>
 <label className="saver-label" htmlFor="saver-instagram">게시물 링크</label><div className="saver-input"><Link2 size={17}/><input id="saver-instagram" type="url" inputMode="url" value={url} onChange={e=>{setUrl(e.target.value);setApifyImages([]);setApifySelected([]);setApifyNotice('');setImages([]);setSelectedPhotos([]);setNotice('')}} placeholder="https://www.instagram.com/p/..." /></div>
 <button className="saver-action" type="button" disabled={!ok||busy} onClick={loadPhotos}><Download size={16}/>{busy?'불러오는 중…':'정사각형 사진 가져오기'}</button>
 {images.length>0&&<><div className="saver-select-bar"><strong>{selectedPhotos.length}/{images.length}장 선택</strong><button type="button" onClick={()=>setSelectedPhotos(images.map((_,i)=>i))}>전체 선택</button><button type="button" onClick={()=>setSelectedPhotos([])}>선택 해제</button></div><div className="saver-photos">{images.map((src,i)=><div className="saver-photo" key={src}><label className="saver-photo-check"><input type="checkbox" checked={selectedPhotos.includes(i)} onChange={e=>setSelectedPhotos(old=>e.target.checked?[...old,i]:old.filter(x=>x!==i))}/> 사진 {i+1}</label><img src={'/api/instagram?mode=image&url='+encodeURIComponent(src)} alt={'인스타그램 사진 '+(i+1)}/><button type="button" onClick={()=>downloadPhoto(src,i)}><Download size={15}/> 개별 다운로드</button></div>)}</div><button type="button" className="saver-action" disabled={!selectedPhotos.length||saving} onClick={downloadSelected}><Download size={16}/>{saving?'저장 중…':'선택한 '+selectedPhotos.length+'장 다운로드'}</button></>}
 {url&&!ok&&<p className="saver-warning">올바른 인스타그램 게시물 링크를 입력해 줘.</p>}
 {notice&&<p role="status" className="saver-status">{notice}</p>}
 <p className="saver-note">공개 게시물의 공유용 정사각형 미리보기 사진을 가져와. 여러 장 게시물도 현재는 대표 사진 1장만 확인될 수 있어.</p>
 </section><section className="saver-panel"><div className="saver-title"><h3>Apify · 원본 비율 / 여러 장</h3></div><p className="saver-note">사진 원본은 기기에 보관하지 않고 실행한 게시물 링크만 기록해. 같은 링크를 다시 실행하면 비용 경고를 보여줘.</p><button type="button" className="saver-action" disabled={!ok||apifyBusy} onClick={loadApify}><Download size={16}/>{apifyBusy?'Apify 확인 중…':'Apify로 사진 가져오기'}</button>{apifyNotice&&<p className="saver-status" role="status">{apifyNotice}</p>}{apifyImages.length>0&&<><div className="saver-select-bar"><strong>{apifySelected.length}/{apifyImages.length}장 선택</strong><button type="button" onClick={()=>setApifySelected(apifyImages.map((_,i)=>i))}>전체 선택</button><button type="button" onClick={()=>setApifySelected([])}>선택 해제</button></div><div className="saver-photos">{apifyImages.map((src,i)=><div className="saver-photo" key={src}><label className="saver-photo-check"><input type="checkbox" checked={apifySelected.includes(i)} onChange={e=>setApifySelected(old=>e.target.checked?[...old,i]:old.filter(x=>x!==i))}/> 사진 {i+1}</label><img src={src.startsWith('blob:')?src:'/api/instagram?mode=image&url='+encodeURIComponent(src)} alt={'Apify 사진 '+(i+1)} onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement.dataset.failed='true'}}/><button type="button" onClick={()=>downloadPhoto(src,i)}><Download size={15}/> 개별 다운로드</button></div>)}</div><div className="saver-zip-actions">
<button type="button" className="saver-action" disabled={!apifySelected.length||saving} onClick={()=>downloadApifyZip(false)}><Download size={16}/> 원본 ZIP 다운로드 ({apifySelected.length}장)</button>
<button type="button" className="saver-action saver-compressed" disabled={!apifySelected.length||saving} onClick={()=>downloadApifyZip(true)}><Download size={16}/> 압축 ZIP 다운로드 ({apifySelected.length}장)</button>
</div><p className="saver-note">압축 ZIP은 기기에서 긴 변 최대 1400px·JPEG 품질 약 68%로 변환해 용량을 줄여. 원본 ZIP은 변경하지 않아. 두 다운로드 모두 Apify를 다시 실행하지 않아.</p></>}<p className="saver-note">Cloudflare에 APIFY_ACTOR_ID도 설정해야 작동해. 수집기마다 응답 형식이 달라 첫 테스트 후 조정이 필요할 수 있어.</p><a className="saver-action saver-link" href="https://console.apify.com/" target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Apify 설정 열기</a></section></>
}
export default function SaverFlow(){return <div className="saver-page"><h2>Saver</h2><p className="muted">사진 소스를 한곳에서 관리해.</p><SaverSection/><p className="saver-footer">본인 콘텐츠 또는 저장·사용 허락을 받은 미디어만 다운로드해 줘.</p></div>}
