// Cloudflare Pages Function: restricted metadata lookup for NAVER product pages.
// Returns optional public OG metadata; never accesses arbitrary user-provided hosts.
const allowed = new Set(['brand.naver.com','m.brand.naver.com','smartstore.naver.com','m.smartstore.naver.com']);
const clean = value => String(value||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
const meta = (html,key) => {
  const tags = html.match(/<meta\b[^>]*>/gi)||[];
  for(const tag of tags){
    const attrs={};
    for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[m[1].toLowerCase()]=m[2]??m[3];
    if(attrs.property===key||attrs.name===key)return clean(attrs.content);
  }
  return '';
};
export async function onRequestGet({request}){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  try{
    const raw=new URL(request.url).searchParams.get('url')||'';
    if(raw.length>2048)throw Error('주소가 너무 길어.');
    const u=new URL(raw);
    const matched=u.pathname.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d{4,20})\/?$/);
    if(u.protocol!=='https:'||!allowed.has(u.hostname)||!matched||u.username||u.password)throw Error('지원하는 네이버 상품 링크를 입력해줘.');
    const canonical='https://'+(u.hostname.startsWith('m.')?u.hostname.slice(2):u.hostname)+'/'+matched[1]+'/products/'+matched[2];
    const fallback={ok:false,url:canonical,productId:matched[2],store:matched[1],title:'',image:'',price:null,reason:'상품 정보 자동 조회가 제한되어 링크만 가져왔어. 상품명을 확인해 입력해줘.'};
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),7000);
    let response;
    try{
      response=await fetch(canonical,{redirect:'manual',signal:controller.signal,headers:{'Accept':'text/html','User-Agent':'Mozilla/5.0 (compatible; FashionFlow/1.0)'}});
    }finally{clearTimeout(timeout)}
    if(!response.ok||!String(response.headers.get('content-type')||'').includes('text/html'))return new Response(JSON.stringify(fallback),{headers});
    const len=Number(response.headers.get('content-length')||0);
    if(len>800000)return new Response(JSON.stringify(fallback),{headers});
    const html=(await response.text()).slice(0,800000);
    const title=meta(html,'og:title')||meta(html,'twitter:title');
    const image=meta(html,'og:image')||meta(html,'twitter:image');
    const priceText=meta(html,'product:price:amount');
    const price=/^\d{1,10}(?:\.\d{1,2})?$/.test(priceText)?Math.round(Number(priceText)):null;
    const safeImage=(()=>{try{const img=new URL(image);return img.protocol==='https:'?img.href:''}catch{return ''}})();
    return new Response(JSON.stringify({...fallback,ok:!!title,title:title.slice(0,180),image:safeImage,price,reason:title?'페이지 공개 정보를 가져왔어. 상품명·옵션·가격을 확인하고 저장해줘.':fallback.reason}),{headers});
  }catch(e){
    return new Response(JSON.stringify({ok:false,error:e.message||'조회 실패'}),{status:400,headers});
  }
}
