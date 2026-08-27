import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm';

const CFG = window.RAHALATI_CONFIG;
const supabase = createClient(CFG.supabaseUrl, CFG.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage
  }
});

const $ = (id) => document.getElementById(id);
const qsa = (sel) => [...document.querySelectorAll(sel)];
const state = { session:null, profile:null, trips:[], currentTrip:null, items:[], releases:[] };

function esc(v=''){return String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]))}
function num(v){return Number(v||0)}
function money(v,currency=state.currentTrip?.currency||'AED'){try{return new Intl.NumberFormat('ar-AE',{maximumFractionDigits:2}).format(num(v))+' '+(currency||'AED')}catch{return `${v} ${currency||'AED'}`}}
function dateAr(v){if(!v)return '—';try{return new Intl.DateTimeFormat('ar-AE',{day:'numeric',month:'short',year:'numeric'}).format(new Date(v+'T12:00:00'))}catch{return v}}
function shortDate(v){if(!v)return '—';try{return new Intl.DateTimeFormat('ar-AE',{day:'numeric',month:'short'}).format(new Date(v+'T12:00:00'))}catch{return v}}
function timeShort(v){return v?String(v).slice(0,5):'—'}
function versionParts(v){return String(v||'0').split('.').map(x=>Number(x)||0).concat([0,0,0]).slice(0,3)}
function compareVersions(a,b){const A=versionParts(a),B=versionParts(b);for(let i=0;i<3;i++){if(A[i]>B[i])return 1;if(A[i]<B[i])return -1}return 0}
function durationDays(t){if(!t?.start_date||!t?.end_date)return null;return Math.max(1,Math.round((new Date(t.end_date+'T12:00:00')-new Date(t.start_date+'T12:00:00'))/86400000)+1)}
function daysUntil(v){if(!v)return null;return Math.max(0,Math.ceil((new Date(v+'T00:00:00')-new Date())/86400000))}
function msg(el,text,type=''){if(!el)return;el.textContent=text||'';el.className='form-message'+(type?` ${type}`:'')}
function openModal(id){$(id)?.classList.add('show')}
function closeModal(id){$(id)?.classList.remove('show')}
function currentBase(){return new URL('./',location.href)}
function activePage(){return document.querySelector('.tabpage.active')?.dataset.page || 'home'}
function hasTrip(){return !!state.currentTrip}

function initGestureLocks(){
  ['gesturestart','gesturechange','gestureend'].forEach(name=>document.addEventListener(name,e=>e.preventDefault(),{passive:false}));
  document.addEventListener('touchmove',e=>{if(e.touches && e.touches.length>1)e.preventDefault()},{passive:false});
}

