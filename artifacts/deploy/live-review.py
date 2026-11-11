from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from datetime import datetime,timezone
import json,hashlib
URL='https://shawnsun0813.github.io/class-planning-assistant/'
out=Path('/workspace/class-planning-assistant/artifacts/deploy');out.mkdir(parents=True,exist_ok=True)
record={'review':'REVIEW-DEPLOY-01','scope':'real_public_https_site','url':URL,'startedAt':datetime.now(timezone.utc).isoformat(),'deployedSourceShaReportedByParent':'3fafd3582bcdfd83c7e63c8780f3bd1e15c6f9bd','checks':[],'pageErrors':[],'badResponses':[],'failedRequests':[],'tlsValidationDisabled':False}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1440,'height':1000})
  page=context.new_page()
  page.set_default_timeout(15000)
  page.on('pageerror',lambda e:record['pageErrors'].append(str(e)))
  page.on('response',lambda r:record['badResponses'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  page.on('requestfailed',lambda r:record['failedRequests'].append({'url':r.url,'failure':r.failure}))
  response=page.goto(URL,wait_until='domcontentloaded',timeout=30000)
  record['httpStatus']=response.status if response else None;record['finalUrl']=page.url
  expect(page.get_by_role('heading',name='Course index.')).to_be_visible()
  expect(page.locator('.course-card')).to_have_count(20)
  data=page.evaluate('''async()=>{const names=['catalog','bidding-history','reviews','enrollment-history','exchange-history','nonsom-history'];return await Promise.all(names.map(async n=>{const u=new URL('data/'+n+'.json',location.href);const r=await fetch(u);const d=await r.json();return {name:n,url:r.url,status:r.status,count:d.courses?.length??d.records?.length??d.reviews?.length};}));}''')
  record['dataResources']=data
  assert next(x for x in data if x['name']=='catalog')['count']==245
  assert all(x['status']==200 and '/class-planning-assistant/data/' in x['url'] for x in data)
  record['checks'].append('HTTPS site,245 catalog,20 initial course rows and all six JSON resources200')
  page.screenshot(path=str(out/'live-review-desktop.png'),full_page=False)
  page.get_by_role('button',name='载入历史案例',exact=True).click()
  expect(page.locator('.plan-stats').get_by_text('22',exact=True)).to_be_visible();expect(page.locator('.plan-stats').get_by_text('7',exact=True)).to_be_visible()
  record['checks'].append('historical22credits7courses retained as unconfirmed import')
  page.get_by_role('button',name='S2 后半学期',exact=True).click();expect(page.locator('.segmented button.selected')).to_have_css('background-color','rgb(23, 32, 30)');expect(page.locator('.calendar-course').filter(has_text='MGT 651-02')).to_have_count(2)
  record['checks'].append('S2 selected style/content and two ThinkingWithData meetings')
  page.screenshot(path=str(out/'live-review-s2.png'),full_page=False)
  page.get_by_role('button',name='讨论：移除554',exact=True).click();expect(page.get_by_role('heading',name='采纳前，看清这次变化')).to_be_visible();page.get_by_role('button',name='明确采纳此方案',exact=True).click();expect(page.locator('.plan-stats').get_by_text('18',exact=True)).to_be_visible();page.get_by_role('button',name='撤回上次修改',exact=True).click();expect(page.locator('.plan-stats').get_by_text('22',exact=True)).to_be_visible()
  record['checks'].append('discussion18 explicitadoption and undo22')
  page.get_by_role('button',name='竞价建议',exact=True).click();page.get_by_label('总预算（你确认的分数）').fill('100');page.get_by_label('当前草案分数').first.fill('101');expect(page.get_by_role('alert')).to_contain_text('超额');expect(page.get_by_role('button',name='保存这份预算草案',exact=True)).to_be_disabled()
  record['checks'].append('100budget101draft rejected without losing input')
  page.get_by_label('已占用／不可再用').fill('10');page.get_by_label('总预算（你确认的分数）').fill('5');page.reload(wait_until='domcontentloaded');expect(page.locator('.plan-stats').get_by_text('22',exact=True)).to_be_visible();expect(page.locator('.plan-stats').get_by_text('7',exact=True)).to_be_visible();page.get_by_role('button',name='竞价建议',exact=True).click();expect(page.get_by_label('总预算（你确认的分数）')).to_have_value('5');expect(page.get_by_label('已占用／不可再用')).to_have_value('10');expect(page.get_by_role('alert')).to_contain_text('已占用不能大于总预算')
  record['checks'].append('publicorigin localStorage persists22/7 and invalid budget5/used10 across reload')
  mobile_context=browser.new_context(viewport={'width':390,'height':844})
  mobile=mobile_context.new_page();mobile.set_default_timeout(15000);mobile.on('pageerror',lambda e:record['pageErrors'].append(str(e)));mobile.goto(URL,wait_until='domcontentloaded');expect(mobile.locator('.course-card')).to_have_count(20);expect(mobile.locator('.plan-stats').get_by_text('0',exact=True).first).to_be_visible();expect(mobile.locator('#personal-conditions')).not_to_be_visible();assert mobile.evaluate('document.documentElement.scrollWidth==innerWidth');record['mobileFirstCourseY']=mobile.locator('.course-card').first.bounding_box()['y'];mobile.get_by_role('textbox',name='搜索课程',exact=True).fill('878');expect(mobile.locator('.course-card h3')).to_have_text('Building Adaptive Enterprises: Supply Chains, Geopolitical Risks, and National Security');assert mobile.evaluate('document.documentElement.scrollWidth==innerWidth');mobile.screenshot(path=str(out/'live-review-mobile.png'),full_page=False)
  record['checks'].append('separatebrowsercontext empty personalstate;390px conditioncollapsed,long878title,nooverflow')
  record['onlineAssets']=page.evaluate("Array.from(document.querySelectorAll('script[src],link[rel=stylesheet]')).map(e=>e.src||e.href)")
  assert all('/class-planning-assistant/assets/' in x for x in record['onlineAssets'])
  assert not record['pageErrors'] and not record['badResponses'] and not record['failedRequests']
  record['status']='passed_real_online_core_review_with_stated_limitations'
  browser.close()
except Exception as e:
 record['status']='blocked_or_failed';record['exception']=str(e)
record['finishedAt']=datetime.now(timezone.utc).isoformat()
(out/'live-review-evidence.json').write_text(json.dumps(record,ensure_ascii=False,indent=2))
print(json.dumps(record,ensure_ascii=False))
