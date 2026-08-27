import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm';

const CFG=window.RAHALATI_CONFIG;
if(!CFG) throw new Error('RAHALATI_CONFIG_MISSING');
const supabase=createClient(CFG.supabaseUrl,CFG.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:localStorage}});

function versionParts(v){return String(v||'0').split('.').map(x=>Number(x)||0).concat([0,0,0]).slice(0,3)}
function compareVersions(a,b){const A=versionParts(a),B=versionParts(b);for(let i=0;i<3;i++){if(A[i]>B[i])return 1;if(A[i]<B[i])return -1}return 0}
function appRootUrl(){
  const u=new URL(location.href);let path=u.pathname;
  const releaseAt=path.indexOf('/releases/'),candidateAt=path.indexOf('/candidate/');
  if(releaseAt>=0)path=path.slice(0,releaseAt+1);else if(candidateAt>=0)path=path.slice(0,candidateAt+1);else path=path.endsWith('/')?path:path.slice(0,path.lastIndexOf('/')+1);
  u.pathname=path;u.search='';u.hash='';return u;
}
function releaseUrl(path){const clean=String(path||'/').replace(/^\/+/, '');return new URL(clean||'./',appRootUrl()).href}
function sameLocation(path){try{const a=new URL(releaseUrl(path)),b=new URL(location.href);return a.origin===b.origin&&a.pathname.replace(/index\.html$/,'')===b.pathname.replace(/index\.html$/,'')}catch{return false}}
async function session(){return (await supabase.auth.getSession()).data.session}
async function latestStable(){const {data}=await supabase.from('rahalati_releases').select('*').eq('channel','stable').eq('status','published').order('published_at',{ascending:false}).limit(1).maybeSingle();return data||null}
async function versionState(uid){const {data}=await supabase.from('rahalati_user_versions').select('*').eq('user_id',uid).maybeSingle();return data||null}
async function writeVersion(uid,values){await supabase.from('rahalati_user_versions').upsert({user_id:uid,last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString(),...values},{onConflict:'user_id'})}
async function installStable(){
  const s=await session();if(!s)return;
  const stable=await latestStable();if(!stable||compareVersions(stable.version,CFG.appVersion)<=0)return location.reload();
  await writeVersion(s.user.id,{installed_version:stable.version,deferred_version:null});
  localStorage.removeItem('rahalati-deferred-version');
  const target=stable.build_path||'/';if(sameLocation(target))return location.reload();location.href=releaseUrl(target);
}
async function resumeAcceptedRelease(){
  const s=await session();if(!s)return;
  const stable=await latestStable();if(!stable||compareVersions(stable.version,CFG.appVersion)<=0)return;
  const vs=await versionState(s.user.id);if(vs?.installed_version&&compareVersions(vs.installed_version,stable.version)>=0&&!sameLocation(stable.build_path||'/'))location.replace(releaseUrl(stable.build_path||'/'));
}
function ensureCandidatePath(){
  const version=document.getElementById('candidateVersion')?.value?.trim(),path=document.getElementById('candidatePath');
  if(version&&path&&(!path.value.trim()||path.value.trim()==='/candidate/'))path.value=`/releases/v${version}/`;
}

document.addEventListener('input',e=>{if(e.target?.id==='candidateVersion')ensureCandidatePath()},true);
document.addEventListener('click',async e=>{
  const target=e.target?.closest?.('button,a');if(!target)return;
  if(target.id==='stageReleaseBtn'){ensureCandidatePath();return}
  if(target.id==='updateNowBtn'){
    e.preventDefault();e.stopImmediatePropagation();target.disabled=true;
    try{await installStable()}catch(err){console.error('Rahalati update bridge',err);target.disabled=false;alert('تعذر تثبيت التحديث حاليًا. حاول مرة أخرى.')}
    return;
  }
  if(target.id==='openCandidateBtn'||target.dataset?.releaseAction==='open'){
    const s=await session();if(!s)return;
    const {data}=await supabase.from('rahalati_releases').select('*').eq('channel','candidate').in('status',['testing','approved']).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(data?.build_path){e.preventDefault();e.stopImmediatePropagation();location.href=releaseUrl(data.build_path)}
  }
},true);

window.addEventListener('load',()=>setTimeout(()=>resumeAcceptedRelease().catch(console.warn),700),{once:true});
