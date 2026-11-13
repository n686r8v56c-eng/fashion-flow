import React,{useEffect,useRef,useState} from 'react';
import {ImagePlus,ScanSearch,Download,ExternalLink,Bookmark,Trash2,RotateCcw,Check} from 'lucide-react';
import './FashionFinder.css';
import PriceTracker from './PriceTracker.jsx';

const bounds=(n)=>Math.max(0,Math.min(1,n));
function cropBlob(img,box){
  const width=img.naturalWidth,height=img.naturalHeight;
  const sx=Math.round(box.x*width),sy=Math.round(box.y*height);
  const sw=Math.max(1,Math.round(box.w*width)),sh=Math.max(1,Math.round(box.h*height));
  const scale=Math.min(1,1600/Math.max(sw,sh));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));
  canvas.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('이미지 저장에 실패했어.')),'image/jpeg',.86));
}
export default function FashionFinder({photoOnly=false}){
  const [original,setOriginal]=useState('');
  const [fileName,setFileName]=useState('');
  const [selection,setSelection]=useState({x:0,y:0,w:1,h:1});
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [title,setTitle]=useState('');
  const image=useRef(null),drag=useRef(null),input=useRef(null);
  useEffect(()=>()=>{if(original)URL.revokeObjectURL(original)},[original]);
  function choose(e){
    const file=e.target.files?.[0];if(!file)return;
    if(!file.type.startsWith('image/')){setError('이미지 파일만 선택해줘.');return}
    if(file.size>25*1024*1024){setError('25MB 이하 이미지를 선택해줘.');return}
    setError('');setFileName(file.name);setTitle(file.name.replace(/\.[^.]+$/,''));
    setSelection({x:0,y:0,w:1,h:1});setOriginal(URL.createObjectURL(file));
    e.target.value='';
  }
  function position(e){
    const rect=image.current.getBoundingClientRect();
    return {x:bounds((e.clientX-rect.left)/rect.width),y:bounds((e.clientY-rect.top)/rect.height)};
  }
  function down(e){
    if(!image.current||!original)return;
    const p=position(e);drag.current=p;setSelection({x:p.x,y:p.y,w:0,h:0});
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e){
    if(!drag.current)return;const p=position(e),s=drag.current;
    setSelection({x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),w:Math.abs(p.x-s.x),h:Math.abs(p.y-s.y)});
  }
  function up(){
    if(!drag.current)return;drag.current=null;
    setSelection(p=>p.w<.015||p.h<.015?{x:0,y:0,w:1,h:1}:p);
  }
  async function saveCrop(){
    if(!image.current||!original)return;
    setBusy(true);setError('');
    try{
      const box=selection.w<.015||selection.h<.015?{x:0,y:0,w:1,h:1}:selection;
      const blob=await cropBlob(image.current,box);
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download=(title.trim()||'fashion-crop')+'.jpg';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){setError('사진 저장 오류: '+e.message)}
    finally{setBusy(false)}
  }
  return <section className="finder">
    {photoOnly ? <>
    <div className="finder-head"><h1>사진 검색 · 크롭</h1></div>
    <div className="finder-lens-buttons">
      <a className="finder-primary" href="https://lens.google/" target="_blank" rel="noopener noreferrer"><ScanSearch size={18}/> Google Lens <ExternalLink size={15}/></a>
      <a className="finder-primary finder-naver" href="https://m.naver.com/" target="_blank" rel="noopener noreferrer"><ScanSearch size={18}/> 네이버 스마트렌즈 <ExternalLink size={15}/></a>
    </div>
    <p className="finder-hint">검색 버튼에서 직접 사진을 선택해줘. 네이버는 앱에서 스마트렌즈를 실행해야 할 수 있어.</p>
    <h2>사진 크롭 · 기기에 저장</h2>
    <label className="finder-upload"><ImagePlus size={21}/><span>사진 선택</span><input ref={input} type="file" accept="image/*" onChange={choose}/></label>
    {original?<div className="finder-workspace">
      <p className="finder-hint">필요한 부분을 손가락으로 드래그해 선택하고 바로 저장해.</p>
      <div className="finder-image-wrap" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img ref={image} src={original} draggable="false" alt="검색할 패션 사진"/>
        <span className="finder-selection" style={{left:(selection.x*100)+'%',top:(selection.y*100)+'%',width:(selection.w*100)+'%',height:(selection.h*100)+'%'}}/>
      </div>
      <div className="finder-action-row">
        <button type="button" className="finder-secondary" onClick={()=>setSelection({x:0,y:0,w:1,h:1})}><RotateCcw size={16}/> 전체 선택</button>
        <input aria-label="검색 기록 이름" value={title} onChange={e=>setTitle(e.target.value)} placeholder="이 옷 이름"/>
      </div>
      <button type="button" className="finder-primary finder-download" disabled={busy} onClick={saveCrop}><Download size={16}/>{busy?'저장 중…':'크롭 사진 저장'}</button>
      <p className="finder-hint">사진은 서버나 IndexedDB에 저장하지 않아. 크롭 결과만 기기로 내려받아. iPhone에서는 저장된 파일을 사진 앱으로 옮겨야 할 수 있어.</p>
    </div>:<div className="finder-empty">먼저 인스타그램·쇼핑몰·코디 사진을 선택해줘.</div>}
    {error&&<p role="alert" className="finder-error">{error}</p>}
    </> : <>
      <form className="finder-keyword-search" action="https://search.shopping.naver.com/search/all" method="get" target="_blank" role="search">
        <label htmlFor="finder-keyword">네이버 쇼핑 검색</label>
        <div className="finder-keyword-row">
          <input id="finder-keyword" name="query" type="search" required placeholder="예: 경량패딩" autoComplete="off" aria-label="네이버 쇼핑 상품 검색어"/>
          <button type="submit"><ScanSearch size={17}/> 검색</button>
        </div>
      </form>
      <PriceTracker/>
    </>}
  </section>;
}
