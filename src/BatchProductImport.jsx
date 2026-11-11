import React,{useMemo,useState} from 'react';
import {Check,ExternalLink,Search,Layers,ChevronDown} from 'lucide-react';
import {supabase} from './supabase';
import './BatchProductImport.css';

const sharedCategories=new Set(['경량패딩','숏패딩','롱패딩','패딩','후리스','플리스','바람막이','코트','자켓','재킷','운동화','스니커즈','니트','가디건','부츠','가방','백팩','후드집업','다운자켓']);
const knownBrands=new Set(['잔스포츠','노스페이스','휠라','나이키','아디다스','뉴발란스','디스커버리','유니클로','스파오','탑텐','데상트','내셔널지오그래픽','코닥','지오다노','무신사','마뗑킴','마르디','자라','폴로','라코스테','아크테릭스','파타고니아','컬럼비아','아이더','블랙야크','네파','케이투','K2','리복','푸마']);
const searchUrl=q=>'https://search.shopping.naver.com/search/all?query='+encodeURIComponent(q);
const safeUrl=value=>{try{const url=new URL(String(value||'').trim());return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}};
export function parseBatchKeywords(text){
  const lines=String(text||'').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
  const expanded=lines.flatMap(line=>{
    const slash=line.match(/^(.+?)\s*\/+\s*(.+)$/);
    if(slash){
      const brands=slash[1].trim().split(/\s+/).filter(Boolean);
      const item=slash[2].trim();
      if(brands.length>=2&&brands.length<=10&&item)return brands.map(brand=>brand+' '+item);
    }
    const words=line.split(/\s+/);
    const last=words.at(-1);
    // Expand only unambiguous brand lists; never split an ordinary precise product title.
    if(words.length>=3&&words.length<=11&&sharedCategories.has(last)&&words.slice(0,-1).every(x=>knownBrands.has(x))){
      return words.slice(0,-1).map(brand=>brand+' '+last);
    }
    return [line];
  });
  return [...new Set(expanded)].filter(q=>q.length>=2&&q.length<=100);
}
const KRW=n=>Number(n).toLocaleString('ko-KR')+'원';
const emptyResult=(term,error='')=>({term,candidates:[],selected:0,manualUrl:'',error});

