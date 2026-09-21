const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient, Prisma } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required. Set it in Render Environment Variables before starting the app.");
}
const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  process.env.PUBLIC_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
].filter(Boolean));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

const today = () => new Date().toISOString().slice(0, 10);
const tokenFor = (u) => jwt.sign({ id: u.id, email: u.email }, JWT_SECRET, { expiresIn: "14d" });

function auth(req, res, next) {
  const raw = req.headers.authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "Session expired" }); }
}

function bodyValue(body, key, fallback = null) {
  return Object.prototype.hasOwnProperty.call(body, key) ? body[key] : fallback;
}

function redactSecrets(value) {
  const source = String(value ?? "");
  return source
    .replace(/DATABASE_URL[^\s\r\n]*/gi, "[REDACTED_DATABASE_URL]")
    .replace(/(postgres(?:ql)?:\/\/)([^@\s]+)@/gi, "$1[REDACTED]@")
    .replace(/(password\s*[:=]\s*)([^\s,;\]]+)/gi, "$1[REDACTED]")
    .replace(/(Authorization\s*[:=]\s*)(Bearer\s+)?[^\s,;\]]+/gi, "$1[REDACTED]")
    .replace(/(JWT_SECRET|jwt_secret|secret)\s*[:=]\s*[^\s,;\]]+/gi, "$1=[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, "$1[REDACTED_TOKEN]");
}

function logPrismaError(context, error) {
  const payload = {
    context,
    name: error?.name || "UnknownError",
    code: error?.code || null,
    message: redactSecrets(error?.message || ""),
    meta: error?.meta ? redactSecrets(JSON.stringify(error.meta)) : null,
    clientVersion: error?.clientVersion || null,
    stack: error?.stack ? redactSecrets(error.stack.split("\n").slice(0, 8).join("\n")) : null
  };
  console.error("Prisma error:", JSON.stringify(payload));
}

/* ---------- auth ---------- */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) return res.status(400).json({ error: "Name, email and password are required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const exists = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (exists) return res.status(409).json({ error: "Email already registered" });
    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        password: await bcrypt.hash(password, 12),
        settings: { create: {} }
      },
      include: { settings: true }
    });
    res.json({ token: tokenFor(user), user: { id: user.id, email: user.email, name: user.name }, settings: user.settings });
  } catch (error) {
    logPrismaError("register", error);
    res.status(500).json({ error: "Registration failed", code: "DATABASE_ERROR" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await prisma.user.findUnique({ where: { email: String(email || "").trim().toLowerCase() }, include: { settings: true } });
    if (!user || !(await bcrypt.compare(String(password || ""), user.password))) return res.status(401).json({ error: "Invalid email or password" });
    res.json({ token: tokenFor(user), user: { id: user.id, email: user.email, name: user.name }, settings: user.settings });
  } catch (error) {
    logPrismaError("login", error);
    res.status(500).json({ error: "Login failed", code: "DATABASE_ERROR" });
  }
});

app.get("/api/auth/me", auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { settings: true } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { id: user.id, email: user.email, name: user.name }, settings: user.settings });
});

/* ---------- settings ---------- */
app.get("/api/settings", auth, async (req, res) => {
  const settings = await prisma.userSettings.upsert({ where: { userId: req.user.id }, update: {}, create: { userId: req.user.id } });
  res.json(settings);
});

app.put("/api/settings", auth, async (req, res) => {
  const allowed = ["theme","accent","density","units","nav","prayerCity","prayerLat","prayerLon","calorieTarget","proteinTarget","waterTarget","stepTarget","weightGoal"];
  const data = {};
  for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
  const settings = await prisma.userSettings.upsert({ where: { userId: req.user.id }, update: data, create: { userId: req.user.id, ...data } });
  res.json(settings);
});

/* ---------- metrics ---------- */
app.get("/api/metrics", auth, async (req, res) => {
  const from = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10);
  res.json(await prisma.metric.findMany({ where: { userId: req.user.id, date: { gte: from } }, orderBy: { date: "asc" } }));
});

app.put("/api/metrics/:date", auth, async (req, res) => {
  const data = {};
  ["weight","calories","protein","water","steps","sleep"].forEach(k => {
    if (req.body[k] !== undefined && req.body[k] !== "") data[k] = Number(req.body[k]);
  });
  res.json(await prisma.metric.upsert({
    where: { userId_date: { userId: req.user.id, date: req.params.date } },
    update: data,
    create: { userId: req.user.id, date: req.params.date, ...data }
  }));
});

