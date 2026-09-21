const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let token=localStorage.getItem("forge_token"), me=null, settings=null, current="today", authMode="register";
const sections=[
  ["today","Today","⌂"],["fitness","Fitness","↗"],["nutrition","Nutrition","◒"],["study","Study","▣"],["focus","Focus","◷"],
  ["placement","Placement","◆"],["salah","Salah","☾"],["wellness","Wellness","✦"],["analytics","Analytics","⌁"],["coach","Coach Forge","✎"],["settings","Settings","⚙"]
];
const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const configuredApiUrl = window.FORGE_API_URL && !/localhost|127\.0\.0\.1|::1/i.test(String(window.FORGE_API_URL)) ? window.FORGE_API_URL : "";
const API_BASE_URL = (isLocalhost ? (configuredApiUrl || window.location.origin) : "").replace(/\/$/, "");
const resolveApiUrl = (url) => {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!API_BASE_URL) return url.startsWith("/") ? url : `/${url}`;
  const normalized = url.startsWith("/") ? url.slice(1) : url;
  return `${API_BASE_URL}/${normalized}`;
};
const api=async(url,opt={})=>{
  const requestUrl = resolveApiUrl(url);
  opt.headers={...(opt.headers||{}),...(token?{Authorization:"Bearer "+token}:{})};
  if(opt.body && typeof opt.body!=="string"){opt.headers["Content-Type"]="application/json";opt.body=JSON.stringify(opt.body)}
  const r=await fetch(requestUrl,opt); const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||"Request failed"); return d;
};
const toast=m=>{let t=$("#toast");t.className="toast";t.textContent=m;clearTimeout(window._toast);window._toast=setTimeout(()=>t.className="",2600)};
function renderNav(){ $("#nav").innerHTML=sections.filter(x=>(settings?.nav||sections.map(x=>x[0]).join(",")).split(",").includes(x[0])).map(x=>`<button class="navbtn ${current===x[0]?"active":""}" data-go="${x[0]}"><span>${x[2]}</span>${x[1]}</button>`).join(""); $$(".navbtn").forEach(b=>b.onclick=()=>go(b.dataset.go));}
function setSidebarOpen(open){
  const sidebar=$(".sidebar");
  const backdrop=$("#mobileBackdrop");
  if(!sidebar||!backdrop) return;
  sidebar.classList.toggle("open", open);
  backdrop.classList.toggle("visible", open);
  document.body.classList.toggle("sidebar-open", open);
}
function closeSidebar(){ if (window.innerWidth <= 768) setSidebarOpen(false); }
function go(s){current=s;renderNav();$("#crumb").textContent=s==="today"?"COMMAND CENTER":s.toUpperCase();$("#pageTitle").textContent=sections.find(x=>x[0]===s)?.[1]||s;$("#content").innerHTML="";renderSection(s);closeSidebar();}
document.addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(b&&b.closest(".top-actions"))go(b.dataset.go)});
$("#mobileMenu").onclick=()=>setSidebarOpen($(".sidebar").classList.contains("open") ? false : true);
$("#mobileBackdrop").onclick=()=>setSidebarOpen(false);
window.addEventListener("resize",()=>{if(window.innerWidth>768)setSidebarOpen(false);});

function empty(text){return `<div class="empty">${text}</div>`}
function metricCard(label,key,val,sub=""){return `<div class="metric"><div class="label">${label}</div><div class="value">${val??"—"}</div><div class="sub">${sub}</div></div>`}

async function renderSection(s){
 try{
  if(s==="today")return await todayView();
  if(s==="fitness")return await fitnessView();
  if(s==="nutrition")return await nutritionView();
  if(s==="study")return await studyView();
  if(s==="focus")return await focusView();
  if(s==="placement")return await placementView();
  if(s==="salah")return await salahView();
  if(s==="wellness")return await wellnessView();
  if(s==="analytics")return await analyticsView();
  if(s==="coach")return await coachView();
  if(s==="settings")return await settingsView();
 }catch(e){$("#content").innerHTML=empty(e.message);toast(e.message)}
}