function setTheme(theme){
  if(theme==='dark') document.documentElement.dataset.theme='dark'; else delete document.documentElement.dataset.theme;
  localStorage.setItem('rahalati-theme',theme);
  if($('themeBtn')) $('themeBtn').textContent=theme==='dark'?'☀':'☾';
}
function toggleTheme(){setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')}

function go(page){
  qsa('.tabpage').forEach(p=>p.classList.toggle('active',p.dataset.page===page));
  qsa('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.target===page));
  $('appViewport')?.scrollTo({top:0,behavior:'smooth'});
}

async function functionCall(slug,body,needsAuth=true){
  const headers={'Content-Type':'application/json','apikey':CFG.supabasePublishableKey};
  if(needsAuth){
    const session=state.session || (await supabase.auth.getSession()).data.session;
    if(!session) throw new Error('AUTH_REQUIRED');
    headers.Authorization=`Bearer ${session.access_token}`;
  }
  const r=await fetch(`${CFG.supabaseUrl}/functions/v1/${slug}`,{method:'POST',headers,body:JSON.stringify(body||{})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok || data?.ok===false || data?.error){const e=new Error(data?.error||`HTTP_${r.status}`);e.detail=data?.detail||'';throw e}
  return data;
}

async function login(identifier,password){
  const data=await functionCall(CFG.functions.login,{identifier,password},false);
  const {error}=await supabase.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
  if(error) throw error;
}

async function loadProfile(){
  const uid=state.session?.user?.id;if(!uid)return;
  const {data,error}=await supabase.from('rahalati_profiles').select('*').eq('id',uid).maybeSingle();
  if(error) throw error;
  if(!data || data.status!=='active') throw new Error('PROFILE_NOT_ACTIVE');
  state.profile=data;
  $('accountName').textContent=data.display_name||data.username||'الحساب';
  $('accountIdentity').textContent=data.email||data.username||'—';
  $('accountRole').textContent=data.role==='owner'?'مالك':'مستخدم';
  $('ownerPanel').classList.toggle('hidden',data.role!=='owner');
}

async function loadTrips(preferredId){
  const {data,error}=await supabase.from('rahalati_trips').select('*').order('start_date',{ascending:true,nullsFirst:false});
  if(error) throw error;
  state.trips=data||[];
  const saved=preferredId||localStorage.getItem('rahalati-current-trip');
  const chosen=state.trips.find(t=>t.id===saved)||state.trips.find(t=>['planned','active'].includes(t.status))||state.trips[0]||null;
  if(chosen){
    state.currentTrip=chosen;
    localStorage.setItem('rahalati-current-trip',chosen.id);
    await loadItems(chosen.id);
  }else{
    state.currentTrip=null;
    state.items=[];
    localStorage.removeItem('rahalati-current-trip');
  }
  renderAll();
}

async function loadItems(tripId){
  if(!tripId){state.items=[];return}
  const {data,error}=await supabase.from('rahalati_trip_items').select('*').eq('trip_id',tripId).order('item_date',{ascending:true,nullsFirst:false}).order('item_time',{ascending:true,nullsFirst:false}).order('sort_order',{ascending:true});
  if(error) throw error;
  state.items=data||[];
}

function itemNotes(i){return i?.details?.notes||''}
function byType(type){return state.items.filter(i=>i.item_type===type)}
function sortedActivities(){return byType('activity').slice().sort((a,b)=>`${a.item_date||'9999'} ${a.item_time||'99'}`.localeCompare(`${b.item_date||'9999'} ${b.item_time||'99'}`))}

function renderEmptyHome(){
  const hero=$('homeHero');
  hero.style.backgroundImage='linear-gradient(135deg,#12372f 0%,#234b40 55%,#8c6b4d 140%)';
  $('heroChip').textContent='✦ ابدأ رحلتك الأولى';
  $('heroStamp').innerHTML='RAHALATI<br>NEW';
  $('heroCity').textContent='رحلتك القادمة';
  $('heroRoute').textContent='أنشئ رحلة جديدة وابدأ التخطيط من الصفر';
  $('heroDates').textContent='—';$('heroDuration').textContent='—';$('daysLeft').textContent='—';
  $('statBookings').textContent='0';$('statPlaces').textContent='0';$('statBudget').textContent='0';$('packingStat').textContent='0/0';
  $('nextPlanDate').textContent='لا توجد رحلة بعد';$('nextPlanTitle').textContent='اضغط + لإنشاء أول رحلة';
  $('homeTimeline').className='timeline empty-state';$('homeTimeline').textContent='بعد إنشاء الرحلة ستظهر أنشطة المخطط هنا.';
  $('homePlaces').innerHTML='<div class="panel empty-state" style="min-width:100%">الأماكن التي تحفظها ستظهر هنا.</div>';
}

function renderHome(){
  const t=state.currentTrip;
  if(!t){renderEmptyHome();return}
  const hero=$('homeHero');
  hero.style.backgroundImage=t.cover_url?`url("${esc(t.cover_url)}")`:'linear-gradient(135deg,#12372f 0%,#234b40 55%,#8c6b4d 140%)';
  $('heroChip').textContent=`✈️ ${t.country||'وجهة'} · الرحلة الحالية`;
  $('heroCity').textContent=t.city||t.title||'رحلتك القادمة';
  $('heroRoute').textContent=[t.title,t.country].filter(Boolean).join(' · ')||'ابدأ التخطيط';
  $('heroStamp').innerHTML=`${esc((t.city||'TRIP').slice(0,9).toUpperCase())}<br>${t.start_date?String(t.start_date).slice(0,4):'NEXT'}`;
  $('heroDates').textContent=t.start_date&&t.end_date?`${shortDate(t.start_date)} — ${shortDate(t.end_date)}`:'—';
  const dur=durationDays(t);$('heroDuration').textContent=dur?`${dur} أيام · ${t.travelers||1} مسافر`:`${t.travelers||1} مسافر`;
  const left=daysUntil(t.start_date);$('daysLeft').textContent=left===null?'—':left;
  $('statBookings').textContent=byType('booking').length;
  $('statPlaces').textContent=byType('place').length;
  $('statBudget').textContent=new Intl.NumberFormat('ar-AE',{notation:'compact',maximumFractionDigits:1}).format(num(t.budget));
  const pack=byType('packing');$('packingStat').textContent=`${pack.filter(i=>i.completed).length}/${pack.length}`;
  const acts=sortedActivities().slice(0,4),tl=$('homeTimeline');
  if(!acts.length){tl.className='timeline empty-state';tl.textContent='لا توجد أنشطة بعد. افتح المخطط واضغط +.';$('nextPlanDate').textContent='لم تتم إضافة أنشطة بعد';$('nextPlanTitle').textContent='ابدأ ببناء يوم الرحلة'}
  else{tl.className='timeline';$('nextPlanDate').textContent=dateAr(acts[0].item_date);$('nextPlanTitle').textContent='أقرب أنشطة الرحلة';tl.innerHTML=acts.map(i=>`<div class="event"><div class="time">${esc(timeShort(i.item_time))}</div><div class="marker"></div><div><b>${esc(i.title)}</b><p>${esc(itemNotes(i)||'نشاط في المخطط')}</p></div></div>`).join('')}
  const places=byType('place').slice(0,4),hp=$('homePlaces');
  hp.innerHTML=places.length?places.map(p=>`<div class="place"><div class="photo">${p.details?.photo_url?`<img src="${esc(p.details.photo_url)}" alt="">`:'⌖'}<span>${p.details?.rating?`★ ${esc(p.details.rating)}`:'محفوظ'}</span></div><div class="p"><b>${esc(p.title)}</b><small>${esc(itemNotes(p)||t.city||'مكان محفوظ')}</small></div></div>`).join(''):'<div class="panel empty-state" style="min-width:100%">لا توجد أماكن محفوظة بعد. افتح «الأماكن» لطلب اقتراحات.</div>';
}

function renderPlan(){
  const box=$('planList');
  if(!hasTrip()){box.innerHTML='<div class="panel empty-state">أنشئ رحلة أولًا من زر +، ثم أضف أنشطة المخطط.</div>';return}
  const acts=sortedActivities();if(!acts.length){box.innerHTML='<div class="panel empty-state">لا توجد أنشطة في المخطط بعد. اضغط + لإضافة نشاط.</div>';return}
  const groups={};acts.forEach(a=>(groups[a.item_date||'بدون تاريخ']??=[]).push(a));
  box.innerHTML=Object.entries(groups).map(([date,items])=>`<div class="plan-card"><div class="plan-date">${date==='بدون تاريخ'?date:dateAr(date)}</div><h3>${esc(state.currentTrip?.city||'الرحلة')}</h3><div class="timeline">${items.map(i=>`<div class="event"><div class="time">${esc(timeShort(i.item_time))}</div><div class="marker"></div><div><b>${esc(i.title)}</b><p>${esc(itemNotes(i))}</p><button class="text-delete" data-delete-item="${i.id}">حذف</button></div></div>`).join('')}</div></div>`).join('');
}

function rowList(items,emptyText){if(!items.length)return `<div class="empty-state">${esc(emptyText)}</div>`;return items.map(i=>`<div class="row"><div><b>${esc(i.title)}</b><small>${esc(itemNotes(i)||dateAr(i.item_date))}</small></div><div style="display:flex;align-items:center;gap:7px">${i.completed?'<span class="badge">جاهز</span>':''}<button class="mini-btn" data-delete-item="${i.id}">حذف</button></div></div>`).join('')}
function renderBookings(){$('bookingList').innerHTML=!hasTrip()?'<div class="empty-state">أنشئ رحلة أولًا، ثم أضف حجوزاتك من زر +.</div>':rowList(byType('booking'),'لا توجد حجوزات بعد. اضغط + لإضافة حجز.')}
function renderPlaces(){$('placesList').innerHTML=!hasTrip()?'<div class="empty-state">أنشئ رحلة أولًا لحفظ الأماكن فيها.</div>':rowList(byType('place'),'لا توجد أماكن محفوظة بعد. اضغط + أو استخدم الاقتراحات أعلاه.')}
function renderDocs(){$('docsList').innerHTML=!hasTrip()?'<div class="empty-state">أنشئ رحلة أولًا، ثم أضف مستندات الرحلة من زر +.</div>':rowList(byType('document'),'لا توجد مستندات بعد. اضغط + لإضافة مستند.')}
function renderBudget(){
  const t=state.currentTrip,expenses=hasTrip()?byType('expense'):[],spent=expenses.reduce((s,e)=>s+num(e.amount),0),total=num(t?.budget),rem=total-spent;
  $('budgetCurrency').textContent=t?.currency||'AED';$('budgetTotal').textContent=money(total,t?.currency||'AED');$('budgetSpent').textContent=money(spent,t?.currency||'AED');$('budgetRemaining').textContent=money(rem,t?.currency||'AED');
  $('expenseList').innerHTML=!hasTrip()?'<div class="empty-state">أنشئ رحلة أولًا، ثم سجل المصروفات من زر +.</div>':(expenses.length?expenses.map(i=>`<div class="row"><div><b>${esc(i.title)}</b><small>${esc(dateAr(i.item_date))}</small></div><div><div class="money">${esc(money(i.amount,i.currency||t.currency))}</div><button class="mini-btn" data-delete-item="${i.id}">حذف</button></div></div>`).join(''):'<div class="empty-state">لا توجد مصروفات مسجلة. اضغط + لإضافة مصروف.</div>');
}
function renderPacking(){
  const box=$('packingList');if(!hasTrip()){box.innerHTML='<div class="empty-state">أنشئ رحلة أولًا، ثم أضف أغراض الشنطة من زر +.</div>';return}
  const pack=byType('packing');if(!pack.length){box.innerHTML='<div class="empty-state">قائمة الشنطة فارغة. اضغط + لإضافة غرض.</div>';return}
  box.innerHTML=pack.map(i=>`<div class="row"><label class="check"><input type="checkbox" data-pack="${i.id}" ${i.completed?'checked':''}><span>${esc(i.title)}</span></label><button class="mini-btn" data-delete-item="${i.id}">حذف</button></div>`).join('');
}
function renderTrips(){
  const box=$('tripList');if(!state.trips.length){box.innerHTML='<div class="empty-state">لا توجد رحلات محفوظة بعد.</div>';return}
  box.innerHTML=state.trips.map(t=>`<div class="trip ${state.currentTrip?.id===t.id?'active':''}"><div><b>${esc(t.title)}</b><p>${esc([t.city,t.country].filter(Boolean).join(' · '))} · ${esc(t.start_date?dateAr(t.start_date):'بدون تاريخ')}</p></div><button data-select-trip="${t.id}">فتح</button></div>`).join('');
}
function renderAll(){renderHome();renderPlan();renderBookings();renderPlaces();renderBudget();renderPacking();renderDocs();renderTrips();prefillSuggestions();bindDynamicHandlers()}

function bindDynamicHandlers(){qsa('[data-delete-item]').forEach(b=>b.onclick=()=>deleteItem(b.dataset.deleteItem));qsa('[data-pack]').forEach(c=>c.onchange=()=>togglePacking(c.dataset.pack,c.checked));qsa('[data-select-trip]').forEach(b=>b.onclick=()=>selectTrip(b.dataset.selectTrip))}

async function selectTrip(id){const t=state.trips.find(x=>x.id===id);if(!t)return;state.currentTrip=t;localStorage.setItem('rahalati-current-trip',id);await loadItems(id);renderAll();closeModal('tripsModal');go('home')}
async function saveTrip(){
  const title=$('tripTitle').value.trim(),country=$('tripCountry').value.trim(),city=$('tripCity').value.trim();if(!title||!country){alert('أدخل اسم الرحلة والدولة.');return}
  const payload={user_id:state.session.user.id,title,country,city,start_date:$('tripStart').value||null,end_date:$('tripEnd').value||null,travelers:Math.max(1,num($('tripTravelers').value)),budget:Math.max(0,num($('tripBudget').value)),currency:($('tripCurrency').value.trim()||'AED').toUpperCase(),cover_url:$('tripCover').value.trim()||null,status:$('tripStatus').value};
  const {data,error}=await supabase.from('rahalati_trips').insert(payload).select().single();if(error){alert('تعذر إنشاء الرحلة: '+error.message);return}
  ['tripTitle','tripCountry','tripCity','tripStart','tripEnd','tripCover'].forEach(id=>$(id).value='');$('tripTravelers').value='1';$('tripBudget').value='0';$('tripCurrency').value='AED';$('tripStatus').value='planned';
  closeModal('tripEditorModal');await loadTrips(data.id);go('home');
}

const ADD_CONTEXT={
  plan:{type:'activity',title:'إضافة نشاط للمخطط',nameLabel:'اسم النشاط',placeholder:'مثال: زيارة متحف أو عشاء',showDate:true,showTime:true,showAmount:false,showCurrency:false,notes:'تفاصيل النشاط أو العنوان'},
  bookings:{type:'booking',title:'إضافة حجز',nameLabel:'اسم الحجز',placeholder:'مثال: فندق، طيران، قطار',showDate:true,showTime:true,showAmount:false,showCurrency:false,notes:'رقم الحجز، شركة الطيران، ملاحظات...'},
  places:{type:'place',title:'إضافة مكان',nameLabel:'اسم المكان',placeholder:'مثال: متحف، مطعم، معلم',showDate:false,showTime:false,showAmount:false,showCurrency:false,notes:'العنوان أو سبب حفظ المكان'},
  budget:{type:'expense',title:'إضافة مصروف',nameLabel:'اسم المصروف',placeholder:'مثال: تذكرة قطار',showDate:true,showTime:false,showAmount:true,showCurrency:true,notes:'تفاصيل إضافية'},
  packing:{type:'packing',title:'إضافة إلى الشنطة',nameLabel:'اسم الغرض',placeholder:'مثال: شاحن، جاكيت',showDate:false,showTime:false,showAmount:false,showCurrency:false,notes:'ملاحظة اختيارية'},
  docs:{type:'document',title:'إضافة مستند',nameLabel:'اسم المستند',placeholder:'مثال: تأمين السفر',showDate:true,showTime:false,showAmount:false,showCurrency:false,notes:'رقم الوثيقة أو ملاحظات'}
};

function resetAddForm(){['itemName','itemDate','itemTime','itemAmount','itemNotes'].forEach(id=>{if($(id))$(id).value=''});if($('itemCurrency'))$('itemCurrency').value=state.currentTrip?.currency||'AED'}
function setFieldVisible(id,visible){const field=$(id)?.closest('.field');if(field)field.style.display=visible?'':'none'}
function refreshAddGrids(){qsa('#addModal .grid').forEach(g=>{const fields=[...g.querySelectorAll('.field')];g.style.display=fields.some(f=>f.style.display!=='none')?'':'none'})}
function configureAddModal(page){
  const cfg=ADD_CONTEXT[page]||ADD_CONTEXT.plan;resetAddForm();$('itemType').value=cfg.type;
  const typeField=$('itemType').closest('.field');if(typeField)typeField.style.display='none';
  const title=$('addModal').querySelector('.sheet h3');if(title)title.textContent=cfg.title;
  const nameField=$('itemName').closest('.field');const label=nameField?.querySelector('label');if(label)label.textContent=cfg.nameLabel;$('itemName').placeholder=cfg.placeholder;
  setFieldVisible('itemDate',cfg.showDate);setFieldVisible('itemTime',cfg.showTime);setFieldVisible('itemAmount',cfg.showAmount);setFieldVisible('itemCurrency',cfg.showCurrency);setFieldVisible('itemNotes',true);
  $('itemNotes').placeholder=cfg.notes;refreshAddGrids();
}
function openContextAdd(){
  if(!hasTrip()){openModal('tripEditorModal');return}
  const page=activePage();if(page==='home'){openModal('tripEditorModal');return}
  configureAddModal(page);openModal('addModal');
}

async function saveItem(){
  if(!hasTrip()){closeModal('addModal');openModal('tripEditorModal');return}
  const title=$('itemName').value.trim();if(!title){alert('اكتب الاسم أولًا.');return}
  const type=$('itemType').value;if(type==='expense' && !$('itemAmount').value){alert('أدخل مبلغ المصروف.');return}
  const details={notes:$('itemNotes').value.trim()};
  const payload={trip_id:state.currentTrip.id,user_id:state.session.user.id,item_type:type,title,item_date:$('itemDate').value||null,item_time:$('itemTime').value||null,amount:$('itemAmount').value?num($('itemAmount').value):null,currency:($('itemCurrency').value.trim()||state.currentTrip.currency||'AED').toUpperCase(),details};
  const {error}=await supabase.from('rahalati_trip_items').insert(payload);if(error){alert('تعذر الحفظ: '+error.message);return}
  resetAddForm();closeModal('addModal');await loadItems(state.currentTrip.id);renderAll();
}
async function deleteItem(id){if(!confirm('حذف هذا العنصر؟'))return;const {error}=await supabase.from('rahalati_trip_items').delete().eq('id',id);if(error){alert(error.message);return}await loadItems(state.currentTrip.id);renderAll()}
async function togglePacking(id,completed){const {error}=await supabase.from('rahalati_trip_items').update({completed,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert(error.message);return}const item=state.items.find(i=>i.id===id);if(item)item.completed=completed;renderHome()}

function prefillSuggestions(){if(!state.currentTrip)return;if(!$('suggestCountry').value)$('suggestCountry').value=state.currentTrip.country||'';if(!$('suggestCity').value)$('suggestCity').value=state.currentTrip.city||''}
async function requestSuggestions(){
  const country=$('suggestCountry').value.trim(),city=$('suggestCity').value.trim();if(!country&&!city){msg($('suggestStatus'),'اكتب الدولة أو المدينة.','error');return}
  $('suggestBtn').disabled=true;msg($('suggestStatus'),'جاري البحث في مصادر الويب…');$('suggestionsList').innerHTML='';
  try{const data=await functionCall(CFG.functions.destinationSuggestions,{country,city});const items=data.items||[];msg($('suggestStatus'),items.length?(data.rated?'النتائج مرتبة وفق التقييم وعدد الآراء.':'تم استخدام دليل السفر العام؛ تفعيل Google Places يضيف التقييمات وعدد الآراء.'):'لم يتم العثور على نتائج.',items.length?'success':'');$('suggestionsList').innerHTML=items.map((p,idx)=>`<div class="suggestion"><div class="suggestion-top"><div><h4>${esc(p.name)}</h4><p>${esc(p.category||'وجهة')} · ${esc(p.address||'')}</p></div><div class="rating">${p.rating?`★ ${esc(p.rating)} · ${new Intl.NumberFormat('ar-AE',{notation:'compact'}).format(num(p.reviews))} رأي`:'دليل عام'}</div></div><div class="suggestion-actions"><button class="add" data-add-suggest="${idx}">+ أضف للرحلة</button>${p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener">المصدر</a>`:''}</div></div>`).join('');qsa('[data-add-suggest]').forEach(b=>b.onclick=()=>addSuggestion(items[Number(b.dataset.addSuggest)]))}catch(e){msg($('suggestStatus'),'تعذر جلب الاقتراحات حاليًا.','error')}finally{$('suggestBtn').disabled=false}
}
async function addSuggestion(p){if(!hasTrip()){openModal('tripEditorModal');alert('أنشئ رحلة أولًا ثم أضف الاقتراحات إليها.');return}const details={notes:[p.category,p.address].filter(Boolean).join(' · '),rating:p.rating,reviews:p.reviews,url:p.url,source:p.source};const {error}=await supabase.from('rahalati_trip_items').insert({trip_id:state.currentTrip.id,user_id:state.session.user.id,item_type:'place',title:p.name,details});if(error){alert(error.message);return}await loadItems(state.currentTrip.id);renderAll();alert('تمت إضافة المكان إلى الرحلة.')}

async function exportBackup(){const {data:trips,error:tErr}=await supabase.from('rahalati_trips').select('*');if(tErr)throw tErr;const {data:items,error:iErr}=await supabase.from('rahalati_trip_items').select('*');if(iErr)throw iErr;const payload={app:'Rahalati',version:CFG.appVersion,exported_at:new Date().toISOString(),profile:{username:state.profile?.username,display_name:state.profile?.display_name},trips:trips||[],items:items||[]};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`rahalati-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}

async function hardRefresh(){$('refreshBtn').classList.add('spinning');try{if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();if(reg){await reg.update();if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'})}}}catch{}setTimeout(()=>location.reload(),180)}
function releaseUrl(release){const path=String(release?.build_path||'').replace(/^\//,'');return path?new URL(path,currentBase()).href:null}
async function acceptUpdate(release){try{await supabase.from('rahalati_user_versions').upsert({user_id:state.session.user.id,installed_version:release.version,deferred_version:null,last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'user_id'})}catch(e){console.warn('version state',e)}const target=releaseUrl(release);if(target){location.href=target}else{hardRefresh()}}

async function checkReleases(){
  try{const {data,error}=await supabase.from('rahalati_releases').select('*');if(error)throw error;state.releases=data||[];const stable=state.releases.filter(r=>r.channel==='stable'&&r.status==='published').sort((a,b)=>compareVersions(b.version,a.version))[0];const candidate=state.profile?.role==='owner'?state.releases.find(r=>r.channel==='candidate'&&['testing','approved'].includes(r.status)):null;const banner=$('updateBanner');banner.classList.add('hidden');banner.innerHTML='';
    if(candidate){banner.innerHTML=`<b>نسخة تجريبية للمالك فقط: v${esc(candidate.version)}</b><p>${esc(candidate.notes||'إصدار جاهز للاختبار قبل نشره للمستخدمين.')}</p><div class="update-actions"><button class="light" id="openCandidateBtn">فتح نسخة التجربة</button><button class="outline" id="ownerReleaseBtn">إدارة الإصدار</button></div>`;banner.classList.remove('hidden');$('openCandidateBtn').onclick=()=>{const target=releaseUrl(candidate);if(target)location.href=target};$('ownerReleaseBtn').onclick=()=>{openModal('accountModal');showOwnerTab('releases')}}
    else if(stable && compareVersions(stable.version,CFG.appVersion)>0){const deferred=localStorage.getItem('rahalati-deferred-version');if(deferred===stable.version)return;banner.innerHTML=`<b>تحديث جديد متوفر: v${esc(stable.version)}</b><p>${esc(stable.notes||'يتوفر إصدار جديد. خذ نسخة احتياطية قبل التحديث إذا رغبت.')}</p><div class="update-actions"><button class="light" id="updateNowBtn">تحديث الآن</button><button class="outline" id="backupBeforeUpdateBtn">نسخة احتياطية</button><button class="outline" id="deferUpdateBtn">لاحقًا</button></div>`;banner.classList.remove('hidden');$('updateNowBtn').onclick=()=>acceptUpdate(stable);$('backupBeforeUpdateBtn').onclick=()=>exportBackup().catch(e=>alert(e.message));$('deferUpdateBtn').onclick=()=>{localStorage.setItem('rahalati-deferred-version',stable.version);banner.classList.add('hidden')}}
  }catch(e){console.warn('release check',e)}
}

async function loadUsers(){if(state.profile?.role!=='owner')return;const box=$('usersList');box.innerHTML='<div class="empty-state">جاري التحميل…</div>';try{const data=await functionCall(CFG.functions.adminUsers,{action:'list'});renderUsers(data.users||[])}catch(e){box.innerHTML='<div class="empty-state">تعذر تحميل المستخدمين.</div>'}}
function renderUsers(users){$('usersList').innerHTML=users.length?users.map(u=>`<div class="user-row"><div class="user-main"><div><b>${esc(u.display_name||u.username||u.email)}</b><small>${esc(u.username||'')} · ${esc(u.email||'')}</small></div><span class="badge">${u.role==='owner'?'مالك':u.status==='active'?'نشط':'معطل'}</span></div>${u.role==='user'?`<div class="user-actions"><button data-user-status="${u.id}" data-next="${u.status==='active'?'disabled':'active'}">${u.status==='active'?'تعطيل':'تفعيل'}</button><button data-user-reset="${u.id}">تعيين كلمة مرور</button></div>`:''}</div>`).join(''):'<div class="empty-state">لا يوجد مستخدمون.</div>';qsa('[data-user-status]').forEach(b=>b.onclick=()=>setUserStatus(b.dataset.userStatus,b.dataset.next));qsa('[data-user-reset]').forEach(b=>b.onclick=()=>resetUserPassword(b.dataset.userReset))}
async function createUser(){msg($('userAdminMessage'),'');try{const payload={action:'create',display_name:$('newUserName').value.trim(),username:$('newUsername').value.trim(),email:$('newUserEmail').value.trim(),password:$('newUserPassword').value};await functionCall(CFG.functions.adminUsers,payload);msg($('userAdminMessage'),'تم إنشاء المستخدم.','success');['newUserName','newUsername','newUserEmail','newUserPassword'].forEach(id=>$(id).value='');await loadUsers()}catch(e){msg($('userAdminMessage'),'تعذر إنشاء المستخدم: '+e.message,'error')}}
async function setUserStatus(id,status){if(!confirm(status==='disabled'?'تعطيل هذا المستخدم؟':'إعادة تفعيل المستخدم؟'))return;try{await functionCall(CFG.functions.adminUsers,{action:'set-status',user_id:id,status});await loadUsers()}catch(e){alert(e.message)}}
async function resetUserPassword(id){const password=prompt('أدخل كلمة مرور مؤقتة جديدة (8 أحرف على الأقل):');if(!password)return;if(password.length<8){alert('كلمة المرور قصيرة.');return}try{await functionCall(CFG.functions.adminUsers,{action:'reset-password',user_id:id,password});alert('تم تحديث كلمة المرور.')}catch(e){alert(e.message)}}

function showOwnerTab(tab){qsa('.owner-tab').forEach(b=>b.classList.toggle('active',b.dataset.ownerTab===tab));qsa('.owner-tabpage').forEach(p=>p.classList.toggle('active',p.dataset.ownerPage===tab));if(tab==='users')loadUsers();else refreshReleaseAdmin()}
async function refreshReleaseAdmin(){if(state.profile?.role!=='owner')return;const box=$('releaseStatus');box.innerHTML='<div class="empty-state">جاري التحميل…</div>';try{const data=await functionCall(CFG.functions.releaseManager,{action:'status'});const s=data.stable,c=data.candidate;box.innerHTML=`${s?`<div class="release-card"><b>الإصدار المنشور v${esc(s.version)}</b><p>${esc(s.notes||'')}</p></div>`:'<div class="release-card">لا يوجد إصدار منشور.</div>'}${c?`<div class="release-card"><b>مرشح v${esc(c.version)} · ${esc(c.status)}</b><p>${esc(c.notes||'')}</p><div class="release-actions"><button data-release-action="open">فتح التجربة</button>${!c.tested_at?'<button data-release-action="mark-tested">تم الاختبار</button>':''}${c.tested_at&&c.status==='testing'?'<button class="secondary" data-release-action="approve">اعتماد</button>':''}${c.status==='approved'?'<button class="secondary" data-release-action="publish">نشر للمستخدمين</button>':''}<button data-release-action="reject">رفض</button></div></div>`:'<div class="release-card"><b>لا يوجد إصدار مرشح.</b><p>المستخدمون لا يرون أي تحديث قبل مرحلة النشر.</p></div>'}`;qsa('[data-release-action]').forEach(b=>b.onclick=()=>releaseAction(b.dataset.releaseAction,c))}catch(e){box.innerHTML='<div class="empty-state">تعذر قراءة حالة الإصدارات.</div>'}}
async function stageRelease(){msg($('releaseMessage'),'');try{const version=$('candidateVersion').value.trim();const buildPath=`/releases/v${version}/`;if($('candidatePath'))$('candidatePath').value=buildPath;await functionCall(CFG.functions.releaseManager,{action:'stage',version,notes:$('candidateNotes').value.trim(),build_path:buildPath});msg($('releaseMessage'),'تم إرسال الإصدار إلى قناة المالك فقط.','success');await refreshReleaseAdmin();await checkReleases()}catch(e){msg($('releaseMessage'),'تعذر تجهيز الإصدار: '+e.message,'error')}}
async function releaseAction(action,c){if(action==='open'){const target=releaseUrl(c);if(target)location.href=target;return}const promptText={"mark-tested":'تأكيد أنك اختبرت النسخة؟',approve:'اعتماد النسخة بعد الاختبار؟',publish:'نشر هذا الإصدار لجميع المستخدمين؟',reject:'رفض النسخة المرشحة؟'}[action];if(promptText&&!confirm(promptText))return;try{await functionCall(CFG.functions.releaseManager,{action});await refreshReleaseAdmin();await checkReleases()}catch(e){alert(e.message)}}

function showSyncError(error){
  console.error(error);
  const banner=$('updateBanner');banner.innerHTML='<b>تعذر مزامنة البيانات مؤقتًا</b><p>تم الاحتفاظ بتسجيل الدخول. تحقق من الاتصال ثم اضغط تحديث.</p><div class="update-actions"><button class="light" id="retrySyncBtn">إعادة المحاولة</button></div>';banner.classList.remove('hidden');
  setTimeout(()=>{$('retrySyncBtn')?.addEventListener('click',()=>location.reload())},0);
}
async function showApp(session){
  state.session=session;$('loginView').classList.add('hidden');$('appShell').classList.remove('hidden');
  try{await loadProfile()}catch(e){if(e.message==='PROFILE_NOT_ACTIVE'){alert('هذا الحساب غير مفعل لتطبيق رحلاتي.');await supabase.auth.signOut();return}showSyncError(e);return}
  try{await loadTrips();await checkReleases();if(state.profile.role==='owner')refreshReleaseAdmin()}catch(e){state.currentTrip=null;state.items=[];renderAll();showSyncError(e)}
}
function showLogin(){state.session=null;state.profile=null;$('appShell').classList.add('hidden');$('loginView').classList.remove('hidden')}
async function registerSW(){if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('./sw.js',{scope:'./'})}catch(e){console.warn('SW',e)}}}

function bindStaticHandlers(){
  qsa('.navbtn').forEach(b=>b.addEventListener('click',()=>go(b.dataset.target)));qsa('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goto)));qsa('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));qsa('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));
  $('themeBtn').onclick=toggleTheme;$('refreshBtn').onclick=hardRefresh;$('accountRefreshBtn').onclick=hardRefresh;$('accountBtn').onclick=()=>{openModal('accountModal');if(state.profile?.role==='owner')loadUsers()};$('fab').onclick=openContextAdd;$('openTripsBtn').onclick=()=>{renderTrips();openModal('tripsModal')};$('newTripBtn').onclick=()=>{closeModal('tripsModal');openModal('tripEditorModal')};$('saveTripBtn').onclick=saveTrip;$('saveItemBtn').onclick=saveItem;$('suggestBtn').onclick=requestSuggestions;$('backupBtn').onclick=()=>exportBackup().catch(e=>alert(e.message));$('logoutBtn').onclick=()=>supabase.auth.signOut();$('refreshUsersBtn').onclick=loadUsers;$('createUserBtn').onclick=createUser;$('stageReleaseBtn').onclick=stageRelease;qsa('.owner-tab').forEach(b=>b.onclick=()=>showOwnerTab(b.dataset.ownerTab));
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg($('loginMessage'),'جاري تسجيل الدخول…');try{await login($('loginIdentifier').value,$('loginPassword').value);msg($('loginMessage'),'تم تسجيل الدخول.','success')}catch(err){msg($('loginMessage'),'بيانات الدخول غير صحيحة أو الحساب غير مفعل.','error')}});
  $('pageVersion').textContent=CFG.appVersion;
}

async function boot(){
  initGestureLocks();setTheme(localStorage.getItem('rahalati-theme')==='dark'?'dark':'light');bindStaticHandlers();registerSW();
  try{const {data:{session},error}=await supabase.auth.getSession();if(error)console.warn('session restore',error);if(session)await showApp(session);else showLogin()}catch(e){console.warn('boot session',e);showLogin()}
  supabase.auth.onAuthStateChange(async(event,session)=>{if(event==='SIGNED_OUT'){showLogin();return}if(session){if(!state.session||state.session.user.id!==session.user.id)await showApp(session);else state.session=session}});
}
boot();