/* ---------- generic CRUD ---------- */
app.get("/api/tasks", auth, async (req,res) => res.json(await prisma.task.findMany({ where:{userId:req.user.id}, orderBy:{createdAt:"desc"} })));
app.post("/api/tasks", auth, async (req,res) => {
  const {title,section,bucket,recurrence,dueDate} = req.body;
  if (!title) return res.status(400).json({error:"Task title required"});
  res.json(await prisma.task.create({data:{userId:req.user.id,title,section:section||"personal",bucket:bucket||"anytime",recurrence:recurrence||"one-time",dueDate:dueDate||today()}}));
});
app.patch("/api/tasks/:id", auth, async (req,res) => {
  const task = await prisma.task.findFirst({where:{id:req.params.id,userId:req.user.id}});
  if (!task) return res.status(404).json({error:"Task not found"});
  res.json(await prisma.task.update({where:{id:task.id},data:{completed:!!req.body.completed}}));
});
app.delete("/api/tasks/:id", auth, async (req,res) => {
  await prisma.task.deleteMany({where:{id:req.params.id,userId:req.user.id}}); res.json({ok:true});
});

app.get("/api/exercises", auth, async (req,res)=>res.json(await prisma.exercise.findMany({where:{userId:req.user.id},orderBy:{name:"asc"}})));
app.post("/api/exercises", auth, async (req,res)=>{
  const {name,muscle,equipment}=req.body;
  if(!name) return res.status(400).json({error:"Exercise name required"});
  res.json(await prisma.exercise.create({data:{userId:req.user.id,name:name.trim(),muscle:muscle||null,equipment:equipment||null}}));
});
app.delete("/api/exercises/:id", auth, async(req,res)=>{
  await prisma.exercise.deleteMany({where:{id:req.params.id,userId:req.user.id}}); res.json({ok:true});
});
app.get("/api/workouts", auth, async(req,res)=>res.json(await prisma.workoutLog.findMany({where:{userId:req.user.id},include:{exercise:true},orderBy:{date:"desc"}})));
app.post("/api/workouts", auth, async(req,res)=>{
  const {exerciseId,date,setNo,reps,weight,completed}=req.body;
  const ex=await prisma.exercise.findFirst({where:{id:exerciseId,userId:req.user.id}});
  if(!ex) return res.status(404).json({error:"Exercise not found"});
  res.json(await prisma.workoutLog.create({data:{userId:req.user.id,exerciseId,date:date||today(),setNo:Number(setNo||1),reps:Number(reps||0),weight:Number(weight||0),completed:!!completed}}));
});

app.get("/api/meals", auth, async(req,res)=>res.json(await prisma.meal.findMany({where:{userId:req.user.id,date:req.query.date||today()},orderBy:{createdAt:"asc"}})));
app.post("/api/meals", auth, async(req,res)=>{
  const {date,mealType,name,calories,protein,carbs,fats}=req.body;
  if(!name) return res.status(400).json({error:"Meal name required"});
  res.json(await prisma.meal.create({data:{userId:req.user.id,date:date||today(),mealType:mealType||"Meal",name,calories:calories==null?null:Number(calories),protein:protein==null?null:Number(protein),carbs:carbs==null?null:Number(carbs),fats:fats==null?null:Number(fats)}}));
});
app.patch("/api/meals/:id", auth, async(req,res)=>{
  const meal=await prisma.meal.findFirst({where:{id:req.params.id,userId:req.user.id}});
  if(!meal)return res.status(404).json({error:"Meal not found"});
  res.json(await prisma.meal.update({where:{id:meal.id},data:{completed:!!req.body.completed}}));
});

app.get("/api/focus", auth, async(req,res)=>res.json(await prisma.focusSession.findMany({where:{userId:req.user.id},orderBy:{startedAt:"desc"},take:100})));
app.post("/api/focus", auth, async(req,res)=>res.json(await prisma.focusSession.create({data:{userId:req.user.id,startedAt:new Date(),duration:Number(req.body.duration||0),mode:req.body.mode||"Pomodoro",subject:req.body.subject||null,completed:req.body.completed!==false}})));

app.get("/api/study", auth, async(req,res)=>res.json(await prisma.studyLog.findMany({where:{userId:req.user.id},orderBy:{date:"desc"}})));
app.post("/api/study", auth, async(req,res)=>{
  const {subject,minutes,solved,failed,date}=req.body;
  if(!subject)return res.status(400).json({error:"Subject required"});
  res.json(await prisma.studyLog.create({data:{userId:req.user.id,date:date||today(),subject,minutes:Number(minutes||0),solved:Number(solved||0),failed:Number(failed||0)}}));
});