export default function BatchProductImport({onSave}){
  const [open,setOpen]=useState(false),[draft,setDraft]=useState('');
  const [entries,setEntries]=useState([]),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const preview=useMemo(()=>parseBatchKeywords(draft),[draft]);
  const update=(i,patch)=>setEntries(old=>old.map((entry,j)=>j===i?{...entry,...patch}:entry));
  const changeDraft=value=>{setDraft(value);setEntries([]);setNotice('');setError('')};
  async function lookup(term,token){
    try{
      const res=await fetch('/api/product-search?query='+encodeURIComponent(term),{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
      const payload=await res.json();
      if(!res.ok)return {term,candidates:[],selected:0,manualUrl:'',error:payload.error||'상품을 검색하지 못했어.',code:payload.code||''};
      return {...emptyResult(term),candidates:(Array.isArray(payload.items)?payload.items:[]).filter(item=>safeUrl(item.url))};
    }catch{return emptyResult(term,'검색 연결에 실패했어. 검색 바로가기로 직접 확인할 수 있어.')}
  }
  async function searchProducts(){
    setError('');setNotice('');
    if(!preview.length){setError('검색할 상품명을 입력해줘.');return}
    if(preview.length>10){setError('한 번에 최대 10개까지 검색할 수 있어.');return}
    setBusy(true);
    const found=preview.map(q=>emptyResult(q,'검색 중…'));
    setEntries(found);
    try{
      const {data,error:sessionError}=await supabase.auth.getSession();
      if(sessionError||!data?.session?.access_token)throw Error('로그인 상태를 확인해줘.');
      const token=data.session.access_token;
      const first=await lookup(preview[0],token);
      found[0]=first;setEntries([...found]);
      if(first.code==='NAVER_KEYS_MISSING'||first.code==='NAVER_UPSTREAM_ERROR'){
        // Don't waste API calls or display the same error ten times when upstream fails.
        setEntries(preview.map(q=>emptyResult(q,first.error)));
        setError(first.error);
        return;
      }
      let cursor=1;
      const worker=async()=>{
        while(cursor<preview.length){
          const i=cursor++;
          found[i]=await lookup(preview[i],token);
          setEntries([...found]);
        }
      };
      await Promise.all([worker(),worker(),worker()]);
      const matched=found.filter(x=>x.candidates.length).length;
      setNotice(matched+' / '+preview.length+'개 검색어에서 상품 후보를 찾았어. 아래에서 선택하고 한꺼번에 저장해줘.');
    }catch(ex){
      setEntries(preview.map(q=>emptyResult(q,ex.message)));
      setError(ex.message);
    }finally{setBusy(false)}
  }
  async function saveAll(){
    const rows=entries.flatMap(entry=>{
      const custom=safeUrl(entry.manualUrl);
      if(entry.manualUrl.trim()&&!custom)return [];
      if(custom)return [{name:entry.term,url:custom,shop:'직접 입력',image:'',price:null,productId:'',query:entry.term}];
      const c=entry.candidates[entry.selected];
      return c?[{name:c.title,url:c.url,shop:c.shop,image:c.image,price:c.price,productId:c.productId,query:entry.term}]:[];
    });
    if(!rows.length){setError('저장할 상품 링크가 없어. 후보를 선택하거나 상품 링크를 입력해줘.');return}
    setSaving(true);setError('');setNotice('');
    try{
      const {added,skipped}=await onSave(rows);
      setNotice(added+'개 상품을 저장했어.'+(skipped?' 중복 링크 '+skipped+'개는 건너뛰었어.':''));
    }catch(ex){setError('일괄 저장 실패: '+ex.message)}
    finally{setSaving(false)}
  }
  const savable=entries.filter(e=>safeUrl(e.manualUrl)||e.candidates[e.selected]).length;
  return <section className="pt-batch">
    <button className="pt-batch-toggle" type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
      <Layers size={17}/><span>상품명 일괄 검색 · 등록</span><ChevronDown size={16} className={open?'pt-batch-rotated':''}/>
    </button>
    {open&&<div className="pt-batch-body">
      <label htmlFor="pt-batch-input">상품명 여러 개 붙여넣기</label>
      <textarea id="pt-batch-input" rows="3" value={draft} onChange={e=>changeDraft(e.target.value)}
        placeholder={'잔스포츠 노스페이스 휠라 경량패딩\n\n또는 정확한 상품명을 한 줄에 하나씩'}/>
      <p className="pt-batch-help">브랜드 여러 개 + 공통 품목도 인식해. 정확한 상품명은 한 줄에 하나씩 입력해줘. 최대 10개.</p>
      {!!preview.length&&<div className="pt-batch-preview"><strong>검색 예정 {preview.length}개</strong><div>{preview.slice(0,12).map((q,i)=><span key={i}>{q}</span>)}</div></div>}
      <button type="button" className="pt-batch-search" disabled={busy||saving||!preview.length||preview.length>10} onClick={searchProducts}><Search size={16}/>{busy?'상품 검색 중…':'일괄 상품 검색'}</button>
      {entries.length>0&&<div className="pt-batch-results">
        {entries.map((entry,i)=>{
          const item=entry.candidates[entry.selected];
          return <div className="pt-batch-result" key={entry.term}>
            <div className="pt-batch-result-head"><strong>{i+1}. {entry.term}</strong><a href={searchUrl(entry.term)} target="_blank" rel="noopener noreferrer">네이버 검색 <ExternalLink size={13}/></a></div>
            {!!entry.candidates.length&&<>
              <select aria-label={entry.term+' 상품 후보 선택'} value={entry.selected} onChange={e=>update(i,{selected:Number(e.target.value),manualUrl:''})}>
                {entry.candidates.map((c,j)=><option key={j} value={j}>{j+1}. {c.title} {c.price!=null?'('+KRW(c.price)+')':''}</option>)}
              </select>
              {item&&<div className="pt-batch-candidate">
                {item.image&&<img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer"/>}
                <div><strong>{item.title}</strong><small>{item.shop||'판매처 미확인'}{item.price!=null?' · 표시 최저가 '+KRW(item.price):''}</small><a href={item.url} target="_blank" rel="noopener noreferrer">상품 페이지 확인 <ExternalLink size={12}/></a></div>
              </div>}
            </>}
            {(!entry.candidates.length||entry.error)&&<small className="pt-batch-warning">{entry.error||'검색된 후보가 없어. 링크를 직접 추가해줘.'}</small>}
            <input type="url" aria-label={entry.term+' 직접 링크'} placeholder="다른 상품 링크로 교체 (https://)" value={entry.manualUrl} onChange={e=>update(i,{manualUrl:e.target.value})}/>
          </div>;
        })}
        <button type="button" className="pt-batch-save" onClick={saveAll} disabled={busy||saving||!savable}><Check size={17}/>{saving?'저장 중…':savable+'개 상품 한꺼번에 저장'}</button>
        <p className="pt-batch-help">검색 후보는 자동 추천일 뿐 정확한 모델·색상과 다를 수 있어. 저장 전에 상품 페이지를 확인해줘. 표시 최저가는 실제 판매가로 자동 기록하지 않아.</p>
      </div>}
      {error&&<p className="pt-batch-error" role="alert">{error}</p>}
      {notice&&<p className="pt-batch-notice" role="status">{notice}</p>}
    </div>}
  </section>;
}
