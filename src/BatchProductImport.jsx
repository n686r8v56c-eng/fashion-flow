import React,{useMemo,useState} from 'react';
import {Check,ExternalLink,Search,Layers,ChevronDown} from 'lucide-react';
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
const emptyResult=term=>({term,manualUrl:''});

export default function BatchProductImport({onSave}){
  const [open,setOpen]=useState(false),[draft,setDraft]=useState('');
  const [entries,setEntries]=useState([]),[bulkLinks,setBulkLinks]=useState(''),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const preview=useMemo(()=>parseBatchKeywords(draft),[draft]);
  const update=(i,patch)=>setEntries(old=>old.map((entry,j)=>j===i?{...entry,...patch}:entry));
  const changeDraft=value=>{setDraft(value);setEntries([]);setNotice('');setError('')};
  function prepareSearches(){
    setError('');setNotice('');
    if(!preview.length){setError('검색할 상품명을 입력해줘.');return}
    if(preview.length>10){setError('한 번에 최대 10개까지 준비할 수 있어.');return}
    setEntries(preview.map(emptyResult));
    setBulkLinks('');
    setNotice(preview.length+'개 네이버 쇼핑 검색 링크를 준비했어. 각 검색 결과에서 상품을 골라 URL을 붙여넣어줘.');
  }
  function applyBulkLinks(){
    const urls=bulkLinks.split(/\r?\n/).map(x=>x.trim());
    if(urls.length>entries.length){setError('상품명보다 URL이 많아. URL은 상품명 순서대로 한 줄씩 넣어줘.');return}
    if(urls.some(x=>x&&!safeUrl(x))){setError('URL은 https:// 주소만 입력해줘. 비어 있는 줄은 건너뛸 수 있어.');return}
    setEntries(old=>old.map((entry,i)=>({...entry,manualUrl:urls[i]||''})));
    setError('');setNotice('입력한 URL을 각 상품에 순서대로 연결했어.');
  }
  async function saveAll(){
    if(entries.some(entry=>entry.manualUrl.trim()&&!safeUrl(entry.manualUrl))){setError('올바르지 않은 상품 링크가 있어. https:// 주소를 확인해줘.');return}
    const rows=entries.filter(entry=>safeUrl(entry.manualUrl)).map(entry=>({
      name:entry.term,url:safeUrl(entry.manualUrl),shop:'직접 확인',image:'',price:null,productId:'',query:entry.term
    }));
    if(!rows.length){setError('저장할 상품 링크가 없어. 네이버 검색에서 상품 URL을 복사해 입력해줘.');return}
    setSaving(true);setError('');setNotice('');
    try{
      const {added,skipped}=await onSave(rows);
      setNotice(added+'개 상품을 저장했어.'+(skipped?' 중복 링크 '+skipped+'개는 건너뛰었어.':''));
    }catch(ex){setError('일괄 저장 실패: '+ex.message)}
    finally{setSaving(false)}
  }
  const savable=entries.filter(e=>safeUrl(e.manualUrl)).length;
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
      <button type="button" className="pt-batch-search" disabled={saving||!preview.length||preview.length>10} onClick={prepareSearches}><Search size={16}/> 검색 링크 {preview.length}개 준비</button>
      {entries.length>0&&<div className="pt-batch-results">
        <div className="pt-batch-result">
          <label htmlFor="pt-batch-links">상품 링크 일괄 붙여넣기 (선택)</label>
          <textarea id="pt-batch-links" rows="3" value={bulkLinks} onChange={e=>setBulkLinks(e.target.value)} placeholder={'상품명 순서대로 네이버 상품 URL을 한 줄씩 붙여넣기\nhttps://...\nhttps://...'}/>
          <button type="button" className="pt-batch-apply" onClick={applyBulkLinks}>링크 일괄 적용</button>
          <small className="pt-batch-help">빈 줄을 넣으면 해당 상품은 건너뛰어. 아래에서 각각 수정할 수도 있어.</small>
        </div>
        {entries.map((entry,i)=><div className="pt-batch-result" key={entry.term}>
          <div className="pt-batch-result-head"><strong>{i+1}. {entry.term}</strong>
            <a href={searchUrl(entry.term)} target="_blank" rel="noopener noreferrer">네이버에서 상품 찾기 <ExternalLink size={13}/></a>
          </div>
          <input type="url" aria-label={entry.term+' 상품 링크'} placeholder="찾은 상품 링크 붙여넣기 (https://)" value={entry.manualUrl} onChange={e=>update(i,{manualUrl:e.target.value})}/>
          {entry.manualUrl.trim()&&(safeUrl(entry.manualUrl)?<small className="pt-batch-notice">링크 입력 완료</small>:<small className="pt-batch-warning">https:// 상품 URL을 입력해줘.</small>)}
        </div>)}
        <button type="button" className="pt-batch-save" onClick={saveAll} disabled={saving||!savable}><Check size={17}/>{saving?'저장 중…':savable+'개 상품 한꺼번에 저장'}</button>
        <p className="pt-batch-help">상품명과 링크만 저장해. 사진과 가격은 나중에 상품 카드에서 수정할 수 있어. 링크를 찾지 못한 상품은 저장하지 않아.</p>
      </div>}
      {error&&<p className="pt-batch-error" role="alert">{error}</p>}
      {notice&&<p className="pt-batch-notice" role="status">{notice}</p>}
    </div>}
  </section>;
}