app.get("/api/placements", auth, async(req,res)=>res.json(await prisma.placement.findMany({where:{userId:req.user.id},orderBy:{createdAt:"desc"}})));
app.post("/api/placements", auth, async(req,res)=>{
  const {company,role,stage,ctc,deadline,interviewAt,link,notes}=req.body;
  if(!company)return res.status(400).json({error:"Company required"});
  res.json(await prisma.placement.create({data:{userId:req.user.id,company,role:role||null,stage:stage||"Applied",ctc:ctc||null,deadline:deadline||null,interviewAt:interviewAt||null,link:link||null,notes:notes||null}}));
});
app.patch("/api/placements/:id", auth, async(req,res)=>{
  const p=await prisma.placement.findFirst({where:{id:req.params.id,userId:req.user.id}});
  if(!p)return res.status(404).json({error:"Placement not found"});
  res.json(await prisma.placement.update({where:{id:p.id},data:{stage:req.body.stage||p.stage}}));
});

app.get("/api/wellness", auth, async(req,res)=>res.json(await prisma.wellnessEntry.findMany({where:{userId:req.user.id},orderBy:{createdAt:"desc"}})));
app.post("/api/wellness", auth, async(req,res)=>{
  const {type,title,note,photoData,date}=req.body;
  if(!title)return res.status(400).json({error:"Title required"});
  if(photoData && !String(photoData).startsWith("data:image/")) return res.status(400).json({error:"Invalid image data"});
  res.json(await prisma.wellnessEntry.create({data:{userId:req.user.id,date:date||today(),type:type||"routine",title,note:note||null,photoData:photoData||null}}));
});
app.delete("/api/wellness/:id", auth, async(req,res)=>{await prisma.wellnessEntry.deleteMany({where:{id:req.params.id,userId:req.user.id}});res.json({ok:true});});

/* ---------- salah ---------- */
const cityCoords = {
  "Warangal, India":[17.9784,79.5941],
  "Hyderabad, India":[17.3850,78.4867],
  "Delhi, India":[28.6139,77.2090],
  "Mumbai, India":[19.0760,72.8777],
  "Bengaluru, India":[12.9716,77.5946],
  "Chennai, India":[13.0827,80.2707],
  "Kolkata, India":[22.5726,88.3639]
};
function deg2rad(x){return x*Math.PI/180} function rad2deg(x){return x*180/Math.PI}
function solarDeclination(d){ const n=Math.floor((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-Date.UTC(d.getUTCFullYear(),0,0))/86400000); const g=deg2rad(357.529+0.98560028*n); return deg2rad(23.44)*Math.sin(g); }
function equationOfTime(d){ const n=Math.floor((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-Date.UTC(d.getUTCFullYear(),0,0))/86400000); const B=deg2rad(360*(n-81)/364); return 9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B); }
function hourAngle(lat,decl,alt){ const c=(Math.sin(deg2rad(alt))-Math.sin(deg2rad(lat))*Math.sin(decl))/(Math.cos(deg2rad(lat))*Math.cos(decl)); return Math.acos(Math.min(1,Math.max(-1,c))); }
function fmtMinutes(mins){mins=((mins%1440)+1440)%1440; const h=Math.floor(mins/60),m=Math.floor(mins%60); return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;}
function prayerTimes(lat,lon,dateStr,offset=5.5){
  const d=new Date(dateStr+"T12:00:00Z"), decl=solarDeclination(d), eot=equationOfTime(d);
  const solarNoon=720-4*lon-eot+60*offset;
  const sunrise=solarNoon-4*rad2deg(hourAngle(lat,decl,-0.833));
  const sunset=solarNoon+4*rad2deg(hourAngle(lat,decl,-0.833));
  const fajr=solarNoon-4*rad2deg(hourAngle(lat,decl,-18));
  const isha=solarNoon+4*rad2deg(hourAngle(lat,decl,-18));
  const asrAngle=Math.atan(1/(1+Math.tan(Math.abs(deg2rad(lat)-decl)))) ; // approximate shadow factor 1
  const asr=solarNoon+4*rad2deg(Math.acos(Math.min(1,Math.max(-1,(Math.sin(Math.atan(1))-Math.sin(deg2rad(lat))*Math.sin(decl))/(Math.cos(deg2rad(lat))*Math.cos(decl))))));
  return {Fajr:fmtMinutes(fajr),Sunrise:fmtMinutes(sunrise),Dhuhr:fmtMinutes(solarNoon),Asr:fmtMinutes(asr),Maghrib:fmtMinutes(sunset),Isha:fmtMinutes(isha)};
}
app.get("/api/salah/times", auth, async(req,res)=>{
  const settings=await prisma.userSettings.findUnique({where:{userId:req.user.id}});
  const city=req.query.city || settings?.prayerCity || "Warangal, India";
  const coords=cityCoords[city] || [Number(settings?.prayerLat),Number(settings?.prayerLon)];
  if(!Number.isFinite(coords[0])||!Number.isFinite(coords[1])) return res.status(400).json({error:"Set prayer city or coordinates in Settings"});
  res.json({city, date:req.query.date||today(), times:prayerTimes(coords[0],coords[1],req.query.date||today()), source:"FORGE astronomical calculation"});
});
app.get("/api/salah/logs", auth, async(req,res)=>res.json(await prisma.prayerLog.findMany({where:{userId:req.user.id,date:req.query.date||today()}})));
app.put("/api/salah/logs/:prayer", auth, async(req,res)=>{
  const date=req.body.date||today(), prayer=req.params.prayer;
  res.json(await prisma.prayerLog.upsert({where:{userId_date_prayer:{userId:req.user.id,date,prayer}},update:{done:!!req.body.done},create:{userId:req.user.id,date,prayer,done:!!req.body.done}}));
});

