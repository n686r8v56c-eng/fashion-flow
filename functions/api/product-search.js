// Cloudflare Pages Function: authenticated NAVER Shopping keyword lookup.
// Keep NAVER_CLIENT_ID / NAVER_CLIENT_SECRET in Cloudflare server-side secrets only.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const clean=value=>String(value??'').replace(/<[^>]+>/g,'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&#x27;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;/gi,' ').trim();
const httpsUrl=value=>{try{const u=new URL(String(value||''));return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
export async function onRequestGet({request,env}){
  const query=(new URL(request.url).searchParams.get('query')||'').trim();
  if(query.length<2||query.length>100)return json({error:'검색어는 2~100자로 입력해줘.'},400);
  const id=env.NAVER_CLIENT_ID||env.NAVER_SEARCH_CLIENT_ID;
  const secret=env.NAVER_CLIENT_SECRET||env.NAVER_SEARCH_CLIENT_SECRET;
  if(!id||!secret)return json({code:'NAVER_KEYS_MISSING',error:'네이버 쇼핑 자동 검색을 사용하려면 Cloudflare Pages 환경변수 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 설정해야 해.'},503);
  // Avoid exposing the API quota to anonymous callers. Verify the existing Supabase login.
  const authorization=request.headers.get('Authorization')||'';
  const supabaseUrl=env.VITE_SUPABASE_URL||env.SUPABASE_URL;
  const anonKey=env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_ANON_KEY;
  if(!/^Bearer\s+\S+$/.test(authorization)||!supabaseUrl||!anonKey)return json({error:'로그인이 필요해.'},401);
  try{
    const auth=await fetch(supabaseUrl.replace(/\/$/,'')+'/auth/v1/user',{headers:{Authorization:authorization,apikey:anonKey},signal:AbortSignal.timeout(5000)});
    if(!auth.ok)return json({error:'로그인 세션을 확인해줘.'},401);
  }catch{return json({error:'로그인 확인에 실패했어.'},503)}
  const endpoint=new URL('https://openapi.naver.com/v1/search/shop.json');
  endpoint.search=new URLSearchParams({query,display:'8',start:'1',sort:'sim',exclude:'used:rental:cbshop'}).toString();
  let res;
  try{res=await fetch(endpoint,{headers:{'X-Naver-Client-Id':id,'X-Naver-Client-Secret':secret,Accept:'application/json'},signal:AbortSignal.timeout(9000)})}
  catch{return json({error:'네이버 쇼핑 연결이 원활하지 않아. 다시 시도해줘.'},502)}
  if(!res.ok){
    let code='';
    try{const detail=await res.json();code=String(detail.errorCode||'').slice(0,32)}catch{}
    const status=res.status;
    const reason=status===401?'네이버 API 인증 실패: Client ID·Secret이 같은 애플리케이션의 값인지 확인해줘.'
      :status===403?'네이버 API 권한 없음: 개발자센터에서 해당 앱의 검색 API 이용 권한을 확인해줘.'
      :status===429?'네이버 검색 API 호출 한도 초과: 호출량을 확인하고 나중에 다시 검색해줘.'
      :status===400?'네이버가 검색 요청을 거절했어. 요청 파라미터 또는 검색어를 확인해줘.'
      :status>=500?'네이버 검색 API 서버 오류야. 잠시 후 다시 시도해줘.'
      :'네이버 쇼핑 검색 요청에 실패했어.';
    return json({code:'NAVER_UPSTREAM_ERROR',upstreamStatus:status,naverCode:code,error:reason+' (HTTP '+status+(code?', 코드 '+code:'')+')'},502);
  }
  try{
    const data=await res.json();
    const items=(Array.isArray(data.items)?data.items:[]).slice(0,8).map(item=>({
      title:clean(item.title).slice(0,180),
      url:httpsUrl(item.link),
      image:httpsUrl(item.image),
      price:/^\d+$/.test(String(item.lprice||''))?Number(item.lprice):null,
      shop:clean(item.mallName).slice(0,100),
      brand:clean(item.brand).slice(0,100),
      maker:clean(item.maker).slice(0,100),
      productId:clean(item.productId).slice(0,80),
      category:[item.category1,item.category2,item.category3,item.category4].map(clean).filter(Boolean).join(' > ').slice(0,180),
    })).filter(x=>x.title&&x.url);
    return json({query,total:Number(data.total)||0,items});
  }catch{return json({error:'네이버 검색 결과를 읽지 못했어.'},502)}
}
