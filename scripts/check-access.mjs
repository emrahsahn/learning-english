import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { resolve } from "node:path";
async function withServer(port,password,check) {
  const child=spawn(process.execPath,[resolve("node_modules/next/dist/bin/next"),"start","--port",String(port)],{env:{...process.env,NODE_ENV:"production",SITE_PASSWORD:password},stdio:["ignore","pipe","pipe"]});
  try {
    await new Promise((done,fail)=>{const timeout=setTimeout(()=>fail(new Error("Server start timed out")),30000);child.on("error",fail);child.on("exit",code=>fail(new Error(`Server exited ${code}`)));child.stdout.on("data",chunk=>{if(chunk.toString().includes("Ready")){clearTimeout(timeout);done();}});child.stderr.on("data",chunk=>process.stderr.write(chunk));});
    await check(`http://localhost:${port}`);
  } finally {child.kill();}
}
await withServer(3002,"test-only-access-password-not-a-user-secret",async base=>{
  let r=await fetch(base+"/",{redirect:"manual"});assert.equal(r.status,307);assert.ok(r.headers.get("location").endsWith("/unlock"));
  r=await fetch(base+"/data/eng-tr-dictionary.json",{redirect:"manual"});assert.equal(r.status,401);
  r=await fetch(base+"/api/unlock",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:"wrong"})});assert.equal(r.status,401);
  r=await fetch(base+"/api/unlock",{method:"POST",headers:{"Content-Type":"application/json",origin:base},body:JSON.stringify({password:"test-only-access-password-not-a-user-secret"})});assert.equal(r.status,200);
  const cookie=r.headers.get("set-cookie");assert.ok(cookie.includes("HttpOnly"));assert.ok(cookie.includes("SameSite=strict"));const token=cookie.split(";")[0];
  r=await fetch(base+"/",{headers:{cookie:token}});assert.equal(r.status,200);
  r=await fetch(base+"/data/eng-tr-dictionary.json",{headers:{cookie:token}});assert.equal(r.status,200);
  const forged=token.slice(0,-1)+(token.endsWith("0")?"1":"0");r=await fetch(base+"/",{headers:{cookie:forged},redirect:"manual"});assert.equal(r.status,307);
  r=await fetch(base+"/api/unlock",{method:"POST",headers:{"Content-Type":"application/json",origin:"https://untrusted.example"},body:"{}"});assert.equal(r.status,403);
  r=await fetch(base+"/api/lock",{method:"POST",headers:{origin:base,cookie:token}});assert.equal(r.status,200);assert.ok(r.headers.get("set-cookie").includes("Max-Age=0"));
  console.log("PASS: protected routes/data, incorrect/correct password, signed HttpOnly cookie, forged-cookie rejection, origin check and logout.");
});
await withServer(3003,"",async base=>{const r=await fetch(base+"/",{redirect:"manual"});assert.equal(r.status,307);const login=await fetch(base+"/api/unlock",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});assert.equal(login.status,503);console.log("PASS: production fails closed without SITE_PASSWORD.");});