async function todayView(){
 const date=new Date().toISOString().slice(0,10), [m, tasks, meals, focus]=await Promise.all([api("/api/metrics?from="+date),api("/api/tasks"),api("/api/meals?date="+date),api("/api/focus")]);
 const x=m[0]||{}; const t=tasks.filter(t=>!t.dueDate||t.dueDate===date), done=t.filter(t=>t.completed).length, score=t.length?Math.round(done/t.length*100):0;
 $("#content").innerHTML=`
 <div class="hero row"><div><span class="eyebrow">TODAY / ${date}</span><h1 style="font:700 36px Space Grotesk;margin:8px 0">Build the day you actually want.</h1><p class="muted">No seeded numbers. Everything here comes from your account.</p></div><div class="metric" style="min-width:150px"><div class="label">Execution</div><div class="big accent">${score}%</div></div></div>
 <div class="grid g4" style="margin-top:14px">${metricCard("Body weight","weight",x.weight?x.weight+" kg":"—","log today's metric in Settings or Analytics")}${metricCard("Calories","calories",x.calories??"—","kcal")}${metricCard("Protein","protein",x.protein?x.protein+" g":"—","grams")}${metricCard("Water","water",x.water?x.water+" ml":"—","ml")}</div>
 <div class="grid g3" style="margin-top:14px"><div class="card"><h3>Daily execution</h3><div class="stack">${t.length?t.slice(0,8).map(q=>`<label class="listitem row"><span><input class="check taskcheck" data-id="${q.id}" type="checkbox" ${q.completed?"checked":""}> ${q.title}</span><small class="muted">${q.bucket}</small></label>`).join(""):empty("Create your first task.")}</div><button class="mini-btn" id="addTask" style="margin-top:10px">+ Add task</button></div>
 <div class="card"><h3>Fuel plan</h3>${meals.length?`<div class="list">${meals.map(q=>`<label class="listitem row"><span><input class="check mealcheck" data-id="${q.id}" type="checkbox" ${q.completed?"checked":""}> ${q.name}</span><span class="muted">${q.calories??"—"} kcal</span></label>`).join("")}</div>`:empty("No meals logged for today.")}<button class="mini-btn" id="addMeal" style="margin-top:10px">+ Log meal</button></div>
 <div class="card"><h3>Focus today</h3><div class="big">${Math.round(focus.filter(q=>q.startedAt.slice(0,10)===date).reduce((a,q)=>a+q.duration,0)/60)}<span style="font-size:18px"> min</span></div><p class="muted">Completed focus sessions will appear here.</p><button class="mini-btn" data-go="focus">Open Focus</button></div></div>`;
 $$(".taskcheck").forEach(c=>c.onchange=async()=>{await api("/api/tasks/"+c.dataset.id,{method:"PATCH",body:{completed:c.checked}});toast("Task updated");await todayView()});
 $$(".mealcheck").forEach(c=>c.onchange=async()=>{await api("/api/meals/"+c.dataset.id,{method:"PATCH",body:{completed:c.checked}});toast("Meal updated");await todayView()});
 $("#addTask").onclick=async()=>{let title=prompt("Task title");if(title){await api("/api/tasks",{method:"POST",body:{title,dueDate:date}});await todayView()}};
 $("#addMeal").onclick=async()=>{let name=prompt("Meal name");if(name){await api("/api/meals",{method:"POST",body:{name,date,mealType:"Meal"}});await todayView()}};
}

