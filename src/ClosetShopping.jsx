import './ClosetShopping.css';
import React,{useEffect,useState,useRef} from 'react';
import {Search,Plus,ExternalLink,Trash2,ImagePlus} from 'lucide-react';
import {useLocalCollection} from './sync/LocalSync.jsx';

const searchUrl=q=>'https://search.shopping.naver.com/search/all?query='+encodeURIComponent(q);
async function compressPhoto(file){if(!file.type.startsWith('image/'))throw Error('이미지 파일만 가능해.');if(file.size>15*1024*1024)throw Error('15MB 이하 사진을 선택해 줘.');const source=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('사진 열기 실패'));img.src=source});const scale=Math.min(1,520/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.72)}finally{URL.revokeObjectURL(source)}}
function ShoppingPhoto({row,onUpload,disabled}){const picker=useRef(null);return <div className="cs-photo"><button type="button" disabled={disabled} aria-label={row.name+' 사진 추가 또는 변경'} onClick={()=>picker.current?.click()}>{row.manualImageDataUrl?<img src={row.manualImageDataUrl} alt=""/>:<span><ImagePlus size={20}/>사진 추가</span>}</button><input ref={picker} type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)onUpload(row,f)}}/></div>}
function InlineField({row,field,onSave}){const initial=String(row[field]??'');const [value,setValue]=useState(initial);useEffect(()=>setValue(initial),[initial,row.id]);return <input className={field==='name'?'cs-name':'cs-price'} aria-label={row.name+(field==='name'?' 상품명':' 가격')} type={field==='price'?'number':'text'} inputMode={field==='price'?'numeric':undefined} min={field==='price'?'0':undefined} placeholder={field==='name'?'상품명 입력':'가격 입력'} value={value} onChange={e=>setValue(e.target.value)} onBlur={()=>{if(value.trim()!==initial)onSave(row,field,value.trim())}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}/>}
const validUrl=raw=>{try{const u=new URL(raw.trim());return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}};
export default function ClosetShopping(){
 const {read,write,remove,subscribe}=useLocalCollection('closet-shopping');
 const [rows,setRows]=useState([]),[query,setQuery]=useState(''),[url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const reload=async()=>setRows((await read()).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))));
 useEffect(()=>{const refresh=()=>reload().catch(e=>setError(e.message));refresh();return subscribe(refresh)},[read,subscribe]);
 const search=e=>{e.preventDefault();if(query.trim())window.open(searchUrl(query.trim()),'_blank','noopener,noreferrer')};
 async function add(e){e.preventDefault();const link=validUrl(url);if(!link){setError('https:// 상품 링크를 입력해 줘.');return}if(rows.some(r=>r.url===link)){setError('이미 저장한 링크야.');return}setBusy(true);setError('');try{await write({id:crypto.randomUUID(),url:link,name:'상품명 확인 필요',price:'',createdAt:new Date().toISOString()});setUrl('');await reload()}catch(e){setError('등록 실패: '+e.message)}finally{setBusy(false)}}
 async function updateField(row,field,value){if(field==='price'&&value!==''&&(!/^\\d+$/.test(value)||Number(value)>999999999)){setError('가격은 0원 이상 숫자로 입력해 줘.');return}setError('');try{await write({...row,[field]:field==='name'?(value||'상품명 확인 필요'):value,updatedAt:new Date().toISOString()});await reload()}catch(e){setError('수정 실패: '+e.message);await reload()}}
 async function upload(row,file){setBusy(true);setError('');try{const manualImageDataUrl=await compressPhoto(file);await write({...row,manualImageDataUrl,updatedAt:new Date().toISOString()});await reload()}catch(e){setError('사진 저장 실패: '+e.message)}finally{setBusy(false)}}
 async function erase(row){if(!confirm('상품을 삭제할까?'))return;try{await remove(row.id);await reload()}catch(e){setError(e.message)}}
 return <section className="closet-shop" style={{display:'grid',gap:16}}>
 <h1 style={{margin:0}}>쇼핑</h1>
 <form onSubmit={search} style={{border:'1px solid #e2d5ec',borderRadius:14,padding:14,display:'grid',gap:10}}>
 <strong>네이버 쇼핑 검색</strong><div style={{display:'flex',gap:8}}><input aria-label="네이버 쇼핑 키워드" style={{flex:1,minWidth:0,fontSize:16,padding:12,border:'1px solid #dacbe8',borderRadius:10}} placeholder="예: 경량패딩" value={query} onChange={e=>setQuery(e.target.value)}/><button className="primary" type="submit"><Search size={17}/> 검색</button></div></form>
 <form onSubmit={add} style={{border:'1px solid #e2d5ec',borderRadius:14,padding:14,display:'grid',gap:10}}>
 <strong>상품 링크로 등록</strong><div style={{display:'flex',gap:8}}><input aria-label="상품 링크" style={{flex:1,minWidth:0,fontSize:16,padding:12,border:'1px solid #dacbe8',borderRadius:10}} type="url" required placeholder="상품 URL 붙여넣기" value={url} onChange={e=>setUrl(e.target.value)}/><button className="primary" disabled={busy} type="submit"><Plus size={17}/> 등록</button></div></form>
 {error&&<p role="alert" style={{color:'#a33'}}>{error}</p>}
 <div className="cs-products">{rows.map(row=><article className="cs-product" key={row.id}><ShoppingPhoto row={row} disabled={busy} onUpload={upload}/><div className="cs-details"><InlineField row={row} field="name" onSave={updateField}/><label className="cs-price-line">가격 (원) <InlineField row={row} field="price" onSave={updateField}/></label><a href={row.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> 상품 페이지</a></div><button type="button" className="cs-delete" aria-label={row.name+' 삭제'} onClick={()=>erase(row)}><Trash2 size={18}/></button></article>)}</div>
 </section>
}
