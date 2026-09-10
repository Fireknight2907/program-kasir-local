import sharp from 'sharp';
export const MAX_IMAGE_BYTES=5*1024*1024;
export async function normalizePng(file){
 if(!file||typeof file==='string'||!Number.isFinite(file.size)||file.size<8||file.size>MAX_IMAGE_BYTES) throw new Error('Gambar PNG maksimal 5 MB.');
 const buffer=Buffer.from(await file.arrayBuffer());
 if(buffer.length>MAX_IMAGE_BYTES||!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Isi file bukan gambar PNG yang valid.');
 try {const pipeline=sharp(buffer,{limitInputPixels:16777216,failOn:'warning'});const meta=await pipeline.metadata();if(meta.format!=='png'||meta.width>4096||meta.height>4096||(meta.pages||1)>1)throw Error();const output=await pipeline.png().toBuffer();if(output.length>MAX_IMAGE_BYTES)throw Error();return output;}catch{throw new Error('PNG rusak atau melebihi batas 4096 × 4096 piksel / 5 MB.');}
}

export async function boundedUploadForm(request) {
  const max=MAX_IMAGE_BYTES+65536;
  if(Number(request.headers.get('content-length'))>max) throw new Error('Unggahan maksimal 5 MB.');
  if(!request.body) throw new Error('File tidak ditemukan.');
  const reader=request.body.getReader(), chunks=[];let total=0;
  try {while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();throw new Error('Unggahan maksimal 5 MB.');}chunks.push(value);}}finally{reader.releaseLock();}
  return new Response(new Blob(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
}
