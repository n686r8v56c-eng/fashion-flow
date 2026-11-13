import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost,normalizeOutfit} from '../functions/api/analyze-outfit.js';
const env={OPENAI_API_KEY:'test',SUPABASE_URL:'https://auth.example.com',SUPABASE_ANON_KEY:'public'};
const request=(body,token=true)=>new Request('https://app.example/api/analyze-outfit',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer test'}:{})},body:JSON.stringify(body)});
test('rejects unauthenticated or invalid image requests before AI calls',async()=>{
 const original=globalThis.fetch;let count=0;
 globalThis.fetch=async()=>{count++;return new Response('{}')};
 try{
  assert.equal((await onRequestPost({request:request({image:'data:image/jpeg;base64,AA=='},false),env})).status,401);assert.equal(count,0);
  assert.equal((await onRequestPost({request:request({image:'https://evil.example/photo'}),env})).status,400);assert.equal(count,1);
 }finally{globalThis.fetch=original}
});
test('normalizes AI output, excludes malformed records and never returns model URLs/prices',()=>{
 const result=normalizeOutfit({items:[null,{name:'코트',query:'네이비 하프 코트',confidence:'100%',price:1,url:'https://madeup.example'},{name:'',query:'x'}]});
 assert.equal(result.items.length,1);assert.equal(result.items[0].confidence,'낮음');assert.equal(result.items[0].exactQuery,'');assert.equal(result.items[0].price,undefined);assert.equal(result.items[0].url,undefined);
});
test('returns actual parsed AI observations without storing the image',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return calls.length===1?new Response('{}'):Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({summary:'네이비 착장',items:[{name:'코트',query:'네이비 하프 코트',features:'넓은 칼라',confidence:'높음'}]})}]}]})};
 try{
  const res=await onRequestPost({request:request({image:'data:image/jpeg;base64,AA=='}),env});assert.equal(res.status,200);assert.equal((await res.json()).result.items[0].name,'코트');
  assert.equal(calls.length,2);const payload=JSON.parse(calls[1].init.body);assert.equal(payload.store,false);assert.equal(payload.input[0].content[1].type,'input_image');
 }finally{globalThis.fetch=original}
});
test('handles malformed upstream AI output without displaying invented results',async()=>{
 const original=globalThis.fetch;let count=0;
 globalThis.fetch=async()=>++count===1?new Response('{}'):Response.json({output:[{content:[{type:'output_text',text:'not json'}]}]});
 try{assert.equal((await onRequestPost({request:request({image:'data:image/jpeg;base64,AA=='}),env})).status,502)}finally{globalThis.fetch=original}
});
