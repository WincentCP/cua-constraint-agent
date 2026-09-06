export function terbilang(value:number):string{
 if(!Number.isSafeInteger(value)||value<0)throw Error('unsupported_number');
 const small=['nol','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
 if(value<12)return small[value];if(value<20)return `${small[value-10]} belas`;
 const rest=(n:number)=>n?` ${terbilang(n)}`:'';
 if(value<100)return `${small[Math.floor(value/10)]} puluh${rest(value%10)}`;
 if(value<200)return `seratus${rest(value-100)}`;
 if(value<1000)return `${small[Math.floor(value/100)]} ratus${rest(value%100)}`;
 if(value<2000)return `seribu${rest(value-1000)}`;
 if(value<1e6)return `${terbilang(Math.floor(value/1000))} ribu${rest(value%1000)}`;
 if(value<1e9)return `${terbilang(Math.floor(value/1e6))} juta${rest(value%1e6)}`;
 return `${terbilang(Math.floor(value/1e9))} miliar${rest(value%1e9)}`;
}
export const speechText=(text:string)=>text.replace(/\b(\d[\d.]*) rupiah\b/g,(_,amount:string)=>`${terbilang(Number(amount.replaceAll('.','')))} rupiah`);
