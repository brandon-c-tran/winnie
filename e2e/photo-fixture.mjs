import fs from 'node:fs';
// Minimal real EXIF inside a real JPEG: camera wall date and explicit UTC offset.
export function datedPhoto(wall, offset='-06:00') {
  const tiff=Buffer.alloc(84);
  tiff.write('II');tiff.writeUInt16LE(42,2);tiff.writeUInt32LE(8,4);
  tiff.writeUInt16LE(1,8);tiff.writeUInt16LE(0x8769,10);tiff.writeUInt16LE(4,12);tiff.writeUInt32LE(1,14);tiff.writeUInt32LE(26,18);
  tiff.writeUInt16LE(2,26);
  for(const [at,tag,count,pos] of [[28,0x9003,20,56],[40,0x9011,7,76]]) {
    tiff.writeUInt16LE(tag,at);tiff.writeUInt16LE(2,at+2);tiff.writeUInt32LE(count,at+4);tiff.writeUInt32LE(pos,at+8);
  }
  tiff.write(wall,56);tiff.write(offset,76);
  const app=Buffer.concat([Buffer.from('Exif\0\0'),tiff]), marker=Buffer.alloc(4);
  marker.writeUInt16BE(0xffe1);marker.writeUInt16BE(app.length+2,2);
  const jpeg=fs.readFileSync('public/photos/winnie-wall.jpg');
  return {name:wall.replaceAll(':','-')+'.jpg',mimeType:'image/jpeg',buffer:Buffer.concat([jpeg.subarray(0,2),marker,app,jpeg.subarray(2)])};
}
