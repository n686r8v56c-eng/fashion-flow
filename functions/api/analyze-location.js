const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export async function onRequestPost({request,env}){
 if(!env.OPENAI_API_KEY)return respond({error:'Cloudflare에 OPENAI_API_KEY Secret을 설정해 줘.'},503);
 const supabaseUrl=env.VITE_SUPABASE_URL||env.SUPABASE_URL;
 const supabaseKey=env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_ANON_KEY;
 if(!supabaseUrl||!supabaseKey)return respond({error:'서버에 Supabase URL과 공개 키 설정이 필요해.'},503);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!token)return respond({error:'로그인 후 이용해 줘.'},401);
 try{
  const auth=await fetch(new URL('/auth/v1/user',supabaseUrl),{headers:{apikey:supabaseKey,Authorization:'Bearer '+token}});
  if(!auth.ok)return respond({error:'로그인 상태를 확인할 수 없어. 다시 로그인해 줘.'},401);
 }catch{return respond({error:'로그인 확인에 실패했어.'},502)}
 const size=Number(request.headers.get('content-length')||0);
 if(size>3_000_000)return respond({error:'사진 크기가 너무 커. 더 작은 사진을 선택해 줘.'},413);
 let body;try{body=await request.json()}catch{return respond({error:'사진 요청 형식이 올바르지 않아.'},400)}
 const image=body?.image;
 if(typeof image!=='string'||image.length>2_800_000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))return respond({error:'JPG, PNG, WebP 사진을 선택해 줘.'},400);
 const prompt=[
  '다음 사진의 장소와 배경을 한국어로 분석하라. 안전과 정확성을 최우선으로 한다.',
  '사진에 보이는 간판, 장소 표지, 건축물, 배경 단서만 기술하라. 사람이 누구인지 식별하지 마라.',
  '유명 공개 랜드마크 또는 공개 영업장에 분명한 증거가 있을 때만 구체적 장소 후보를 말하라.',
  '주택, 개인의 정확한 소재지, 촬영자 또는 일반인의 현재 위치를 추측하지 마라.',
  '이미지 분석만 했으며 웹 검색이나 GPS 확인은 수행하지 않았다.',
  '확실한 근거가 없으면 지역을 지어내지 말고 미확인이라 말하라.',
  '정확히 이 JSON 형태로만 답하라: {"background":"배경 유형","mood":"장소 분위기","visualClues":["눈에 보이는 단서"],"placeCandidates":["확인 가능한 공개 장소 후보 또는 빈 배열"],"certainty":"낮음/중간/높음","caution":"한계와 확인 필요 사항"}'
 ].join('\n');
 try{
  const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',store:false,max_output_tokens:550,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image,detail:'auto'}]}]})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)return respond({error:res.status===401?'OpenAI API 키 인증을 확인해 줘.':res.status===429?'API 사용량 또는 요금 한도를 확인해 줘.':'사진 AI 분석 실패 ('+res.status+')'},502);
  const output=(data.output||[]).flatMap(item=>item.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
  const cleaned=output.replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
  let result;try{result=JSON.parse(cleaned)}catch{return respond({error:'분석 결과 형식을 해석하지 못했어. 다시 시도해 줘.'},502)}
  return respond({result:{background:String(result.background||'미확인'),mood:String(result.mood||'미확인'),visualClues:Array.isArray(result.visualClues)?result.visualClues.slice(0,6):[],placeCandidates:Array.isArray(result.placeCandidates)?result.placeCandidates.slice(0,3):[],certainty:['낮음','중간','높음'].includes(result.certainty)?result.certainty:'낮음',caution:String(result.caution||'사진만으로 실제 촬영지를 확인할 수 없어.')}});
 }catch{return respond({error:'AI 서비스에 연결할 수 없어.'},502)}
}
