// Browser-only image compression; no Supabase write and no extra Apify request.
export async function compressImageForZip(blob,{maxDimension=900,quality=0.45}={}){
  if(!blob?.type?.startsWith('image/'))throw new Error('이미지 파일이 아니야.');
  const url=URL.createObjectURL(blob);
  let img=null;
  try{
    img=new Image();
    img.decoding='async';
    img.src=url;
    await new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth){resolve();return;}img.onload=resolve;img.onerror=()=>reject(new Error('이미지를 열 수 없어.'));});
    const w=img.naturalWidth,h=img.naturalHeight;
    if(!w||!h)throw new Error('이미지 크기를 읽을 수 없어.');
    const scale=Math.min(1,maxDimension/Math.max(w,h));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(w*scale));
    canvas.height=Math.max(1,Math.round(h*scale));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('이미지 압축을 지원하지 않는 브라우저야.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const result=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('압축 이미지 생성 실패')),'image/jpeg',quality));
    canvas.width=0;canvas.height=0;
    return result;
  }finally{URL.revokeObjectURL(url)}
}
