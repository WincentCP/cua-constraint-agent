import {chromium} from 'playwright';
import {LIMITS,ORIGIN} from '../core/config.ts';
export async function openTask(id:string,secret:string,onViolation:()=>void,executablePath?:string){
 const server=await chromium.launchServer({headless:true,executablePath});
 try{const browser=await chromium.connect(server.wsEndpoint());const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  await context.addCookies([{name:'fixture_access',value:secret,url:ORIGIN,httpOnly:true,sameSite:'Strict'}]);
  const root=`/task/${id}/`;
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===ORIGIN&&u.pathname.startsWith(root)&&!route.request().isNavigationRequest()||u.origin===ORIGIN&&u.pathname.startsWith(root))return route.continue();onViolation();return route.abort('blockedbyclient');});
  const page=await context.newPage();context.on('page',p=>{if(p!==page){onViolation();void p.close();}});page.on('dialog',d=>{void d.dismiss();});page.setDefaultTimeout(LIMITS.actionMs);
  await page.goto(`${ORIGIN}${root}`,{waitUntil:'load',timeout:LIMITS.actionMs});return {page,browser,server};
 }catch(e){await server.kill();throw e;}
}
