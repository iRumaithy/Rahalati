import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  try{
    const body=await req.json().catch(()=>({}));
    const identifier=String(body?.identifier??"").trim().toLowerCase(),password=String(body?.password??"");
    if(!identifier||identifier.length>320||!password||password.length>1024)return json({error:"INVALID_CREDENTIALS"},401);
    const url=Deno.env.get("SUPABASE_URL"),anonKey=Deno.env.get("SUPABASE_ANON_KEY"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!anonKey||!serviceKey)return json({error:"SERVER_CONFIGURATION"},500);
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    let email=identifier;
    if(!identifier.includes("@")){
      if(!/^[a-z0-9._-]{3,30}$/.test(identifier))return json({error:"INVALID_CREDENTIALS"},401);
      const {data:profile,error}=await admin.from("rahalati_profiles").select("email,status").eq("username",identifier).maybeSingle();
      if(error||!profile?.email||profile.status!=="active")return json({error:"INVALID_CREDENTIALS"},401);email=profile.email;
    }else{
      const {data:profile}=await admin.from("rahalati_profiles").select("status").ilike("email",identifier).maybeSingle();
      if(!profile||profile.status!=="active")return json({error:"INVALID_CREDENTIALS"},401);
    }
    const client=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error||!data.session)return json({error:"INVALID_CREDENTIALS"},401);
    return json({access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_in:data.session.expires_in,token_type:data.session.token_type});
  }catch(e){console.error("rahalati-login",e instanceof Error?e.message:"unknown");return json({error:"UNABLE_TO_SIGN_IN"},500)}
});
