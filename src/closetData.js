const CLOSET_MARK='[CLOSET_V1]';
const GALLERY_MARK='\n[CLOSET_GALLERY_V1]';
const TAGS_MARK='\n[CLOSET_TAGS_V1]';
export const normalizeClosetTags=tags=>[...new Set((Array.isArray(tags)?tags:[]).map(t=>String(t||'').replace(/^#+/,'').trim()).filter(Boolean))].slice(0,30);
export const closetEncode=(notes,photos=[],tags=[])=>{
 const pictures=Array.isArray(photos)?photos:[];
 const labels=normalizeClosetTags(tags);
 return CLOSET_MARK+String(notes||'')+(pictures.length?GALLERY_MARK+JSON.stringify(pictures):'')+(labels.length?TAGS_MARK+JSON.stringify(labels):'');
};
export const closetDecode=row=>{
 let raw=String(row.notes||'');
 if(raw.startsWith(CLOSET_MARK))raw=raw.slice(CLOSET_MARK.length);
 let tags=[];
 const tagAt=raw.lastIndexOf(TAGS_MARK);
 if(tagAt>=0){try{const parsed=JSON.parse(raw.slice(tagAt+TAGS_MARK.length));if(Array.isArray(parsed)){tags=normalizeClosetTags(parsed);raw=raw.slice(0,tagAt)}}catch{}}
 let gallery=[];
 const at=raw.lastIndexOf(GALLERY_MARK);
 if(at>=0){try{const parsed=JSON.parse(raw.slice(at+GALLERY_MARK.length));if(Array.isArray(parsed)){gallery=parsed;raw=raw.slice(0,at)}}catch{}}
 return {...row,notes:raw,gallery,tags};
};
export const closetOnly=rows=>(rows||[]).filter(x=>String(x.notes||'').startsWith(CLOSET_MARK)).map(closetDecode);
