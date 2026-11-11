// Small ZIP (store mode) writer: no external library or additional API charges.
const encoder=new TextEncoder();
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0};
const write16=(view,at,n)=>view.setUint16(at,n,true);
const write32=(view,at,n)=>view.setUint32(at,n>>>0,true);
export async function makeZip(entries){
 const parts=[],central=[];let offset=0;
 for(const {name,data} of entries){
  const filename=encoder.encode(name),bytes=new Uint8Array(await data.arrayBuffer()),crc=crc32(bytes);
  const header=new Uint8Array(30+filename.length),v=new DataView(header.buffer);
  write32(v,0,0x04034b50);write16(v,4,20);write16(v,6,0x800);write16(v,8,0);write32(v,14,crc);write32(v,18,bytes.length);write32(v,22,bytes.length);write16(v,26,filename.length);header.set(filename,30);
  parts.push(header,bytes);
  const record=new Uint8Array(46+filename.length),c=new DataView(record.buffer);
  write32(c,0,0x02014b50);write16(c,4,20);write16(c,6,20);write16(c,8,0x800);write16(c,10,0);write32(c,16,crc);write32(c,20,bytes.length);write32(c,24,bytes.length);write16(c,28,filename.length);write32(c,42,offset);record.set(filename,46);central.push(record);
  offset+=header.length+bytes.length;
 }
 const centralSize=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
 write32(v,0,0x06054b50);write16(v,8,entries.length);write16(v,10,entries.length);write32(v,12,centralSize);write32(v,16,offset);
 return new Blob([...parts,...central,end],{type:'application/zip'});
}
