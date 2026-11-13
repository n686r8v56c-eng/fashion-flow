import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Camera,CameraOff,RefreshCcw,Download,Share2,ImagePlus,X,Grid2X2} from 'lucide-react';
import './SceneCameraOverlay.css';

export default function SceneCameraOverlay({reference=''}) {
 const videoRef=useRef(null),streamRef=useRef(null),fileRef=useRef(null),urlRef=useRef('');
 const [enabled,setEnabled]=useState(false),[facing,setFacing]=useState('environment');
 const [opacity,setOpacity]=useState(40),[scale,setScale]=useState(100),[shiftX,setShiftX]=useState(0),[shiftY,setShiftY]=useState(0);
 const [showGuide,setShowGuide]=useState(true),[showGrid,setShowGrid]=useState(false),[custom,setCustom]=useState('');
 const [capture,setCapture]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const guide=custom||reference;
 const close=useCallback(()=>{streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null}setEnabled(false)},[]);
 useEffect(()=>()=>{streamRef.current?.getTracks().forEach(t=>t.stop());if(urlRef.current)URL.revokeObjectURL(urlRef.current)},[]);
 const start=async(nextFacing=facing)=>{
  if(busy)return;
  setBusy(true);setError('');setMessage('');close();
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('이 브라우저에서는 웹 카메라를 사용할 수 없어. HTTPS 아이폰 Safari 또는 지원 브라우저에서 열어줘.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:nextFacing},width:{ideal:1920},height:{ideal:1080}}});
   streamRef.current=stream;
   if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play()}
   setFacing(nextFacing);setEnabled(true);
   stream.getVideoTracks()[0]?.addEventListener('ended',()=>setEnabled(false),{once:true});
  }catch(e){close();setError(e?.name==='NotAllowedError'?'카메라 권한이 거부됐어. 브라우저 사이트 설정에서 카메라 사용을 허용해 줘.':e?.name==='NotFoundError'?'사용할 카메라를 찾지 못했어.':'카메라 시작 실패: '+(e?.message||'알 수 없는 오류'))}
  finally{setBusy(false)}
 };
 const choose=async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(!file.type.startsWith('image/')){setError('사진 파일을 선택해 줘.');return}
  if(file.size>20*1024*1024){setError('20MB 이하 사진을 선택해 줘.');return}
  const url=URL.createObjectURL(file);if(urlRef.current)URL.revokeObjectURL(urlRef.current);urlRef.current=url;setCustom(url);setError('');
 };
 const snap=()=>{
  const video=videoRef.current;
  if(!enabled||!video?.videoWidth||!video.videoHeight){setError('카메라 화면이 준비되지 않았어.');return}
  try{
   // Match the CSS object-fit:cover crop seen through the preview (3:4 frame).
   const container=video.parentElement;
   const viewRatio=(container?.clientWidth||3)/(container?.clientHeight||4);
   const sourceRatio=video.videoWidth/video.videoHeight;
   const sw=sourceRatio>viewRatio?video.videoHeight*viewRatio:video.videoWidth;
   const sh=sourceRatio>viewRatio?video.videoHeight:video.videoWidth/viewRatio;
   const sx=(video.videoWidth-sw)/2,sy=(video.videoHeight-sh)/2;
   const ratio=Math.min(1,2400/Math.max(sw,sh));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(sw*ratio));canvas.height=Math.max(1,Math.round(sh*ratio));
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('촬영 이미지를 만들 수 없어.');
   // The guide and grid never appear in the captured photo.
   if(facing==='user'){ctx.translate(canvas.width,0);ctx.scale(-1,1)}
   ctx.drawImage(video,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
   const data=canvas.toDataURL('image/jpeg',.9);canvas.width=canvas.height=0;
   setCapture(data);setMessage('촬영했어! 저장하거나 공유해 줘. 촬영 사진은 앱에 자동 저장되지 않아.');
   setError('');
  }catch(e){setError(e.message||'촬영에 실패했어.')}
 };
 const fileFromCapture=async()=>{
  const response=await fetch(capture);const blob=await response.blob();
  return new File([blob],`scene-shot-${new Date().toISOString().replace(/[:.]/g,'-')}.jpg`,{type:'image/jpeg'});
 };
 const download=async()=>{if(!capture)return;const file=await fileFromCapture();const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage('파일 저장을 요청했어. 아이폰에서는 파일 앱/다운로드 항목을 확인해 줘.')};
 const share=async()=>{if(!capture)return;try{const file=await fileFromCapture();if(!navigator.share||!navigator.canShare?.({files:[file]}))throw Error('이 브라우저에서는 사진 공유를 지원하지 않아. 파일 저장을 이용해 줘.');await navigator.share({files:[file],title:'SCENE 촬영 사진'});setMessage('공유 시트를 열었어. 사진 앱에 저장하려면 사진 저장 메뉴를 선택해 줘.')}catch(e){if(e.name!=='AbortError')setError(e.message)}};
 return <section className="scene-camera">
  <div className="scene-camera-head"><div><h3>레퍼런스 오버레이 카메라</h3><p>영감 사진을 반투명하게 겹쳐 놓고 인물 위치와 구도를 맞춰봐.</p></div><Camera size={22}/></div>
  <label className="scene-camera-upload"><ImagePlus size={17}/> {guide?'다른 참고 사진 선택':'참고 사진 선택'}<input type="file" accept="image/*" onChange={choose}/></label>
  {!guide&&<p className="scene-camera-note">SCENE 홈에서 영감 사진을 선택하거나 여기에서 사진을 골라줘.</p>}
  <div className="scene-camera-view">
   <video ref={videoRef} autoPlay playsInline muted aria-label="실시간 카메라 화면" className="scene-camera-video" style={{visibility:enabled?'visible':'hidden',transform:facing==='user'?'scaleX(-1)':'none'}}/>
   {!enabled&&<div className="scene-camera-placeholder"><CameraOff size={32}/><span>카메라를 시작하면 이곳에 실시간 화면이 나타나.</span></div>}
   {guide&&showGuide&&<img className="scene-camera-guide" alt="구도 맞추기용 반투명 영감 사진" src={guide} style={{opacity:opacity/100,transform:`translate(${shiftX}%,${shiftY}%) scale(${scale/100})`}}/>}
   {showGrid&&<div className="scene-camera-grid" aria-hidden="true"/>}
  </div>
  <div className="scene-camera-toolbar">
   {!enabled?<button type="button" onClick={()=>start()} disabled={busy}><Camera size={17}/>{busy?'카메라 여는 중…':'카메라 시작'}</button>:<><button type="button" onClick={()=>start(facing==='environment'?'user':'environment')} disabled={busy}><RefreshCcw size={16}/> 전후면</button><button type="button" onClick={close}><X size={16}/> 카메라 끄기</button><button type="button" className="scene-camera-shutter" onClick={snap}><Camera size={18}/> 촬영</button></>}
  </div>
  {guide&&<div className="scene-camera-sliders">
   <label>영감 사진 투명도 <b>{opacity}%</b><input type="range" min="0" max="100" step="5" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label>
   <label>사진 확대/축소 <b>{scale}%</b><input type="range" min="70" max="150" step="5" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label>
   <label>사진 좌우 위치 <b>{shiftX}%</b><input type="range" min="-40" max="40" step="2" value={shiftX} onChange={e=>setShiftX(Number(e.target.value))}/></label>
   <label>사진 상하 위치 <b>{shiftY}%</b><input type="range" min="-40" max="40" step="2" value={shiftY} onChange={e=>setShiftY(Number(e.target.value))}/></label>
   <div className="scene-camera-toolbar"><button type="button" onClick={()=>setShowGuide(x=>!x)}>{showGuide?'가이드 숨기기':'가이드 보이기'}</button><button type="button" onClick={()=>setShowGrid(x=>!x)}><Grid2X2 size={15}/> {showGrid?'격자 끄기':'3×3 격자'}</button></div>
  </div>}
  {capture&&<div className="scene-camera-capture"><h4>방금 찍은 사진</h4><img src={capture} alt="카메라 촬영 결과"/><p>가이드 사진과 격자는 촬영 이미지에 포함되지 않아.</p><div className="scene-camera-toolbar"><button type="button" onClick={share}><Share2 size={16}/> 사진 앱에 저장·공유</button><button type="button" onClick={download}><Download size={16}/> 파일 다운로드</button><button type="button" onClick={()=>{setCapture('');setMessage('')}}>다시 찍기</button></div></div>}
  {error&&<p role="alert" className="scene-camera-error">{error}</p>}
  {message&&<p role="status" className="scene-camera-note">{message}</p>}
  <p className="scene-camera-note">카메라 촬영은 AI 호출이나 API 결제 없이 작동해. 영상·촬영 사진은 서버에 전송하지 않고, 결과는 사용자가 사진 앱·파일로 직접 저장해야 해. 카메라는 이 화면을 벗어나면 중단돼. 일부 iOS 브라우저에서는 카메라 권한·저장 메뉴가 다르게 보일 수 있어.</p>
 </section>;
}
