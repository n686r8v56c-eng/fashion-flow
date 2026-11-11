import React,{useEffect,useState} from 'react';
import {Search,Plus,ExternalLink,Trash2,Pencil} from 'lucide-react';
import {useLocalCollection} from './sync/LocalSync.jsx';

const searchUrl=q=>'https://search.shopping.naver.com/search/all?query='+encodeURIComponent(q);
const validUrl=raw=>{try{const u=new URL(raw.trim());return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}};
export default function ClosetShopping(){
 const {read,write,remove,subscribe}=useLocalCollection('closet-shopping');
 const [rows,setRows]=useState([]),[query,setQuery]=useState(''),[url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[edit,setEdit]=useState(null);
 const reload=async()=>setRows((await read()).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))));
 useEffect(()=>{const refresh=()=>reload().catch(e=>setError(e.message));refresh();return subscribe(refresh)},[read,subscribe]);
 const search=e=>{e.preventDefault();if(query.trim())window.open(searchUrl(query.trim()),'_blank','noopener,noreferrer')};
 async function add(e){e.preventDefault();const link=validUrl(url);if(!link){setError('https:// 상품 링크를 입력해 줘.');return}if(rows.some(r=>r.url===link)){setError('이미 저장한 링크야.');return}setBusy(true);setError('');try{await write({id:crypto.randomUUID(),url:link,name:'상품명 확인 필요',price:'',createdAt:new Date().toISOString()});setUrl('');await reload()}catch(e){setError('등록 실패: '+e.message)}finally{setBusy(false)}}
 async function save(e){e.preventDefault();setBusy(true);try{await write({...edit,name:edit.name.trim()||'상품명 확인 필요',updatedAt:new Date().toISOString()});setEdit(null);await reload()}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function erase(row){if(!confirm('상품을 삭제할까?'))return;try{await remove(row.id);await reload()}catch(e){setError(e.message)}}
 return <section className="closet-shop" style={{display:'grid',gap:16}}>
 <h1 style={{margin:0}}>쇼핑</h1>
 <form onSubmit={search} style={{border:'1px solid #e2d5ec',borderRadius:14,padding:14,display:'grid',gap:10}}>
 <strong>네이버 쇼핑 검색</strong><div style={{display:'flex',gap:8}}><input aria-label="네이버 쇼핑 키워드" style={{flex:1,minWidth:0,fontSize:16,padding:12,border:'1px solid #dacbe8',borderRadius:10}} placeholder="예: 경량패딩" value={query} onChange={e=>setQuery(e.target.value)}/><button className="primary" type="submit"><Search size={17}/> 검색</button></div></form>
 <form onSubmit={add} style={{border:'1px solid #e2d5ec',borderRadius:14,padding:14,display:'grid',gap:10}}>
 <strong>상품 링크로 등록</strong><div style={{display:'flex',gap:8}}><input aria-label="상품 링크" style={{flex:1,minWidth:0,fontSize:16,padding:12,border:'1px solid #dacbe8',borderRadius:10}} type="url" required placeholder="상품 URL 붙여넣기" value={url} onChange={e=>setUrl(e.target.value)}/><button className="primary" disabled={busy} type="submit"><Plus size={17}/> 등록</button></div></form>
 {error&&<p role="alert" style={{color:'#a33'}}>{error}</p>}
 <div style={{display:'grid',gap:10}}>{rows.map(row=><article key={row.id} style={{border:'1px solid #e2d5ec',borderRadius:13,padding:14,display:'flex',gap:10,alignItems:'center'}}>
 <div style={{flex:1,minWidth:0,display:'grid',gap:6}}><b>{row.name}</b>{row.price!==''&&<small>{Number(row.price).toLocaleString('ko-KR')}원</small>}<a href={row.url} target="_blank" rel="noopener noreferrer" style={{overflowWrap:'anywhere',fontSize:13,color:'#7954a3'}}><ExternalLink size={13}/> 상품 페이지</a></div>
 <button type="button" aria-label="상품 수정" onClick={()=>setEdit({...row})}><Pencil size={18}/></button><button type="button" aria-label="상품 삭제" onClick={()=>erase(row)}><Trash2 size={18}/></button></article>)}</div>
 {edit&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setEdit(null)}}><form className="modal" onSubmit={save} style={{display:'grid',gap:12}}><h2>상품 수정</h2><label>상품명<input style={{width:'100%',fontSize:16}} value={edit.name} onChange={e=>setEdit(p=>({...p,name:e.target.value}))}/></label><label>가격 (원)<input style={{width:'100%',fontSize:16}} type="number" min="0" value={edit.price} onChange={e=>setEdit(p=>({...p,price:e.target.value}))}/></label><button className="primary" disabled={busy}>저장</button><button type="button" onClick={()=>setEdit(null)}>취소</button></form></div>}
 </section>
}