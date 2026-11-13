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
  '다음 사진에서 보이는 사람들의 패션·헤어·액세서리 스타일만 한국어로 설명하라. 안전과 정확성을 최우선으로 한다.',
  '인물이 여럿이면 위치(왼쪽/오른쪽 등)로만 구분하라. 상의, 하의, 신발, 안경, 가방, 헤어스타일, 실루엣, 착장 무드를 묘사하라.',
  '누구인지 식별하거나 유명인·실존 인물을 언급하지 마라. 얼굴 유사성·개인 신원·실제 계정을 찾지 마라.',
  '사람들의 실제 관계, 성격, 직업, 나이, 민감한 특성을 추측하지 마라.',
  '사진에서 볼 수 없는 브랜드·소재·품번은 미확인으로 표시하라. 일반적인 공개 패션 콘텐츠 검색어만 만들어라.',
  '검색어는 얼굴이 아닌 옷·스타일 속성으로 한국어 최대 6개 생성하라.',
  '정확히 이 JSON 형태로만 답하라: {"background":"사진 속 스타일 요약","mood":"스타일 무드","visualClues":["눈에 보이는 스타일 단서"],"placeCandidates":["패션 코디 검색어"],"certainty":"낮음/중간/높음","caution":"브랜드·신원은 확인되지 않았다는 한계"}'
 ].join('\n');
 try{
  const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',store:false,max_output_tokens:550,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image,detail:'auto'}]}]})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)return respond({error:res.status===401?'OpenAI API 키 인증을 확인해 줘.':res.status===429?'API 사용량 또는 요금 한도를 확인해 줘.':'인물 스타일 분석 실패 ('+res.status+')'},502);
  const output=(data.output||[]).flatMap(item=>item.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
  const cleaned=output.replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
  let result;try{result=JSON.parse(cleaned)}catch{return respond({error:'분석 결과 형식을 해석하지 못했어. 다시 시도해 줘.'},502)}
  return respond({result:{background:String(result.background||'미확인'),mood:String(result.mood||'미확인'),visualClues:Array.isArray(result.visualClues)?result.visualClues.slice(0,6):[],placeCandidates:Array.isArray(result.placeCandidates)?result.placeCandidates.slice(0,3):[],certainty:['낮음','중간','높음'].includes(result.certainty)?result.certainty:'낮음',caution:String(result.caution||'사진만으로 실제 촬영지를 확인할 수 없어.')}});
 }catch{return respond({error:'AI 서비스에 연결할 수 없어.'},502)}
}