async function fitnessView(){
 const [ex,logs]=await Promise.all([api("/api/exercises"),api("/api/workouts")]);
 $("#content").innerHTML=`<div class="grid" style="grid-template-columns:1.4fr .6fr"><div class="hero"><span class="eyebrow">TRAINING WORKSPACE</span><h1 style="font:700 34px Space Grotesk">Push / Pull / Legs — your log, not a template.</h1><p class="muted">Create exercises and record every set. No demo exercises are inserted.</p><div class="chips" style="margin-top:18px"><span class="chip">Progressive overload</span><span class="chip">Set logger</span><span class="chip">PR history</span></div></div><div class="card"><h3>Session controls</h3><button class="primary small" id="addExercise">+ Add exercise</button><p class="muted">Rest timer</p><button class="mini-btn" id="rest">Start 90s rest</button><div id="restOut" class="accent" style="margin-top:8px"></div></div></div>
 <div class="card" style="margin-top:14px"><div class="row"><h3>Exercise library</h3><span class="muted">${ex.length} exercises</span></div>${ex.length?`<table class="table"><thead><tr><th>Exercise</th><th>Muscle</th><th>Equipment</th><th></th></tr></thead><tbody>${ex.map(e=>`<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.muscle||"—")}</td><td>${esc(e.equipment||"—")}</td><td><button class="mini-btn logset" data-id="${e.id}">Log set</button> <button class="mini-btn delEx danger" data-id="${e.id}">Delete</button></td></tr>`).join("")}</tbody></table>`:empty("Add your first exercise to start training.")}</div>
 <div class="card" style="margin-top:14px"><h3>Recent sets</h3>${logs.length?`<table class="table"><thead><tr><th>Date</th><th>Exercise</th><th>Set</th><th>Reps</th><th>Weight</th></tr></thead><tbody>${logs.slice(0,20).map(l=>`<tr><td>${l.date}</td><td>${esc(l.exercise.name)}</td><td>${l.setNo}</td><td>${l.reps}</td><td>${l.weight} kg</td></tr>`).join("")}</tbody></table>`:empty("No sets logged yet.")}</div>`;
 $("#addExercise").onclick=async()=>{let name=prompt("Exercise name");if(!name)return;let muscle=prompt("Muscle group (optional)")||"",equipment=prompt("Equipment (optional)")||"";await api("/api/exercises",{method:"POST",body:{name,muscle,equipment}});toast("Exercise saved");await fitnessView()};
 $$(".delEx").forEach(b=>b.onclick=async()=>{if(confirm("Delete this exercise and its sets?")){await api("/api/exercises/"+b.dataset.id,{method:"DELETE"});await fitnessView()}});
 $$(".logset").forEach(b=>b.onclick=async()=>{let reps=prompt("Reps");if(reps===null)return;let weight=prompt("Weight (kg)","0");let setNo=prompt("Set number","1");await api("/api/workouts",{method:"POST",body:{exerciseId:b.dataset.id,reps:Number(reps),weight:Number(weight||0),setNo:Number(setNo||1),date:new Date().toISOString().slice(0,10)}});toast("Set logged");await fitnessView()});
 $("#rest").onclick=()=>{let n=90;const out=$("#restOut");out.textContent="01:30";clearInterval(window.rest);window.rest=setInterval(()=>{n--;out.textContent=`00:${String(Math.max(n,0)).padStart(2,"0")}`;if(n<=0)clearInterval(window.rest)},1000)}
}

