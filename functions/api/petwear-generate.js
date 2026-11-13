const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(v,max=250)=>typeof v==='string'?v.slice(0,max):'';
const scenes={white:'bright seamless white photography studio',beige:'warm soft beige photo studio',living:'comfortable stylish living room sofa',park:'sunlit park walking path',cafe:'pet-friendly lifestyle cafe',winter:'beautiful natural winter outdoor setting',boutique:'premium dog fashion boutique studio'};
const styles={model:'professional photorealistic commercial pet clothing model shot with the garment worn by a realistic fictional domestic pet',lifestyle:'natural commercial pet fashion editorial lifestyle scene with realistic animal wearing the garment',product:'product-only photograph of the clothing without any animal or person, clearly showing the garment as a standalone product',detail:'close-up fashion product still life emphasizing photographed fabric and hardware details without inventing unseen features'};
export async function onRequestPost({request,env}){
 if(!env.OPENAI_API_KEY)return response({error:'Cloudflare OPENAI_API_KEY Secret 설정이 필요해.'},503);
 const url=env.VITE_SUPABASE_URL||env.SUPABASE_URL,key=env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_ANON_KEY;
 if(!url||!key)return response({error:'Supabase 서버 인증 설정을 확인해 줘.'},503);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!token)return response({error:'로그인이 필요해.'},401);
 try{const auth=await fetch(new URL('/auth/v1/user',url),{headers:{apikey:key,Authorization:'Bearer '+token}});if(!auth.ok)return response({error:'로그인 인증에 실패했어.'},401)}catch{return response({error:'인증 서버 연결 실패.'},502)}
 if(Number(request.headers.get('content-length')||0)>9_000_000)return response({error:'사진 총 용량이 너무 커.'},413);
 let form;try{form=await request.formData()}catch{return response({error:'상품 사진 요청을 읽지 못했어.'},400)}
 const images=form.getAll('image').filter(f=>f instanceof File);
 if(!images.length||images.length>5||images.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>2400000))return response({error:'JPG/PNG/WebP 상품 사진 1~5장(각 2.4MB 이하)이 필요해.'},400);
 if(images.reduce((sum,f)=>sum+f.size,0)>7000000)return response({error:'상품 사진 총합은 7MB 이하여야 해.'},413);
 const type=clean(form.get('type'),30),scene=clean(form.get('background'),30);
 if(!styles[type]||!scenes[scene])return response({error:'생성 종류나 배경이 올바르지 않아.'},400);
 let product={};try{product=JSON.parse(form.get('product')||'{}')}catch{return response({error:'상품 정보가 올바르지 않아.'},400)}
 const breed=clean(form.get('breed'),50),size=clean(form.get('size'),40),coat=clean(form.get('coat'),30),pose=clean(form.get('pose'),30);
 let roles=[];try{roles=JSON.parse(form.get('roles')||'[]')}catch{return response({error:'사진 종류 형식이 올바르지 않아.'},400)}
 const fields=['name','category','season','color','material','backLength','chest','neck','closure','belly','legCoverage','harness'].map(k=>k+': '+(clean(product[k])||'unverified')).join('; ');
 const prompt=[
  'Generate one professional photorealistic ecommerce petwear product image using the source photos as clothing references. This is an AI concept, not a real fit test.',
  'Garment details verified by the user: '+fields+'. Photo reference order: '+images.map((_,i)=>clean(roles[i])||'reference').join(', ')+'.',
  'Preserve the observable fabric print, color, construction, neckline, sleeve/leg openings, straps, hardware, closure, seams, trim and coverage as closely as possible. Avoid inventing logos or adding accessories not shown.',
  'Mode: '+styles[type]+'. Background: '+scenes[scene]+'.',
  'For pet-wearing shots, use a fictional realistic '+(breed||'dog')+' of '+(size||'unspecified size')+', '+(coat||'unspecified')+' coat length; pose: '+(pose||'standing')+'.',
  'No anthropomorphic human hands or anatomy. Ensure dog body and the garment have plausible proportions. Do not misrepresent physical safety or fit validation.',
  'If measurements, breed fit, belly opening or closure are not confirmed, do not create text asserting them or treat them as validated.',
  'Extra composition notes: '+(clean(form.get('direction'),400)||'none')+'.',
  'High quality clean commercial pet fashion photography. No text, no watermark.'
 ].join('\n');
 const body=new FormData();body.set('model','gpt-image-1.5');body.set('prompt',prompt);body.set('size','1024x1536');body.set('quality','medium');body.set('output_format','jpeg');body.set('n','1');
 for(const f of images)body.append('image[]',f,f.name||'pet-product.jpg');
 try{const res=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY},body});
 const result=await res.json().catch(()=>({}));
 if(!res.ok)return response({error:res.status===429?'API 크레딧·사용량 한도를 확인해 줘.':res.status===401?'API 키 인증을 확인해 줘.':'펫 모델컷 생성 실패 (HTTP '+res.status+')'},502);
 const b64=result.data?.[0]?.b64_json;if(!b64)return response({error:'AI 이미지 결과가 비어 있어.'},502);
 return response({image:'data:image/jpeg;base64,'+b64,model:'gpt-image-1.5'})
 }catch{return response({error:'AI 이미지 생성 서버에 연결하지 못했어.'},502)}
}
