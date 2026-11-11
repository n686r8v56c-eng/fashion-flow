const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const allowed=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(u.hostname)&&/^\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)}catch{return false}};
const mediaHost=h=>h==='cdninstagram.com'||h.endsWith('.cdninstagram.com')||h==='fbcdn.net'||h.endsWith('.fbcdn.net')||h==='instagram.com'||h.endsWith('.instagram.com');
const validMedia=value=>{try{const u=new URL(value);return u.protocol==='https:'&&mediaHost(u.hostname)}catch{return false}};
export async function onRequestPost({request,env}){
 if(!env.APIFY_API_TOKEN)return json({error:'Cloudflare에 APIFY_API_TOKEN 설정이 없어.'},503);
 if(!env.APIFY_ACTOR_ID)return json({error:'Cloudflare에 APIFY_ACTOR_ID를 먼저 등록해 줘.'},503);
 let body;try{body=await request.json()}catch{return json({error:'요청 형식이 올바르지 않아.'},400)}
 const url=String(body?.url||'').trim();if(!allowed(url))return json({error:'공개 인스타그램 게시물 링크를 입력해 줘.'},400);
 const actor=String(env.APIFY_ACTOR_ID).trim().replace('/','~');
 if(!/^[a-zA-Z0-9_~-]+$/.test(actor))return json({error:'APIFY_ACTOR_ID 설정을 확인해 줘.'},503);
 try{
  const endpoint='https://api.apify.com/v2/acts/'+encodeURIComponent(actor)+'/run-sync-get-dataset-items?timeout=90&memory=256';
  const r=await fetch(endpoint,{method:'POST',headers:{'authorization':'Bearer '+env.APIFY_API_TOKEN,'content-type':'application/json'},body:JSON.stringify({directUrls:[url],resultsLimit:1,resultsType:'posts'})});
  if(!r.ok){const detail=await r.text();return json({error:'Apify 실행 실패 ('+r.status+'). Actor 설정과 사용량을 확인해 줘.',detail:detail.slice(0,300)},502)}
  const rows=await r.json();if(!Array.isArray(rows))return json({error:'Apify 응답이 예상한 형식이 아니야.'},502);
  const images=[];
  const add=value=>{if(typeof value==='string'&&validMedia(value)&&!images.includes(value))images.push(value)};
  for(const row of rows){
   const children=Array.isArray(row.childPosts)?row.childPosts:Array.isArray(row.carouselMedia)?row.carouselMedia:[];
   const imageList=Array.isArray(row.images)?row.images:[];
   for(const item of imageList){if(typeof item==='string')add(item);else if(item){add(item.url);add(item.displayUrl);add(item.imageUrl)}}
   if(!imageList.length)for(const child of children){if(!child)continue;add(child.displayUrl);add(child.imageUrl);if(Array.isArray(child.images)){for(const item of child.images){if(typeof item==='string')add(item);else if(item){add(item.url);add(item.displayUrl)}}}}
   if(!images.length){add(row.displayUrl);add(row.imageUrl)}
  }
  if(!images.length)return json({error:'이미지 주소를 찾지 못했어. 수집기 응답 형식 또는 게시물 접근 제한을 확인해 줘.'},422);
  return json({images,note:'Apify에서 '+images.length+'장 이미지 주소를 가져왔어. 사진 비율과 다운로드 결과를 확인해 줘.'});
 }catch(e){return json({error:'Apify 요청 중 문제가 발생했어. 잠시 후 다시 시도해 줘.'},502)}
}