async function nutritionView(){
 const date=new Date().toISOString().slice(0,10), meals=await api("/api/meals?date="+date), m=(await api("/api/metrics?from="+date))[0]||{};
 const cal=meals.reduce((a,x)=>a+(x.calories||0),0),pro=meals.reduce((a,x)=>a+(x.protein||0),0);
 $("#content").innerHTML=`<div class="hero"><span class="eyebrow">FUEL WORKSPACE</span><div class="row"><div><h1 style="font:700 34px Space Grotesk">Meals, macros, consistency.</h1><p class="muted">Only logged food counts. Nothing is prefilled.</p></div><button class="primary small" id="mealAdd">+ Log food</button></div></div>
 <div class="grid g3" style="margin-top:14px">${metricCard("Calories",null,cal+" kcal",settings?.calorieTarget?`target ${settings.calorieTarget} kcal`:"set a target in Settings")}${metricCard("Protein",null,pro+" g",settings?.proteinTarget?`target ${settings.proteinTarget} g`:"set a target in Settings")}${metricCard("Water",null,(m.water||0)+" ml",settings?.waterTarget?`target ${settings.waterTarget} ml`:"")}</div>
 <div class="card" style="margin-top:14px"><h3>Today's meals</h3>${meals.length?`<div class="list">${meals.map(x=>`<div class="listitem row"><div><b>${esc(x.name)}</b><div class="muted">${x.mealType} · ${x.protein??"—"}g protein · ${x.carbs??"—"}g carbs · ${x.fats??"—"}g fat</div></div><b>${x.calories??"—"} kcal</b></div>`).join("")}</div>`:empty("Log breakfast, lunch, snacks or dinner.")}</div>`;
 $("#mealAdd").onclick=async()=>{let name=prompt("Food / meal");if(!name)return;let type=prompt("Meal type","Dinner")||"Meal",cal=prompt("Calories (optional)",""),pro=prompt("Protein g (optional)","");await api("/api/meals",{method:"POST",body:{name,mealType:type,date,calories:cal===""?null:Number(cal),protein:pro===""?null:Number(pro)}});toast("Meal saved");await nutritionView()}
}

async function studyView(){
 const logs=await api("/api/study"); const subjects=[...new Set(logs.map(x=>x.subject))];
 $("#content").innerHTML=`<div class="hero"><span class="eyebrow">STUDY WORKSPACE</span><h1 style="font:700 34px Space Grotesk">Study like a training block.</h1><p class="muted">Your subjects, minutes and problem counts live in your account.</p></div>
 <div class="grid g2" style="margin-top:14px"><div class="card"><h3>Log study block</h3><div class="formgrid"><label class="field">Subject<input id="stSub"></label><label class="field">Minutes<input id="stMin" type="number" min="0"></label><label class="field">Solved<input id="stSol" type="number" min="0" value="0"></label><label class="field">Failed<input id="stFail" type="number" min="0" value="0"></label></div><button class="primary small" id="stSave">Save block</button></div><div class="card"><h3>Subjects</h3>${subjects.length?`<div class="chips">${subjects.map(s=>`<span class="chip">${esc(s)}</span>`).join("")}</div>`:empty("No subjects logged yet.")}</div></div>
 <div class="card" style="margin-top:14px"><h3>Study history</h3>${logs.length?`<table class="table"><thead><tr><th>Date</th><th>Subject</th><th>Minutes</th><th>Solved</th><th>Failed</th></tr></thead><tbody>${logs.map(x=>`<tr><td>${x.date}</td><td>${esc(x.subject)}</td><td>${x.minutes}</td><td>${x.solved}</td><td>${x.failed}</td></tr>`).join("")}</tbody></table>`:empty("Start your first study block.")}</div>`;
 $("#stSave").onclick=async()=>{let subject=$("#stSub").value.trim(),minutes=Number($("#stMin").value);if(!subject||!minutes)return toast("Subject and minutes are required");await api("/api/study",{method:"POST",body:{subject,minutes,solved:Number($("#stSol").value||0),failed:Number($("#stFail").value||0)}});toast("Study block saved");await studyView()}
}

