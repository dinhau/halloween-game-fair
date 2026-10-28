/* Tiny pairing QR encoder: QR version 10, error correction M, byte mode, mask 0.
 * No external libraries or network calls. ASCII/UTF-8 payload <= 213 bytes.
 * Output is verified against Python qrcode's standard version-10/M/mask-0 matrix.
 */
(function(root){'use strict';
 const N=57,exp=new Array(512),log=new Array(256).fill(0);let x=1;
 for(let i=0;i<255;i++){exp[i]=x;log[x]=i;x<<=1;if(x&256)x^=0x11d;}for(let i=255;i<512;i++)exp[i]=exp[i-255];
 const mul=(a,b)=>a&&b?exp[log[a]+log[b]]:0;
 function parity(data,n){let g=[1];for(let i=0;i<n;i++){const next=Array(g.length+1).fill(0);g.forEach((v,k)=>{next[k]^=v;next[k+1]^=mul(v,exp[i]);});g=next;}const a=[...data,...Array(n).fill(0)];for(let i=0;i<data.length;i++){const f=a[i];for(let j=0;j<g.length;j++)a[i+j]^=mul(f,g[j]);}return a.slice(-n);}
 function bch(v,poly){let r=v;const bits=n=>n?32-Math.clz32(n):0;while(bits(r)>=bits(poly))r^=poly<<(bits(r)-bits(poly));return r;}
 function encode(text){const data=[...new TextEncoder().encode(text)];if(data.length>213)throw new Error('配對網址太長，請改用較短網域。');const bits=[];const put=(n,w)=>{for(let i=w-1;i>=0;i--)bits.push((n>>>i)&1);};put(4,4);put(data.length,16);for(const v of data)put(v,8);for(let i=0;i<4&&bits.length<1728;i++)bits.push(0);while(bits.length%8)bits.push(0);const bytes=[];for(let i=0;i<bits.length;i+=8)bytes.push(bits.slice(i,i+8).reduce((a,b)=>(a<<1)|b,0));let pad=0;while(bytes.length<216)bytes.push(pad++%2?17:236);
 const lengths=[43,43,43,43,44],ds=[],es=[];let offset=0;for(const len of lengths){const d=bytes.slice(offset,offset+=len);ds.push(d);es.push(parity(d,26));}const words=[];for(let i=0;i<44;i++)for(const d of ds)if(i<d.length)words.push(d[i]);for(let i=0;i<26;i++)for(const e of es)words.push(e[i]);
 const m=Array.from({length:N},()=>Array(N).fill(null));
 function finder(y,x){for(let dy=-1;dy<=7;dy++)for(let dx=-1;dx<=7;dx++){const r=y+dy,c=x+dx;if(r<0||r>=N||c<0||c>=N)continue;m[r][c]=(dy>=0&&dy<=6&&(dx===0||dx===6))||(dx>=0&&dx<=6&&(dy===0||dy===6))||(dy>=2&&dy<=4&&dx>=2&&dx<=4);}}
 finder(0,0);finder(N-7,0);finder(0,N-7);
 for(const r of [6,28,50])for(const c of [6,28,50]){if(m[r][c]!==null)continue;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)m[r+dy][c+dx]=Math.abs(dx)===2||Math.abs(dy)===2||(dy===0&&dx===0);}
 for(let i=8;i<N-8;i++){if(m[i][6]===null)m[i][6]=i%2===0;if(m[6][i]===null)m[6][i]=i%2===0;}
 const fmt=0x5412;for(let i=0;i<15;i++){const v=!!((fmt>>i)&1);m[i<6?i:i<8?i+1:N-15+i][8]=v;m[8][i<8?N-i-1:i===8?7:15-i-1]=v;}m[N-8][8]=true;
 const vers=(10<<12)|bch(10<<12,0x1f25);for(let i=0;i<18;i++){const v=!!((vers>>i)&1);m[Math.floor(i/3)][i%3+N-11]=v;m[i%3+N-11][Math.floor(i/3)]=v;}
 let r=N-1,inc=-1,bit=0;for(let c=N-1;c>0;c-=2){if(c===6)c--;while(true){for(const col of [c,c-1])if(m[r][col]===null){let v=!!((words[Math.floor(bit/8)]||0)>>(7-bit%8)&1);if((r+col)%2===0)v=!v;m[r][col]=v;bit++;}r+=inc;if(r<0||r>=N){r-=inc;inc=-inc;break;}}}return m;
 }
 root.qrcode=function(){let text='',matrix=null;return{addData(s){text+=s;},make(){matrix=encode(text);},getModuleCount(){return N;},isDark(r,c){return matrix[r][c];},createSvgTag(){if(!matrix)matrix=encode(text);const paths=[];for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(matrix[r][c])paths.push(`M${c+4},${r+4}h1v1h-1z`);return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="手機配對 QR code" viewBox="0 0 65 65" shape-rendering="crispEdges"><rect width="65" height="65" fill="white"/><path d="${paths.join('')}" fill="black"/></svg>`;}};};
})(typeof window!=='undefined'?window:globalThis);
