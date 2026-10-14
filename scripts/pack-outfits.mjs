// Preserve the released six base poses; fit generated extensions to the same
// silhouettes/baselines as the 30-frame bandanna sheet. Source PNGs stay intact.
import fs from 'node:fs';
import { decode, encode, image } from './png.mjs';

function bounds(img, index, columns, rows) {
  const x0=Math.round(index%columns*img.w/columns), y0=Math.round(Math.floor(index/columns)*img.h/rows);
  const w=Math.round((index%columns+1)*img.w/columns)-x0, h=Math.round((Math.floor(index/columns)+1)*img.h/rows)-y0;
  const seen=new Uint8Array(w*h);
  let largest=0, result;
  for(let start=0;start<seen.length;start++) {
    if(seen[start])continue;
    const queue=[start];seen[start]=1;
    let head=0,count=0,l=w,r=0,t=h,b=0;
    while(head<queue.length) {
      const p=queue[head++],x=p%w,y=Math.floor(p/w);
      if(img.px[((y0+y)*img.w+x0+x)*4+3]<220)continue;
      count++;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
      for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if(nx<0||nx>=w||ny<0||ny>=h)continue;
        const next=ny*w+nx;if(!seen[next]){seen[next]=1;queue.push(next);}
      }
    }
    if(count>largest){largest=count;result={x:x0+l,y:y0+t,w:r-l+1,h:b-t+1};}
  }
  if(largest<20)throw Error(`Missing silhouette in cell ${index}`);
  return result;
}
const base=decode(fs.readFileSync('public/photos/winnie-room-v3.png'));
for(const outfit of ['harness','stripes']) {
  const source=decode(fs.readFileSync(`assets/animation/winnie-${outfit}-full.png`));
  const prior=decode(fs.readFileSync(`public/photos/winnie-${outfit}-v1.png`));
  const output=image(base.w,base.h);prior.px.copy(output.px);
  for(let n=6;n<30;n++) {
    const src=bounds(source,n,3,10), dest=bounds(base,n,3,10);
    for(let y=0;y<dest.h;y++)for(let x=0;x<dest.w;x++) {
      const sx=src.x+Math.min(src.w-1,Math.floor((x+.5)*src.w/dest.w));
      const sy=src.y+Math.min(src.h-1,Math.floor((y+.5)*src.h/dest.h));
      const a=(sy*source.w+sx)*4,b=((dest.y+y)*output.w+dest.x+x)*4;
      if(source.px[a+3]<220)continue;
      source.px.copy(output.px,b,a,a+3);output.px[b+3]=255;
    }
  }
  fs.writeFileSync(`public/photos/winnie-${outfit}-v2.png`,encode(output));
  console.log(`Packed ${outfit}: 30 poses, ${output.w} x ${output.h}`);
}
