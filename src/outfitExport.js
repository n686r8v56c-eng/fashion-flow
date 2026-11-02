// Exports the saved free-canvas arrangement rather than a screenshot of the 4-item preview.
const WIDTH=1200,HEIGHT=1356;
async function imageFromUrl(url){
 const response=await fetch(url,{mode:'cors'});
 if(!response.ok)throw new Error('사진을 불러오지 못했습니다. 다시 로그인 후 시도해 주세요.');
 const blob=await response.blob();
 return await new Promise((resolve,reject)=>{
  const objectUrl=URL.createObjectURL(blob),img=new Image();
  img.onload=()=>{URL.revokeObjectURL(objectUrl);resolve(img)};
  img.onerror=()=>{URL.revokeObjectURL(objectUrl);reject(new Error('코디 사진을 읽지 못했습니다.'))};
  img.src=objectUrl;
 });
}
export async function downloadOutfitPng(outfit,items,urls){
 const elements=(outfit.elements||[]).slice().sort((a,b)=>(Number(a.z)||0)-(Number(b.z)||0));
 if(!elements.length)throw new Error('저장된 코디에 아이템이 없습니다.');
 const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('이미지 캔버스를 생성하지 못했습니다.');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,WIDTH,HEIGHT);
 let drawn=0;
 for(const el of elements){
  const item=items.find(i=>i.id===el.item_id);
  const url=item&&urls[item.id];if(!url)continue;
  const image=await imageFromUrl(url);
  // The editor sizes pieces using their intrinsic aspect ratios.
  const w=WIDTH*(Number(el.w??30)/100),h=w*image.naturalHeight/image.naturalWidth;
  const x=WIDTH*(Number(el.x??15)/100),y=HEIGHT*(Number(el.y??8)/100);
  ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate((Number(el.rot)||0)*Math.PI/180);ctx.drawImage(image,-w/2,-h/2,w,h);ctx.restore();drawn++;
 }
 if(!drawn)throw new Error('저장할 수 있는 아이템 사진이 없습니다.');
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG 생성에 실패했습니다.')),'image/png'));
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download=(outfit.title||'fashion-flow-outfit').replace(/[\\/:*?"<>|]/g,'_')+'.png';
 document.body.appendChild(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