async function focusView(){
 $("#content").innerHTML=`<div class="timer-console"><div class="timer-inner"><span class="eyebrow">FOCUS CONSOLE</span><div class="timer" id="clock">25:00</div><div class="tabs">${["Pomodoro","Deep Work","Stopwatch","Custom"].map(x=>`<button class="tab ${x==="Pomodoro"?"active":""}" data-mode="${x}">${x}</button>`).join("")}</div><div class="row" style="justify-content:center"><button class="primary small" id="start">Start</button><button class="mini-btn" id="reset">Reset</button></div><p class="muted" id="focusStatus">Session is not logged until you complete it.</p></div></div>`;
 let mode="Pomodoro",seconds=1500,elapsed=0,running=false; const clock=$("#clock");
 function draw(){let s=mode==="Stopwatch"?elapsed:seconds;clock.textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
 $$(".tab").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;$$(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");if(mode==="Deep Work")seconds=3000;else if(mode==="Custom"){let m=Number(prompt("Custom minutes","30")||30);seconds=m*60}else if(mode==="Stopwatch")elapsed=0;else seconds=1500;draw()});
 $("#start").onclick=()=>{running=!running;$("#start").textContent=running?"Pause":"Start";clearInterval(window.ft);if(running)window.ft=setInterval(async()=>{if(mode==="Stopwatch")elapsed++;else if(seconds>0)seconds--;else{clearInterval(window.ft);running=false;$("#start").textContent="Start";await api("/api/focus",{method:"POST",body:{duration:mode==="Stopwatch"?elapsed:mode==="Deep Work"?50:25,mode,completed:true}});toast("Focus session logged");$("#focusStatus").textContent="Completed session logged."}draw()},1000)};
 $("#reset").onclick=()=>{clearInterval(window.ft);running=false;$("#start").textContent="Start";seconds=mode==="Deep Work"?3000:1500;elapsed=0;draw()};
}

async function placementView(){
 const items=await api("/api/placements"), stages=["Applied","OA","Interview","HR","Offer","Rejected"];
 $("#content").innerHTML=`<div class="hero row"><div><span class="eyebrow">PLACEMENT PIPELINE</span><h1 style="font:700 34px Space Grotesk">Applications as an operating system.</h1></div><button class="primary small" id="addPlacement">+ Add application</button></div><div class="kanban" style="margin-top:14px">${stages.map(s=>`<div class="lane"><h4>${s}</h4><div class="drop">${items.filter(x=>x.stage===s).map(x=>`<div class="listitem"><b>${esc(x.company)}</b><div class="muted">${esc(x.role||"")}</div><select class="stageSelect" data-id="${x.id}" style="width:100%;margin-top:8px;background:#0b0d10;color:#fff;border:1px solid var(--line);padding:7px;border-radius:8px">${stages.map(a=>`<option ${a===x.stage?"selected":""}>${a}</option>`).join("")}</select></div>`).join("")||'<div class="muted">Empty</div>'}</div></div>`).join("")}</div>`;
 $("#addPlacement").onclick=async()=>{let company=prompt("Company");if(!company)return;let role=prompt("Role",""),stage=prompt("Stage","Applied");await api("/api/placements",{method:"POST",body:{company,role,stage:stages.includes(stage)?stage:"Applied"}});toast("Application added");await placementView()};
 $$(".stageSelect").forEach(s=>s.onchange=async()=>{await api("/api/placements/"+s.dataset.id,{method:"PATCH",body:{stage:s.value}});toast("Stage updated");await placementView()})
}

async function salahView(){
 const date=new Date().toISOString().slice(0,10), city=settings?.prayerCity||"Warangal, India";
 const [p,l]=await Promise.all([api("/api/salah/times?city="+encodeURIComponent(city)+"&date="+date),api("/api/salah/logs?date="+date)]);
 const prayers=["Fajr","Dhuhr","Asr","Maghrib","Isha"];
 $("#content").innerHTML=`<div class="hero row"><div><span class="eyebrow">PRAYER CONTROL SURFACE</span><h1 style="font:700 34px Space Grotesk">${esc(city)}</h1><p class="muted">Calculated for ${date}. Refresh recalculates from your selected city.</p></div><button class="primary small" id="refreshPrayer">Refresh times</button></div><div class="grid g3" style="margin-top:14px">${prayers.map(x=>`<div class="card"><div class="row"><h3>${x}</h3><span class="accent">${p.times[x]}</span></div><label class="listitem row"><span>Completed</span><input class="check pray" data-prayer="${x}" type="checkbox" ${l.find(q=>q.prayer===x&&q.done)?"checked":""}></label></div>`).join("")}</div><div class="card" style="margin-top:14px"><h3>Calculation</h3><p class="muted">${p.source}. Set a city in Settings to personalize the schedule.</p></div>`;
 $("#refreshPrayer").onclick=async()=>{await salahView();toast("Prayer times recalculated")};
 $$(".pray").forEach(c=>c.onchange=async()=>{await api("/api/salah/logs/"+c.dataset.prayer,{method:"PUT",body:{date,done:c.checked}});toast("Prayer updated")})
}

async function wellnessView(){
 const items=await api("/api/wellness");
 $("#content").innerHTML=`<div class="hero row"><div><span class="eyebrow">WELLNESS JOURNEY</span><h1 style="font:700 34px Space Grotesk">Routines and visual timeline.</h1><p class="muted">Photo entries are stored against your account. Nothing is seeded.</p></div><button class="primary small" id="addWellness">+ Add entry / photo</button></div><div class="grid g3" style="margin-top:14px">${items.length?items.map(x=>`<div class="card">${x.photoData?`<img src="${x.photoData}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px">`:""}<h3 style="margin-top:12px">${esc(x.title)}</h3><div class="muted">${esc(x.type)} · ${x.date}</div><p class="muted">${esc(x.note||"")}</p><button class="mini-btn delWell danger" data-id="${x.id}">Delete</button></div>`).join(""):empty("No wellness entries yet.")}</div>`;
 $("#addWellness").onclick=async()=>{let title=prompt("Entry title");if(!title)return;let type=prompt("Type","routine")||"routine",note=prompt("Note (optional)")||"";const file=document.createElement("input");file.type="file";file.accept="image/*";file.onchange=async()=>{let data=null;if(file.files[0])data=await new Promise((res,rej)=>{let r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file.files[0])});await api("/api/wellness",{method:"POST",body:{title,type,note,photoData:data}});toast("Wellness entry saved");await wellnessView()};file.click()};
 $$(".delWell").forEach(b=>b.onclick=async()=>{await api("/api/wellness/"+b.dataset.id,{method:"DELETE"});await wellnessView()})
}

async function analyticsView(){
 const rows=await api("/api/metrics?from="+new Date(Date.now()-90*86400000).toISOString().slice(0,10));
 const logs=await api("/api/study"),focus=await api("/api/focus");
 const sum=(key)=>rows.filter(x=>x[key]!=null).reduce((a,x)=>a+Number(x[key]),0);
 $("#content").innerHTML=`<div class="hero"><span class="eyebrow">DATA / 90 DAYS</span><h1 style="font:700 34px Space Grotesk">Your recorded history.</h1><p class="muted">No fabricated trends: missing dates stay missing.</p></div><div class="grid g4" style="margin-top:14px">${metricCard("Metric days",null,rows.length,"days with any metric")}${metricCard("Study",null,logs.reduce((a,x)=>a+x.minutes,0)+" min","logged study")}${metricCard("Focus",null,focus.reduce((a,x)=>a+x.duration,0)+" min","logged focus")}${metricCard("Steps",null,sum("steps").toLocaleString(),"recorded steps")}</div><div class="card" style="margin-top:14px"><h3>Metric log</h3>${rows.length?`<table class="table"><thead><tr><th>Date</th><th>Weight</th><th>Calories</th><th>Protein</th><th>Water</th><th>Steps</th><th>Sleep</th></tr></thead><tbody>${rows.slice().reverse().map(x=>`<tr><td>${x.date}</td><td>${x.weight??"—"}</td><td>${x.calories??"—"}</td><td>${x.protein??"—"}</td><td>${x.water??"—"}</td><td>${x.steps??"—"}</td><td>${x.sleep??"—"}</td></tr>`).join("")}</tbody></table>`:empty("No metrics logged yet.")}</div><div class="card" style="margin-top:14px"><h3>Log today's metrics</h3><div class="formgrid">${["weight","calories","protein","water","steps","sleep"].map(k=>`<label class="field">${k}<input id="m_${k}" type="number" step="any"></label>`).join("")}</div><button class="primary small" id="saveMetrics">Save today's metrics</button></div>`;
 $("#saveMetrics").onclick=async()=>{const b={};["weight","calories","protein","water","steps","sleep"].forEach(k=>{const v=$("#m_"+k).value;if(v!=="")b[k]=Number(v)});await api("/api/metrics/"+new Date().toISOString().slice(0,10),{method:"PUT",body:b});toast("Metrics saved");await analyticsView()}
}

async function coachView(){
 const history=await api("/api/coach/history");
 $("#content").innerHTML=`<div class="grid" style="grid-template-columns:1.1fr .9fr"><div class="hero"><span class="eyebrow">COACH FORGE</span><h1 style="font:700 34px Space Grotesk">A briefing built from what you actually log.</h1><p class="muted">The default engine uses your own records and never invents missing metrics. An OpenAI-compatible provider can be connected later without changing the UI.</p></div><div class="card"><h3>Context</h3><div class="stack"><span class="chip">Metrics</span><span class="chip">Meals</span><span class="chip">Focus</span><span class="chip">Study</span></div></div></div><div class="card" style="margin-top:14px"><div id="chat" class="stack" style="max-height:55vh;overflow:auto">${history.length?history.map(x=>`<div class="listitem"><b>${x.role==="user"?"You":"Coach Forge"}</b><div style="margin-top:5px">${esc(x.content)}</div></div>`).join(""):empty("Ask your first question.")}</div><div class="row" style="margin-top:12px"><input id="coachInput" class="field" style="margin:0" placeholder="Ask about your logged data..."><button class="primary small" id="coachSend">Send</button></div></div>`;
 $("#coachSend").onclick=async()=>{let m=$("#coachInput").value.trim();if(!m)return;$("#coachSend").disabled=true;try{await api("/api/coach",{method:"POST",body:{message:m}});await coachView()}finally{$("#coachSend").disabled=false}}
}

async function settingsView(){
 $("#content").innerHTML=`<div class="hero"><span class="eyebrow">CONTROL PANEL</span><h1 style="font:700 34px Space Grotesk">Make FORGE yours.</h1><p class="muted">Theme, density, accent, navigation and targets are per-user settings.</p></div>
 <div class="grid g2" style="margin-top:14px"><div class="card"><h3>Appearance</h3><div class="formgrid"><label class="field">Theme<select id="s_theme"><option value="dark">Dark</option><option value="light">Light</option></select></label><label class="field">Density<select id="s_density"><option>comfortable</option><option>compact</option></select></label><label class="field">Accent<input id="s_accent" type="color"></label><label class="field">Units<select id="s_units"><option>metric</option><option>imperial</option></select></label></div></div><div class="card"><h3>Targets</h3><div class="formgrid">${[["calorieTarget","Calories"],["proteinTarget","Protein"],["waterTarget","Water ml"],["stepTarget","Steps"],["weightGoal","Weight goal"]].map(([k,l])=>`<label class="field">${l}<input id="s_${k}" type="number" step="any"></label>`).join("")}</div></div></div>
 <div class="card" style="margin-top:14px"><h3>Navigation</h3><p class="muted">Choose which workspaces appear in your sidebar.</p><div class="chips">${sections.filter(x=>x[0]!=="settings").map(x=>`<label class="chip"><input class="navcheck" data-key="${x[0]}" type="checkbox"> ${x[1]}</label>`).join("")}</div><button class="primary small" id="saveSettings" style="margin-top:14px">Save customization</button></div>
 <div class="card" style="margin-top:14px"><h3>Prayer location</h3><div class="formgrid"><label class="field">City<select id="s_city"><option>Warangal, India</option><option>Hyderabad, India</option><option>Delhi, India</option><option>Mumbai, India</option><option>Bengaluru, India</option><option>Chennai, India</option><option>Kolkata, India</option></select></label></div></div>
 <div class="card" style="margin-top:14px"><h3>Data portability</h3><button class="mini-btn" id="export">Export JSON</button></div>`;
 $("#s_theme").value=settings.theme;$("#s_density").value=settings.density;$("#s_accent").value=settings.accent;$("#s_units").value=settings.units;
 ["calorieTarget","proteinTarget","waterTarget","stepTarget","weightGoal"].forEach(k=>$("#s_"+k).value=settings[k]??"");
 $("#s_city").value=settings.prayerCity||"Warangal, India";
 const active=(settings.nav||"").split(",");$$(".navcheck").forEach(c=>c.checked=active.includes(c.dataset.key));
 $("#saveSettings").onclick=async()=>{const nav=$$(".navcheck:checked").map(c=>c.dataset.key).join(",");settings=await api("/api/settings",{method:"PUT",body:{theme:$("#s_theme").value,density:$("#s_density").value,accent:$("#s_accent").value,units:$("#s_units").value,nav,prayerCity:$("#s_city").value,calorieTarget:num("calorieTarget"),proteinTarget:num("proteinTarget"),waterTarget:num("waterTarget"),stepTarget:num("stepTarget"),weightGoal:num("weightGoal")}});applyTheme();renderNav();toast("Customization saved");};
 $("#export").onclick=async()=>{const d=await api("/api/export");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}));a.download="forge-export.json";a.click();URL.revokeObjectURL(a.href)}
}
const num=k=>{const v=$("#s_"+k).value;return v===""?null:Number(v)}
function applyTheme(){document.documentElement.style.setProperty("--accent",settings?.accent||"#e5ff4f");if(settings?.theme==="light"){document.documentElement.style.setProperty("--bg","#f4f5f6");document.documentElement.style.setProperty("--panel","#ffffff");document.documentElement.style.setProperty("--panel2","#eef0f3");document.documentElement.style.setProperty("--line","#dfe2e8");document.documentElement.style.setProperty("--text","#121419");document.documentElement.style.setProperty("--muted","#666d78")}else{document.documentElement.style.setProperty("--bg","#090a0c");document.documentElement.style.setProperty("--panel","#111318");document.documentElement.style.setProperty("--panel2","#151820");document.documentElement.style.setProperty("--line","#252933");document.documentElement.style.setProperty("--text","#f4f5f6");document.documentElement.style.setProperty("--muted","#9297a3")}}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

