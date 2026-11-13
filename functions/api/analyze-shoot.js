const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const str=(value,max=600)=>typeof value==='string'?value.slice(0,max):'';
const rows=(value,limit=8)=>Array.isArray(value)?value.filter(x=>typeof x==='string').slice(0,limit).map(x=>x.slice(0,200)):[];
export async function onRequestPost({request,env}){
 if(!env.OPENAI_API_KEY)return respond({error:'Cloudflare에 OPENAI_API_KEY Secret을 설정해 줘.'},503);
 const supabaseUrl=env.VITE_SUPABASE_URL||env.SUPABASE_URL;
 const supabaseKey=env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_ANON_KEY;
 if(!supabaseUrl||!supabaseKey)return respond({error:'서버 Supabase 설정을 확인해 줘.'},503);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!token)return respond({error:'로그인이 필요해.'},401);
 try{const auth=await fetch(new URL('/auth/v1/user',supabaseUrl),{headers:{apikey:supabaseKey,Authorization:'Bearer '+token}});if(!auth.ok)return respond({error:'로그인 상태를 확인할 수 없어. 다시 로그인해 줘.'},401)}catch{return respond({error:'로그인 확인에 실패했어.'},502)}
 if(Number(request.headers.get('content-length')||0)>3_000_000)return respond({error:'사진이 너무 커. 축소해서 다시 올려줘.'},413);
 let body;try{body=await request.json()}catch{return respond({error:'사진 요청 형식이 올바르지 않아.'},400)}
 const picture=body?.image;
 if(typeof picture!=='string'||picture.length>2_800_000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(picture))return respond({error:'JPG, PNG 또는 WebP 사진을 선택해 줘.'},400);
 const prompt=[
  '너는 인물과 장소의 신원이 아니라 사진 촬영의 시각적 구성만 분석하는 사진 연출 전문가다. 한국어 JSON 하나로만 답하라.',
  '사진에 실제로 보이는 것과 촬영을 위한 재현 제안/추정을 명확히 분리하라.',
  '구도: 전신/반신/클로즈업, 피사체 위치, 여백, 화면 방향, 시점 단서와 촬영 방법을 분석하라.',
  '포즈: 눈에 보이는 몸 방향, 손, 발, 시선, 소품 위치만 묘사하고 재현 단계는 제안으로 분리하라.',
  '빛: 그림자, 창, 광원 등 관찰 가능한 단서와 자연광/역광/측광 같은 추정을 구분하라. 실제 날씨/시간대/촬영 위치를 확정하지 마라.',
  '카메라 기종, 렌즈 초점거리, 정확한 촬영 시간·방위각, 실제 사람의 신원·관계·사생활을 추정하지 마라.',
  '촬영 컷 리스트 3~6개를 실용적으로 제안하라. 사진에 없는 소품/장면을 추가하면 반드시 연출 제안으로 표시하라.',
  '정확히 다음 키 구조의 JSON만 출력: {"summary":"촬영 구상 요약","observations":["사진에서 실제 보이는 사실"],"composition":{"observed":"보이는 구도","tips":"재현을 위한 카메라 높이·시점·프레이밍 제안"},"pose":{"observed":"보이는 포즈","tips":"재현 방법 제안"},"light":{"observed":"관찰된 빛 단서","tips":"광원·시간대·촬영 조건 제안"},"shots":[{"title":"컷 이름","description":"찍을 장면","framing":"구도 제안","pose":"포즈 제안","light":"빛 제안","props":"준비물 제안"}],"uncertainties":["사진만으로 확정할 수 없는 정보"]}'
 ].join('\n');
 try{
  const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',store:false,max_output_tokens:1800,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:picture,detail:'auto'}]}]})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)return respond({error:res.status===401?'OpenAI API 키 인증을 확인해 줘.':res.status===429?'API 사용량·크레딧·요금 한도를 확인해 줘.':'촬영 AI 분석 실패 (HTTP '+res.status+')'},502);
  const output=(data.output||[]).flatMap(v=>v.content||[]).filter(v=>v.type==='output_text').map(v=>v.text).join('\n');
  let parsed;try{parsed=JSON.parse(output.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,'').trim())}catch{return respond({error:'분석 결과 형식을 읽지 못했어. 다시 시도해 줘.'},502)}
  const section=obj=>({observed:str(obj?.observed),tips:str(obj?.tips)});
  return respond({result:{summary:str(parsed.summary),observations:rows(parsed.observations),composition:section(parsed.composition),pose:section(parsed.pose),light:section(parsed.light),shots:Array.isArray(parsed.shots)?parsed.shots.slice(0,6).map(x=>({title:str(x?.title,120),description:str(x?.description,260),framing:str(x?.framing,200),pose:str(x?.pose,200),light:str(x?.light,200),props:str(x?.props,200)})):[],uncertainties:rows(parsed.uncertainties,6)}});
 }catch{return respond({error:'촬영 AI 서비스에 연결하지 못했어.'},502)}
}
