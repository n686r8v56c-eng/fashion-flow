// Cloudflare Pages Function: restricted metadata lookup for NAVER product pages.
// Returns optional public OG metadata; never accesses arbitrary user-provided hosts.
const allowed = new Set(['brand.naver.com','m.brand.naver.com','smartstore.naver.com','m.smartstore.naver.com','search.shopping.naver.com']);
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
const parsePrice = v => {
  if(typeof v==='number')return Number.isFinite(v)&&v>0&&v<1000000000?Math.round(v):null;
  if(typeof v!=='string')return null;
  const t=v.trim().replace(/[\s,₩원]/g,'');
  return /^\d{1,10}(?:\.\d{1,2})?$/.test(t)&&Number(t)>0?Math.round(Number(t)):null;
};
const titleTag=html=>clean((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'').replace(/\s*[:|\-]\s*(?:네이버\s*)?(?:브랜드스토어|스마트스토어|NAVER).*$/i,'').slice(0,180);
const getEmbeddedProduct = (html, expectedId) => {
  // Naver storefronts sometimes render product state in JSON script tags.
  // We only trust amounts inside an object explicitly carrying the linked product ID.
  const scripts=html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi);
  let candidate=null;
  for(const block of scripts){
    const body=block[1];
    if(!body.includes(expectedId))continue;
    const idPattern=new RegExp('"(?:productNo|productId|channelProductNo)"\\s*:\\s*"?'+expectedId+'"?','g');
    for(const hit of body.matchAll(idPattern)){
      const start=Math.max(0,hit.index-1200),end=Math.min(body.length,hit.index+4000);
      const fragment=body.slice(start,end);
      const title=(fragment.match(/"(?:productName|name)"\s*:\s*"((?:\\.|[^"\\])*)"/)||[])[1]||'';
      const prices=[...fragment.matchAll(/"(?:salePrice|discountedSalePrice|discountedPrice|finalPrice)"\s*:\s*"?([\d,]+)"?/g)].map(m=>parsePrice(m[1])).filter(Boolean);
      if(title||prices.length){candidate={title:clean(title),price:prices.length===1?prices[0]:null};break}
    }
    if(candidate)break;
  }
  return candidate;
};
const ldProducts = html => {
  const out=[];
  const blocks=html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const visit=(v,depth=0)=>{
    if(!v||depth>5)return;
    if(Array.isArray(v)){v.forEach(x=>visit(x,depth+1));return}
    if(typeof v!=='object')return;
    if(String(v['@type']||'').toLowerCase().includes('product'))out.push(v);
    for(const k of ['@graph','mainEntity','itemListElement'])if(v[k])visit(v[k],depth+1);
  };
  for(const b of blocks){try{visit(JSON.parse(b[1]))}catch{}}
  return out;
};
const ldPrice = p => {
  const offers=Array.isArray(p.offers)?p.offers:[p.offers];
  for(const offer of offers){
    if(!offer||typeof offer!=='object')continue;
    const price=parsePrice(offer.price)||parsePrice(offer.lowPrice)||parsePrice(offer.priceSpecification?.price);
    if(price&&(!offer.priceCurrency||offer.priceCurrency==='KRW'))return price;
  }
  return null;
};
export async function onRequestGet({request}){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  try{
    const raw=new URL(request.url).searchParams.get('url')||'';
    if(raw.length>2048)throw Error('주소가 너무 길어.');
    const u=new URL(raw);
    const isCatalog=u.hostname==='search.shopping.naver.com';
    const matched=isCatalog?u.pathname.match(/^\/catalog\/(\d{4,20})\/?$/):u.pathname.match(/^\/([a-zA-Z0-9_-]+)\/products\/(\d{4,20})\/?$/);
    if(u.protocol!=='https:'||!allowed.has(u.hostname)||!matched||u.username||u.password)throw Error('지원하는 네이버 상품 링크를 입력해줘.');
    const productId=isCatalog?matched[1]:matched[2];
    const store=isCatalog?'네이버 쇼핑 카탈로그':matched[1];
    const canonical=isCatalog?'https://search.shopping.naver.com/catalog/'+productId:'https://'+(u.hostname.startsWith('m.')?u.hostname.slice(2):u.hostname)+'/'+matched[1]+'/products/'+productId;
    const fallback={ok:false,url:canonical,productId,store,title:'',image:'',price:null,reason:'상품 정보 자동 조회가 제한되어 링크만 가져왔어. 상품명을 확인해 입력해줘.'};
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),7000);
    let response;
    try{
      response=await fetch(canonical,{redirect:'manual',signal:controller.signal,headers:{'Accept':'text/html','User-Agent':'Mozilla/5.0 (compatible; FashionFlow/1.0)'}});
    }catch{
      return new Response(JSON.stringify(fallback),{headers});
    }finally{clearTimeout(timeout)}
    if(!response.ok||!String(response.headers.get('content-type')||'').includes('text/html'))return new Response(JSON.stringify(fallback),{headers});
    const len=Number(response.headers.get('content-length')||0);
    if(len>800000)return new Response(JSON.stringify(fallback),{headers});
    const html=(await response.text()).slice(0,800000);
    const embedded=getEmbeddedProduct(html,productId);
    const title=meta(html,'og:title')||meta(html,'twitter:title')||embedded?.title||titleTag(html);
    const image=meta(html,'og:image')||meta(html,'twitter:image');
    const productData=ldProducts(html);
    const structured=productData.find(p=>String(p.name||'').trim()===title)||productData[0];
    // Only accept an explicit product price from OG metadata or JSON-LD product offers.
    // Never infer a price from arbitrary page text, which may contain unrelated prices.
    const currency=meta(html,'product:price:currency');
    const metaAmount=currency&&currency!=='KRW'?null:parsePrice(meta(html,'product:price:amount'));
    const price=metaAmount??(structured?ldPrice(structured):null)??embedded?.price??null;
    const finalTitle=title||String(structured?.name||'').trim();
    const imageCandidate=image||(Array.isArray(structured?.image)?structured.image[0]:structured?.image)||'';
    const safeImage=(()=>{try{const img=new URL(imageCandidate);return img.protocol==='https:'?img.href:''}catch{return ''}})();
    return new Response(JSON.stringify({...fallback,ok:!!(finalTitle||price!=null||safeImage),title:finalTitle.slice(0,180),image:safeImage,price,reason:price!=null?'공개 가격을 읽었어. 옵션별 가격은 원본 페이지에서 확인해줘.':'판매가 자동 추출이 안 됐어. 상품 페이지의 실제 판매가를 확인해줘.'}),{headers});
  }catch(e){
    return new Response(JSON.stringify({ok:false,error:e.message||'조회 실패'}),{status:400,headers});
  }
}