async function boot(){
 if(!token){$("#auth").classList.remove("hidden");$("#app").classList.add("hidden");return}
 try{const d=await api("/api/auth/me");me=d.user;settings=d.settings;$("#auth").classList.add("hidden");$("#app").classList.remove("hidden");$("#userName").textContent=me.name;applyTheme();renderNav();go(current)}catch{localStorage.removeItem("forge_token");token=null;boot()}
}
$("#authSwitch").onclick=()=>{authMode=authMode==="register"?"login":"register";$("#authTitle").textContent=authMode==="register"?"Enter your workspace.":"Welcome back.";$("#authSub").textContent=authMode==="register"?"Create an account or sign in. Every record is isolated to your account.":"Sign in to your private FORGE workspace.";$("#nameWrap").style.display=authMode==="register"?"block":"none";$("#authSubmit").textContent=authMode==="register"?"Create account":"Sign in";$("#authSwitch").textContent=authMode==="register"?"Already have an account? Sign in":"Need an account? Create one";$("#authError").textContent=""}
$("#authForm").onsubmit=async e=>{e.preventDefault();$("#authError").textContent="";try{const d=await api("/api/auth/"+authMode,{method:"POST",body:{name:$("#name").value,email:$("#email").value,password:$("#password").value}});token=d.token;localStorage.setItem("forge_token",token);me=d.user;settings=d.settings;$("#userName").textContent=me.name;$("#auth").classList.add("hidden");$("#app").classList.remove("hidden");applyTheme();renderNav();go("today")}catch(err){$("#authError").textContent=err.message}}
$("#logout").onclick=()=>{localStorage.removeItem("forge_token");location.reload()}
boot();
