import test from 'node:test';
import assert from 'node:assert/strict';
import {closetEncode,closetDecode,closetOnly} from '../src/closetData.js';
test('legacy single-photo clothes and multi-photo galleries survive the new cache round trip',()=>{
 const original=[{id:'old',image_path:'u/main.jpg',notes:'[CLOSET_V1]기존 메모'}, {id:'gallery',image_path:'u/front.jpg',notes:closetEncode('여러 사진',['u/back.jpg','u/side.jpg'])}, {id:'unrelated',notes:'다른 장르'}];
 const visible=closetOnly(original);assert.equal(visible.length,2);assert.equal(visible[0].image_path,'u/main.jpg');assert.deepEqual(visible[0].gallery,[]);
 const cache=visible.map(row=>({...row,notes:closetEncode(row.notes,row.gallery)}));assert.deepEqual(closetOnly(cache),visible);assert.deepEqual(closetDecode(cache[1]).gallery,['u/back.jpg','u/side.jpg']);
});
