'use strict';
// Server-side retrieval is essential because the source website does not provide a public browser API.
const SOURCE='https://index.minfin.com.ua/markets/fuel/reg/dnepropetrovskaya/';
const STATION_ALIASES={
  'окко':'OKKO','wog':'WOG','upg':'UPG','ukrnafta':'UKRNAFTA','укрнафта':'UKRNAFTA',
  'брсм-нафта':'БРСМ-Нафта','брсм нафта':'БРСМ-Нафта','amic':'AMIC',
  'parallel':'Parallel','mango':'Mango','neftek':'Neftek','rls':'RLS',
  'vst':'VST','vostokgaz':'VostokGaz','дніпронафта':'ДНІПРОНАФТА','днепронафта':'ДНІПРОНАФТА'
};

function normalizeName(name){return String(name||'').toLowerCase().replace(/\s+/g,' ').trim().replace(/\s*[-–—]\s*/g,'-')}
function parsePrice(str){const v=String(str||'').trim().replace(/\s/g,'').replace(',','.');if(!/^\d{1,4}(?:\.\d{1,2})?$/.test(v))return null;const n=Number(v);return n>0&&n<1000?n:null}
function credibleFuelRow(values){
 const [premium,petrol,a92,diesel,lpg]=values;
 if(lpg===null||lpg<20||lpg>85)return false;
 if(diesel===null||diesel<55||diesel>160||diesel<=lpg+8)return false;
 if(petrol!==null&&(petrol<50||petrol>145||petrol<=lpg))return false;
 if(premium!==null&&(premium<50||premium>155||premium<=lpg))return false;
 if(a92!==null&&(a92<45||a92>140||a92<=lpg))return false;
 return true;
}
function parsePrices(html){const cheerio=require('cheerio');const $=cheerio.load(html);let best=[];
 $('table').each((_,table)=>{const rows=[];$(table).find('tr').each((__,tr)=>{const cells=$(tr).children('th,td').map((i,cell)=>$(cell).text().replace(/\s+/g,' ').trim()).get();if(cells.length>=6)rows.push(cells)});const hits=rows.filter(cells=>STATION_ALIASES[normalizeName(cells[0])]).length;if(hits>best.length)best=rows});
 const prices={};for(const row of best){const name=STATION_ALIASES[normalizeName(row[0])];if(!name||prices[name])continue;const vals=row.slice(1,6).map(parsePrice);if(!credibleFuelRow(vals))continue;const obj={};['A95PLUS','A95','A92','DIESEL','LPG'].forEach((fuel,i)=>{if(vals[i]!==null)obj[fuel]=vals[i]});if(Object.keys(obj).length)prices[name]=obj}
 return prices;
}
exports.handler=async function handler(event){if(event.httpMethod!=='GET')return {statusCode:405,body:'Method Not Allowed'};
 try{const response=await fetch(SOURCE,{headers:{'user-agent':'Mozilla/5.0 (compatible; MileageTracker/1.1; +personal-use)','accept':'text/html'},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Upstream '+response.status);const html=await response.text();const prices=parsePrices(html);if(Object.keys(prices).length<3)throw Error('Price table could not be validated');
 const plain=require('cheerio').load(html).root().text().replace(/\s+/g,' ');
 const match=plain.match(/(?:последнее обновление|останнє оновлення)\s*:?\s*(\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2})?)/i);
 return {statusCode:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=1800'},body:JSON.stringify({prices,fetchedAt:new Date().toISOString(),sourceDate:match?match[1]:'не указана',source:SOURCE,region:'Днепропетровская область'})};
 }catch(e){console.error('Fuel feed failed:',e.message);return {statusCode:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify({error:'Не удалось получить проверенные цены. Используйте ручной ввод.'})}}
};
exports._test={parsePrice,parsePrices,normalizeName,credibleFuelRow};