/* ---------- coach ---------- */
app.get("/api/coach/history", auth, async(req,res)=>res.json(await prisma.coachMessage.findMany({where:{userId:req.user.id},orderBy:{createdAt:"asc"},take:100})));
app.post("/api/coach", auth, async(req,res)=>{
  const text=String(req.body.message||"").trim();
  if(!text)return res.status(400).json({error:"Message required"});
  await prisma.coachMessage.create({data:{userId:req.user.id,role:"user",content:text}});
  const d=today();
  const [metric, meals, focus, study] = await Promise.all([
    prisma.metric.findUnique({where:{userId_date:{userId:req.user.id,date:d}}}),
    prisma.meal.findMany({where:{userId:req.user.id,date:d}}),
    prisma.focusSession.findMany({where:{userId:req.user.id,startedAt:{gte:new Date(d+"T00:00:00")}}}),
    prisma.studyLog.findMany({where:{userId:req.user.id,date:d}})
  ]);
  const parts=[];
  if(metric?.water!=null) parts.push(`water ${metric.water} ml`);
  if(metric?.steps!=null) parts.push(`steps ${metric.steps}`);
  if(metric?.protein!=null) parts.push(`protein ${metric.protein} g`);
  if(meals.length) parts.push(`${meals.length} meal entries`);
  if(focus.length) parts.push(`${focus.reduce((a,x)=>a+x.duration,0)} minutes focused`);
  if(study.length) parts.push(`${study.reduce((a,x)=>a+x.minutes,0)} study minutes`);
  const reply = parts.length
    ? `Today I can see: ${parts.join(", ")}. For “${text}”, use those recorded numbers as your baseline and log the missing pieces before changing targets.`
    : `I don't have enough logged data for today yet. For “${text}”, start by recording today's metric, meal, focus, or study data so the coaching context becomes personal.`;
  await prisma.coachMessage.create({data:{userId:req.user.id,role:"assistant",content:reply}});
  res.json({reply});
});

/* ---------- export/import ---------- */
app.get("/api/export", auth, async(req,res)=>{
  const data = {
    user: await prisma.user.findUnique({where:{id:req.user.id},select:{id:true,email:true,name:true,createdAt:true}}),
    settings: await prisma.userSettings.findUnique({where:{userId:req.user.id}}),
    metrics: await prisma.metric.findMany({where:{userId:req.user.id}}),
    tasks: await prisma.task.findMany({where:{userId:req.user.id}}),
    exercises: await prisma.exercise.findMany({where:{userId:req.user.id}}),
    workouts: await prisma.workoutLog.findMany({where:{userId:req.user.id}}),
    meals: await prisma.meal.findMany({where:{userId:req.user.id}}),
    focus: await prisma.focusSession.findMany({where:{userId:req.user.id}}),
    study: await prisma.studyLog.findMany({where:{userId:req.user.id}}),
    placements: await prisma.placement.findMany({where:{userId:req.user.id}}),
    prayers: await prisma.prayerLog.findMany({where:{userId:req.user.id}}),
    wellness: await prisma.wellnessEntry.findMany({where:{userId:req.user.id}}),
    coach: await prisma.coachMessage.findMany({where:{userId:req.user.id}})
  };
  res.json(data);
});

app.get("/api/health", async (req,res)=>{
  try {
    const result = await prisma.$queryRaw`SELECT 1 AS ok`;
    return res.json({ ok: true, service: "FORGE", time: new Date().toISOString(), database: "ok", result });
  } catch (error) {
    logPrismaError("database-healthcheck", error);
    return res.status(503).json({ ok: false, service: "FORGE", time: new Date().toISOString(), database: "unavailable" });
  }
});
app.get(/^(?!\/api\/).*$/, (req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT, HOST, ()=>console.log(`FORGE running on http://${HOST}:${PORT}`));
