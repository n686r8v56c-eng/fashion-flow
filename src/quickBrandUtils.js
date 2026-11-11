export const tagKey=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
export const isQuickBrandNote=r=>r.kind==='research'&&r.payload?.recordType==='quick-brand-note';
export function quickBrandTags(value){
 const matches=String(value||'').matchAll(/"([^"]+)"|“([^”]+)”|'([^']+)'|[^\s,，#]+/gu),seen=new Set(),tags=[];
 for(const match of matches){const tag=(match[1]||match[2]||match[3]||match[0]).trim().replace(/^#+/,'');if(!tag)continue;const key=tagKey(tag);if(!seen.has(key)){seen.add(key);tags.push(tag)}}return tags;
}
export const noteTags=r=>Array.isArray(r.payload?.tags)?r.payload.tags.filter(t=>typeof t==='string'&&t.trim()):quickBrandTags(r.title);
export function filterQuickBrandNotes(records,selectedTag='',query=''){
 const key=tagKey(selectedTag),q=tagKey(query);
 return records.filter(isQuickBrandNote).filter(r=>(!key||noteTags(r).some(t=>tagKey(t)===key))&&(!q||tagKey(r.title).includes(q)||noteTags(r).some(t=>tagKey(t).includes(q)))).sort((a,b)=>String(b.created_at||b.updated_at||'').localeCompare(String(a.created_at||a.updated_at||'')));
}

export const quickTitleKey=value=>tagKey(value).replace(/\s+/gu,' ');
export function prepareQuickBrandBatch(input,records=[],recentKeys=[]){
 const lines=String(input||'').split(/\r\n|[\r\n\u2028\u2029]/u).map((text,i)=>({title:text.trim(),line:i+1})).filter(item=>item.title);
 const seen=new Set([...records.filter(isQuickBrandNote).map(r=>quickTitleKey(r.title)),...recentKeys]),pending=[],duplicates=[],errors=[];
 if(lines.length>100)errors.push('한 번에 100개 상품까지 등록할 수 있어요.');
 for(const item of lines){const tags=quickBrandTags(item.title),key=quickTitleKey(item.title);if(item.title.length>1000){errors.push(item.line+'행: 한 상품은 1,000자까지 입력해 주세요.');continue}if(!tags.length){errors.push(item.line+'행: 기록할 단어를 입력해 주세요.');continue}if(tags.length>40){errors.push(item.line+'행: 태그는 40개까지 넣을 수 있어요.');continue}if(seen.has(key)){duplicates.push(item);continue}seen.add(key);pending.push({...item,tags,key})}
 return {lines,pending,duplicates,errors};
}
