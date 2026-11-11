// Cloudflare Pages metadata endpoint. Fetches only supported public YouTube/Instagram URLs.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export async function onRequestGet({request}){
  try{
    const raw=new URL(request.url).searchParams.get('url')||'';
    if(raw.length>2048) return json({error:'주소가 너무 길어.'},400);
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password)return json({error:'https 링크만 지원해.'},400);
    const host=u.hostname.toLowerCase().replace(/^www\./,'').replace(/^m\./,'');
    if(host==='youtube.com'||host==='youtu.be'){
      let id=host==='youtu.be'?u.pathname.split('/')[1]:u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1];
      if(!/^[\w-]{11}$/.test(id||''))return json({error:'유튜브 영상 링크를 입력해줘.'},400);
      const canonical='https://www.youtube.com/watch?v='+id;
      let title='';
      try{
        const res=await fetch('https://www.youtube.com/oembed?url='+encodeURIComponent(canonical)+'&format=json',{signal:AbortSignal.timeout(6000)});
        if(res.ok){const d=await res.json();title=String(d.title||'').slice(0,250)}
      }catch{}
      return json({platform:'youtube',url:canonical,title,thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',needsTitle:!title});
    }
    if(host==='instagram.com'){
      const m=u.pathname.match(/^\/(p|reel|tv)\/([a-zA-Z0-9_-]+)\/?/);
      if(!m)return json({error:'인스타그램 게시물 또는 릴스 링크를 입력해줘.'},400);
      const canonical='https://www.instagram.com/'+m[1]+'/'+m[2]+'/';
      let title='',thumbnail='';
      try{
        const res=await fetch(canonical,{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{Accept:'text/html'}});
        if(res.ok&&String(res.headers.get('content-type')||'').includes('text/html')){
          const html=(await res.text()).slice(0,500000);
          const find=(property)=>{
            for(const t of html.match(/<meta\b[^>]*>/gi)||[]){
              const key=t.match(/(?:property|name)=["']([^"']+)["']/i)?.[1];
              if(key!==property)continue;
              const v=t.match(/content=["']([^"']*)["']/i)?.[1]||'';
              return v.replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim();
            }
            return '';
          };
          title=(find('og:title')||'').slice(0,250);
          const img=find('og:image');
          if(img.startsWith('https://'))thumbnail=img;
        }
      }catch{}
      return json({platform:'instagram',url:canonical,title,thumbnail,needsTitle:!title});
    }
    return json({error:'유튜브와 인스타그램 링크만 지원해.'},400);
  }catch{return json({error:'올바른 URL을 입력해줘.'},400)}
}
