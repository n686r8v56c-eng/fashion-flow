import React,{useEffect,useRef,useState} from 'react';
import './ShootGuides.css';

// CDN-loaded and run entirely in the browser. No video frames are uploaded for pose matching.
const CDN='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22';
const MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const CONNECT=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
const NODES=[11,12,13,14,15,16,23,24,25,26,27,28];
const checked=point=>point&&point.visibility!==0&&(point.visibility==null||point.visibility>.48);
const visible=points=>NODES.filter(i=>checked(points?.[i]));
function scorePose(actual,target,mirror=false){
 if(!actual||!target)return null;
 const ids=visible(actual).filter(i=>checked(target[i]));
 if(ids.length<7)return null;
 const center=p=>({x:(p[23].x+p[24].x)/2,y:(p[23].y+p[24].y)/2});
 const norm=p=>Math.hypot(p[11].x-p[12].x,p[11].y-p[12].y)||.1;
 const a=center(actual),b=center(target),na=norm(actual),nb=norm(target);
 const diff=ids.reduce((sum,i)=>{
  const ax=(actual[i].x-a.x)/na,ay=(actual[i].y-a.y)/na;
  const bx=((mirror?1-target[i].x:target[i].x)-(mirror?1-b.x:b.x))/nb,by=(target[i].y-b.y)/nb;
  return sum+Math.min(2,Math.hypot(ax-bx,ay-by));
 },0)/ids.length;
 // Approximate skeletal shape similarity only, not AI certainty or physical accuracy.
 return {percent:Math.round(Math.max(0,100-diff*68)),count:ids.length,
  note:diff<.22?'팔다리 방향이 비슷해':diff<.5?'팔·다리 각도를 조금 조절해 봐':'레퍼런스와 몸 방향을 맞춰 봐'};
}
function overlayPoint(point,frame,videoWidth,videoHeight,mirror){
 const {w,h}=frame;
 if(!videoWidth||!videoHeight)return {x:point.x*w,y:point.y*h};
 const vr=w/h,sr=videoWidth/videoHeight;
 const visibleW=sr>vr?vr/sr:1,visibleH=sr>vr?1:sr/vr;
 const normalizedX=((mirror?1-point.x:point.x)-(1-visibleW)/2)/visibleW;
 const normalizedY=(point.y-(1-visibleH)/2)/visibleH;
 return {x:normalizedX*w,y:normalizedY*h};
}
export function OutfitFrame({mode='off'}){
 if(mode==='off')return null;
 const values={full:{t:7,b:7},half:{t:8,b:35},upper:{t:7,b:47},bag:{t:22,b:26},shoes:{t:51,b:7}};
 const cfg=values[mode]||values.full;
 return <div className="shoot-outfit-overlay" aria-hidden="true">
  <div className="shoot-outfit-guide" style={{top:cfg.t+'%',bottom:cfg.b+'%'}}><div className="shoot-outfit-headmark"/><div className="shoot-outfit-centerline"/><span>{({full:'전신',half:'반신',upper:'상반신',bag:'가방',shoes:'신발'})[mode]} 가이드</span></div>
 </div>;
}
export function PoseGuide({videoRef,frameRef,running,reference,facing,active}){
 const poseRef=useRef(null),cancel=useRef(false),requestRef=useRef(0),prevTime=useRef(0),refPoints=useRef(null);
 const [status,setStatus]=useState('off'),[points,setPoints]=useState(null),[refVisible,setRefVisible]=useState(false),[feedback,setFeedback]=useState(null),[size,setSize]=useState({w:300,h:400}),[error,setError]=useState('');
 useEffect(()=>{if(!active||!running)return;const el=frameRef.current;if(!el)return;const refresh=()=>setSize({w:el.clientWidth||300,h:el.clientHeight||400});refresh();const obs=typeof ResizeObserver!=='undefined'?new ResizeObserver(refresh):null;obs?.observe(el);return()=>obs?.disconnect()},[active,running,frameRef]);
 useEffect(()=>{
  cancel.current=false;
  if(!active||!running){setPoints(null);setFeedback(null);setStatus('off');return}
  let disposed=false;
  async function activate(){
   setStatus('loading');setError('');refPoints.current=null;setRefVisible(false);
   let landmarker;
   try{
    const {FilesetResolver,PoseLandmarker}=await import(/* @vite-ignore */ CDN+'/vision_bundle.mjs');
    if(disposed)return;
    const wasm=await FilesetResolver.forVisionTasks(CDN+'/wasm');
    if(disposed)return;
    landmarker=await PoseLandmarker.createFromOptions(wasm,{baseOptions:{modelAssetPath:MODEL,delegate:'CPU'},runningMode:'IMAGE',numPoses:1,minPoseDetectionConfidence:.45,minPosePresenceConfidence:.45});
    if(disposed){landmarker.close();return}
    poseRef.current=landmarker;
    if(reference){
     const img=new Image();img.src=reference;
     await new Promise((ok,no)=>{if(img.complete&&img.naturalWidth)ok();else{img.onload=ok;img.onerror=()=>no(Error('레퍼런스 사진을 읽지 못했어.'))}});
     if(disposed)return;
     const result=landmarker.detect(img);
     refPoints.current=result.landmarks?.[0]||null;setRefVisible(Boolean(refPoints.current));
    }
    await landmarker.setOptions({runningMode:'VIDEO'});
    if(disposed)return;
    setStatus('ready');
    const loop=async time=>{
     if(disposed||cancel.current)return;
     requestRef.current=requestAnimationFrame(loop);
     if(time-prevTime.current<230)return;
     const video=videoRef.current;
     if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight)return;
     prevTime.current=time;
     try{
      const detected=landmarker.detectForVideo(video,time);
      const list=detected.landmarks?.[0]||null;
      setPoints(list);
      if(refPoints.current&&list){
       const normal=scorePose(list,refPoints.current,false);
       const mirrored=scorePose(list,refPoints.current,true);
       setFeedback(normal&&mirrored?(normal.percent>=mirrored.percent?normal:mirrored):normal||mirrored);
      }else setFeedback(null);
     }catch(e){setError('포즈 감지를 계속할 수 없어: '+e.message);cancel.current=true;setStatus('error')}
    };
    requestRef.current=requestAnimationFrame(loop);
   }catch(e){if(!disposed){setError('포즈 모델을 불러오지 못했어. 네트워크·기기 성능을 확인해 줘. '+(e.message||''));setStatus('error')}}
  }
  activate();
  return()=>{disposed=true;cancel.current=true;cancelAnimationFrame(requestRef.current);const current=poseRef.current;poseRef.current=null;try{current?.close()}catch{}};
 },[active,running,reference,videoRef]);
 if(!active)return null;
 const vw=videoRef.current?.videoWidth||0,vh=videoRef.current?.videoHeight||0;
 const p=points;
 const markers=i=>overlayPoint(p[i],size,vw,vh,facing==='user');
 return <>
  {p&&<svg className="shoot-pose-skeleton" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none" aria-hidden="true">
   {CONNECT.filter(([a,b])=>checked(p[a])&&checked(p[b])).map(([a,b])=>{const x=markers(a),y=markers(b);return <line key={a+'-'+b} x1={x.x} y1={x.y} x2={y.x} y2={y.y} stroke="#b7f5cf" strokeWidth="3.5" strokeLinecap="round"/>})}
   {NODES.filter(i=>checked(p[i])).map(i=>{const x=markers(i);return <circle key={i} cx={x.x} cy={x.y} r="5.5" stroke="white" strokeWidth="2" fill="#6fc6a0"/>})}
  </svg>}
  <div className="shoot-pose-status" role="status">{status==='loading'?'포즈 모델 다운로드 중…':status==='error'?'포즈 인식 오류':!p?'사람 전신이 보이게 맞춰줘':feedback?<><b>포즈 유사도 약 {feedback.percent}%</b> · {feedback.note}</>:refVisible?'실시간 포즈 감지 중':'관절 추적 중 · 레퍼런스 포즈는 미확인'}</div>
  {error&&<div className="shoot-pose-error">{error}</div>}
 </>;
}
function luminance(r,g,b){return .2126*r+.7152*g+.0722*b}
export function measureLight(video){
 if(!video||!video.videoWidth||!video.videoHeight)throw Error('카메라 영상이 준비되지 않았어.');
 const c=document.createElement('canvas');c.width=96;c.height=72;
 const context=c.getContext('2d',{willReadFrequently:true});
 context.drawImage(video,0,0,96,72);const d=context.getImageData(0,0,96,72).data;
 const bands=[0,0,0],counts=[0,0,0];let dark=0,bright=0,total=0;
 for(let y=0;y<72;y+=2)for(let x=0;x<96;x+=2){const i=(y*96+x)*4,lum=luminance(d[i],d[i+1],d[i+2]);const band=Math.floor(x/32);bands[band]+=lum;counts[band]++;total+=lum;if(lum<45)dark++;if(lum>230)bright++}
 const samples=48*36,avg=Math.round(total/samples),third=bands.map((v,i)=>Math.round(v/counts[i]));
 let description=avg<72?'화면 전체가 어두운 편이야':avg>195?'화면 전체가 밝은 편이야':'전체 밝기가 중간 정도야';
 if(bright/samples>.15)description+=' · 과도하게 밝은 영역이 일부 있어.';
 if(dark/samples>.2)description+=' · 어두운 영역이 많아.';
 const strongest=third.indexOf(Math.max(...third)),weakest=third.indexOf(Math.min(...third));
 const contrast=Math.max(...third)-Math.min(...third);
 return {avg,left:third[0],center:third[1],right:third[2],contrast,description,tip:contrast>32?`화면 ${['왼쪽','가운데','오른쪽'][strongest]}이 더 밝아. 피사체를 조금 돌려 얼굴과 옷의 빛을 확인해 봐.`:'좌우 밝기 차이가 크지 않아. 필요하면 창가 또는 광원 방향을 바꿔 봐.',caution:'이 값은 카메라 화면의 대략적인 밝기 분포야. 실제 조명 방향·강도·색온도를 정확하게 측정한 것은 아니야.'};
}
