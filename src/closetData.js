const CLOSET_MARK='[CLOSET_V1]';
const GALLERY_MARK='\n[CLOSET_GALLERY_V1]';
export const closetEncode=(notes,photos=[])=>CLOSET_MARK+String(notes||'')+(photos.length?GALLERY_MARK+JSON.stringify(photos):'');
export const closetDecode=row=>{const raw=String(row.notes||'').slice(CLOSET_MARK.length),at=raw.lastIndexOf(GALLERY_MARK);if(at<0)return {...row,notes:raw,gallery:[]};try{const gallery=JSON.parse(raw.slice(at+GALLERY_MARK.length));return {...row,notes:raw.slice(0,at),gallery:Array.isArray(gallery)?gallery:[]}}catch{return {...row,notes:raw,gallery:[]}}};
export const closetOnly=rows=>(rows||[]).filter(x=>String(x.notes||'').startsWith(CLOSET_MARK)).map(closetDecode);
