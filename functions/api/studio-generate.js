const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const MODES={model:'photorealistic professional ecommerce model photograph, adult fictional model wearing the supplied garment, full-body or three-quarter clear view, natural realistic fit',lifestyle:'high-end lifestyle fashion editorial with an adult fictional model wearing the supplied garment, naturally posed',flatlay:'ecommerce product-only still life or flat lay with no person, well-lit and accurate shape',lookbook:'premium fashion lookbook editorial with an adult fictional model wearing the supplied garment, elegant creative styling'};
const SCENES={white:'seamless bright white photography studio',warm:'warm cream and beige professional studio',office:'contemporary understated office interior',hotel:'elegant hotel or art gallery interior',resort:'sunlit upscale resort with soft natural light'};
const clean=(val,max=240)=>typeof val==='string'?val.slice(0,max):'';
export async function onRequestPost({request,env}){
 if(!env.OPENAI_API_KEY)return json({error:'OpenAI API Secret 설정이 필요해.'},503);
 const supabaseUrl=env.VITE_SUPABASE_URL||env.SUPABASE_URL,anon=env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_ANON_KEY;
 if(!supabaseUrl||!anon)return json({error:'서버 Supabase 인증 설정이 필요해.'},503);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!token)return json({error:'로그인 후 이용해 줘.'},401);
 try{const response=await fetch(new URL('/auth/v1/user',supabaseUrl),{headers:{apikey:anon,Authorization:'Bearer '+token}});if(!response.ok)return json({error:'로그인 확인에 실패했어.'},401)}catch{return json({error:'인증 서버에 연결하지 못했어.'},502)}
 if(Number(request.headers.get('content-length')||0)>9_000_000)return json({error:'전송할 상품 사진 크기가 너무 커.'},413);
 let form;try{form=await request.formData()}catch{return json({error:'사진 데이터를 읽지 못했어.'},400)}
 const photos=form.getAll('image').filter(x=>x instanceof File);
 if(!photos.length||photos.length>5)return json({error:'참고 사진을 1~5장 넣어 줘.'},400);
 let total=0;
 for(const photo of photos){if(!['image/jpeg','image/png','image/webp'].includes(photo.type)||photo.size>2_400_000)return json({error:'참고 사진은 각각 2.4MB 이하 JPG/PNG/WebP여야 해.'},400);total+=photo.size}
 if(total>7_000_000)return json({error:'사진 총 용량은 7MB 이하로 줄여줘.'},413);
 const mode=clean(form.get('mode'),40),scene=clean(form.get('scene'),40);
 if(!MODES[mode]||!SCENES[scene])return json({error:'생성 모드나 배경이 올바르지 않아.'},400);
 let product={};try{product=JSON.parse(form.get('product')||'{}')}catch{return json({error:'상품 정보 형식이 올바르지 않아.'},400)}
 let roles=[];try{roles=JSON.parse(form.get('roles')||'[]')}catch{return json({error:'사진 유형을 확인할 수 없어.'},400)}
 const detail=['name','category','season','fabric','color','size','fit','measurements'].map(key=>key+': '+(clean(product[key])||'not verified')).join('; ');
 const prompt=[
  'Create exactly ONE professional photorealistic product photography concept image, based on the supplied garment reference photos.',
  'Product information explicitly verified by the user: '+detail+'.',
  'The source images show views and fabric of the SAME physical product. Image order and view labels: '+photos.map((_,i)=>clean(roles[i])||'reference').join(', ')+'.',
  'Keep the garment design as close as possible to the references: neckline, collar, sleeves, placket, button count, hem length, seam lines, print placement, opacity, silhouette, fabric color and visible details. Do not add logos, labels, extra pockets or embellishments.',
  'For views that are not supplied, avoid inventing intricate construction details. If the inputs are ambiguous, favor a neutral simple depiction.',
  'Scene: '+SCENES[scene]+'. Composition: '+MODES[mode]+'.',
  'For model photography, use only an entirely fictional non-identifiable adult model; no resemblance to a real identifiable person or celebrity is requested.',
  'Aim for clean lighting, ecommerce-ready product clarity, luxury editorial aesthetic without text overlays, watermarks or brand marks.',
  'Additional art direction: '+(clean(form.get('notes'),600)||'none')+'.',
  'This is an AI mockup, not evidence of actual fit, textile performance or merchandise specifications.'
 ].join('\n');
 const body=new FormData();body.set('model','gpt-image-1.5');body.set('prompt',prompt);body.set('size','1024x1536');body.set('quality','medium');body.set('output_format','jpeg');body.set('n','1');
 for(const file of photos)body.append('image[]',file,file.name||'item.jpg');
 try{
  const res=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY},body});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){const reason=res.status===401?'OpenAI API 키 인증 확인이 필요해.':res.status===429?'OpenAI API 크레딧 또는 요금 한도를 확인해 줘.':res.status===400?'이미지 형식이나 모델 지원을 확인해 줘.':'AI 이미지 생성 실패 (HTTP '+res.status+')';return json({error:reason},502)}
  const item=data.data?.[0],b64=item?.b64_json;
  if(!b64||typeof b64!=='string')return json({error:'이미지 생성 결과를 받지 못했어.'},502);
  return json({image:'data:image/jpeg;base64,'+b64,model:'gpt-image-1.5'});
 }catch{return json({error:'AI 이미지 생성 서버 연결 실패. 네트워크와 서버 실행 시간을 확인해 줘.'},502)}
}
