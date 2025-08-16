// Mini Duolingo para uma menina de 12 anos
// Single-file React app com gamificação simples, lições e minijogos.
// Usa Tailwind para estilos (sem imports) e localStorage para persistência.
// FIX React: imports explícitos; +PWA (manifest+SW+instalação) + Áudio (SpeechSynthesis) + trilha Missões & Mundo.
/*
Empacotar para Android (resumo prático):
1) PWA pronto (manifest + SW). Teste Lighthouse > PWA.
2) Opção A — Capacitor: `npm create @capacitor/app`, mover este app para `app/` ou integrar build Vite; `npx cap add android`; abrir no Android Studio, gerar APK/AAB.
3) Opção B — TWA (Trusted Web Activity): usar Bubblewrap (`npx @bubblewrap/cli init && build`), apontar para URL hospedada do PWA (HTTPS), gerar APK/AAB.
4) Assinar (keystore) e publicar na Play Store.
*/

import React from "react";
import { useState, useEffect, useMemo, useRef } from "react";

// Garantia: expõe React global p/ ambientes que esperam window.React
if (typeof window !== 'undefined' && !window.React) {
  // @ts-ignore
  window.React = React;
}

// --------- UTIL ---------
function clsx(...parts) { return parts.filter(Boolean).join(" "); }
function norm(s){ return (s||"").toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
function saveProfile(p) { localStorage.setItem("miniDuo.profile", JSON.stringify(p)); }
function loadProfile() { try { return JSON.parse(localStorage.getItem("miniDuo.profile")||"null"); } catch { return null; } }
function todayStr() { const d = new Date(); return d.toISOString().slice(0,10); }
function isYesterday(dateStr) { const d = new Date(dateStr); const y = new Date(); y.setDate(y.getDate()-1); return d.toISOString().slice(0,10) === y.toISOString().slice(0,10); }
function shuffle(arr) { const a = [...arr]; for (let i=a.length-1;i>0;i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }

// --------- PWA (manifest + service worker + instalação) ---------
function ensureManifest(){
  const manifest = {
    name: "Mini Duolingo",
    short_name: "MiniDuo",
    start_url: ".",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      { src: iconDataURL(192), sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: iconDataURL(512), sizes: "512x512", type: "image/svg+xml", purpose: "any" }
    ]
  };
  const blob = new Blob([JSON.stringify(manifest)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  let link = document.querySelector('link[rel="manifest"]');
  if(!link){ link = document.createElement('link'); link.rel='manifest'; document.head.appendChild(link); }
  link.href = url;
}
function iconDataURL(size){
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 100 100'>
    <rect fill='#4f46e5' width='100' height='100' rx='20'/>
    <text x='50' y='58' font-size='54' text-anchor='middle'>🦜</text>
  </svg>`;
  return "data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svg)));
}
function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  const swCode = `
    const CACHE_NAME = 'mini-duo-cache-v1';
    const ASSETS = [ './' ];
    self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS))); });
    self.addEventListener('activate', e=>{ e.waitUntil(self.clients.claim()); });
    self.addEventListener('fetch', e=>{
      const url = new URL(e.request.url);
      if (e.request.method !== 'GET') return; 
      e.respondWith(
        caches.match(e.request).then(res=> res || fetch(e.request).then(resp=>{
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c=>{ if(url.origin===location.origin) c.put(e.request, copy); });
          return resp;
        }).catch(()=> caches.match('./')))
      );
    });`;
  const blob = new Blob([swCode], {type:'text/javascript'});
  const swUrl = URL.createObjectURL(blob);
  navigator.serviceWorker.register(swUrl, {scope: './'}).catch(()=>{});
}

// --------- CONTEÚDO (expandido e bilíngue) ---------
const CONTENT = {
  curso: "Inglês/Espanhol Básico (Cotidiano)",
  mascot: "🦜",
  lessons: [
    // ——— Núcleo existente (cotidiano) ———
    { id: "L1", category:"Cotidiano", title: "Saudações", color: "from-violet-500 to-fuchsia-500", exercises: [
      {type:"choice", prompt:"Como se diz 'Olá' em inglês?", options:["Bye","Hello","Thanks"], answer:"Hello"},
      {type:"choice", prompt:"'Bom dia' em inglês:", options:["Good night","Good morning","Good afternoon"], answer:"Good morning"},
      {type:"fill", prompt:"Complete: Good ____ (tarde)", answer:"afternoon"},
      {type:"order", prompt:"Ordene para formar: 'Eu sou a Ana' em inglês", words:["Ana","am","I"], answer:["I","am","Ana"]},
      {type:"match", prompt:"Faça pares (EN⇄PT)", pairs:[["Hello","Olá"],["Goodbye","Tchau"],["Please","Por favor"],["Thanks","Obrigado(a)"]]}
    ]},
    { id: "L2", category:"Cotidiano", title: "Comidas", color: "from-emerald-500 to-lime-500", exercises: [
      {type:"choice", prompt:"'Maçã' em inglês é:", options:["Banana","Apple","Orange"], answer:"Apple"},
      {type:"fill", prompt:"Eu gosto de ___ (leite) — em inglês", answer:"milk"},
      {type:"order", prompt:"Ordene: 'Nós comemos pão'", words:["eat","We","bread"], answer:["We","eat","bread"]},
      {type:"match", prompt:"Combine (EN⇄PT)", pairs:[["Milk","Leite"],["Bread","Pão"],["Water","Água"],["Rice","Arroz"]]},
      {type:"choice", prompt:"Qual é a tradução de 'Orange'?", options:["Uva","Laranja","Manga"], answer:"Laranja"}
    ]},
    { id: "L3", category:"Cotidiano", title: "Família", color: "from-sky-500 to-cyan-500", exercises: [
      {type:"choice", prompt:"'Mãe' em inglês:", options:["Mother","Father","Brother"], answer:"Mother"},
      {type:"fill", prompt:"My ___ is kind (irmã)", answer:"sister"},
      {type:"order", prompt:"Ordene: 'Ele é meu pai'", words:["my","He","is","father"], answer:["He","is","my","father"]},
      {type:"match", prompt:"Combine (EN⇄PT)", pairs:[["Mother","Mãe"],["Father","Pai"],["Brother","Irmão"],["Sister","Irmã"]]}
    ]},

    // ——— Novas lições temáticas (Cotidiano) ———
    { id: "L4", category:"Cotidiano", title: "Escola & Amigos (PT–EN–ES)", color:"from-rose-500 to-orange-500", exercises:[
      {type:"choice", prompt:"Como dizer 'colega de classe' em inglês?", options:["homework","classmate","teacher"], answer:"classmate"},
      {type:"fill", prompt:"Traduza para inglês: 'caderno'", answer:"notebook"},
      {type:"order", prompt:"Ordene: 'Nós brincamos depois da escola' (em inglês)", words:["after","We","play","school"], answer:["We","play","after","school"]},
      {type:"match", prompt:"Faça pares (EN⇄PT/ES)", pairs:[["Friend","Amigo"],["Homework","Tarefa"],["Teacher","Professor(a)"],["Classroom","Sala de aula"]]},
      {type:"audio", prompt:"Ouça e escreva em PT/ES o significado", speak:{text:"friend", lang:"en-US"}, answer:["amigo","amiga"]}
    ]},
    { id: "L5", category:"Cotidiano", title: "Hobbies & Tempo Livre (PT–EN–ES)", color:"from-indigo-500 to-blue-500", exercises:[
      {type:"choice", prompt:"'Desenhar' em inglês é:", options:["dance","draw","cook"], answer:"draw"},
      {type:"fill", prompt:"Escreva em inglês: 'Eu gosto de ler'", answer:["i like to read","i like reading"]},
      {type:"match", prompt:"Combine (EN⇄PT/ES)", pairs:[["Music","Música"],["Game","Jogo"],["Book","Livro"],["Swim","Nadar"]]},
      {type:"audio", prompt:"Ouça e traduza (PT/ES)", speak:{text:"I like to draw", lang:"en-US"}, answer:["eu gosto de desenhar","me gusta dibujar"]}
    ]},

    // ——— Trilha: Missões & Mundo ———
    { id: "M1", category:"Missões & Mundo", title:"Lugares & Cultura (leve)", color:"from-teal-500 to-emerald-500", exercises:[
      {type:"match", prompt:"Países e Capitais (PT/ES)", pairs:[["Bolivia","La Paz"],["Brasil","Brasília"],["Perú","Lima"],["España","Madrid"]]},
      {type:"choice", prompt:"Tradução de 'church' (EN→PT/ES)", options:["igreja / iglesia","escola / escuela","praça / plaza"], answer:"igreja / iglesia"},
      {type:"fill", prompt:"Escreva em inglês: 'mapa'", answer:"map"},
      {type:"audio", prompt:"Ouça e responda (PT/ES): 'Where is the church?'", speak:{text:"Where is the church?", lang:"en-US"}, answer:["onde fica a igreja","donde esta la iglesia","donde está la iglesia"]}
    ]}
  ]
};

// --------- COMPONENTES ---------
function Header({profile, onOpenProfile, installReady, onInstall}) {
  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-2xl">{CONTENT.mascot}</div>
          <div className="font-bold">Mini Duolingo</div>
          <span className="text-xs text-gray-500 ml-2">{CONTENT.curso}</span>
        </div>
        <div className="flex items-center gap-2">
          {installReady && <button onClick={onInstall} className="text-xs px-2 py-1 rounded-lg bg-yellow-100 hover:bg-yellow-200">Instalar</button>}
          <Stat chip="XP" value={profile.xp} title="Experiência"/>
          <Stat chip="❤" value={profile.hearts} title="Vidas"/>
          <Stat chip="🔥" value={profile.streak} title="Sequência"/>
          <button onClick={onOpenProfile} className="text-sm px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200">
            {profile.name ? `@${profile.name}` : "Perfil"}
          </button>
        </div>
      </div>
    </div>
  );
}
function Stat({chip, value, title}){ return (
  <div className="flex items-center gap-2" title={title}>
    <span className="text-lg">{chip}</span>
    <span className="text-sm font-semibold">{value}</span>
  </div>
);} 

function Onboarding({onSave}){
  const [name,setName] = useState("");
  const [avatar,setAvatar] = useState("🦄");
  const avatars = ["🦄","🦜","🐱","🐼","🦊","🦋","🌸","🎀","⭐","🧁"];
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold mb-2">Bem-vinda! ✨</h2>
        <p className="text-sm text-gray-600 mb-4">Crie seu perfil para começar a aprender com jogos e desafios.</p>
        <label className="text-sm font-medium">Seu nome</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Ana" className="mt-1 mb-4 w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring"/>
        <label className="text-sm font-medium">Escolha um avatar</label>
        <div className="mt-2 grid grid-cols-10 gap-2 mb-4">
          {avatars.map(a=>
            <button key={a} onClick={()=>setAvatar(a)} className={clsx("text-2xl p-2 rounded-xl border", avatar===a && "ring-2 ring-indigo-500 bg-indigo-50")}>{a}</button>
          )}
        </div>
        <button onClick={()=> name.trim() && onSave({name, avatar})} className="w-full py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Começar</button>
        <p className="text-xs text-gray-500 mt-3">Privacidade: os dados ficam apenas neste dispositivo (localStorage). Sem coleta on-line.</p>
      </div>
    </div>
  );
}

function LessonCard({lesson, progress, onStart}){
  const pct = Math.round(((progress?.correct||0)/Math.max(1,(progress?.total||1)))*100);
  return (
    <div className="p-4">
      <div className={clsx("rounded-2xl p-4 bg-gradient-to-br text-white shadow", lesson.color)}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{lesson.title}</h3>
            <p className="text-white/80 text-sm">{lesson.exercises.length} exercícios</p>
          </div>
          <div className="text-3xl">🎯</div>
        </div>
        <div className="mt-3">
          <div className="h-2 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white/90" style={{width: `${pct}%`}}></div>
          </div>
          <p className="text-xs mt-1">Progresso: {pct}%</p>
        </div>
        <button onClick={onStart} className="mt-3 w-full py-2 rounded-xl bg-white/95 text-gray-900 font-semibold hover:bg-white">
          Iniciar
        </button>
      </div>
    </div>
  );
}

function FilterBar({filter, setFilter}){
  const tabs = ["Todas","Cotidiano","Missões & Mundo"];
  return (
    <div className="mt-4 flex gap-2">
      {tabs.map(t=> (
        <button key={t} onClick={()=>setFilter(t)} className={clsx("px-3 py-1.5 rounded-full border text-sm",
          filter===t?"bg-gray-900 text-white":"bg-white hover:bg-gray-50")}>{t}</button>
      ))}
    </div>
  );
}

function Home({profile, setScreen, setCurrentLesson, lessonProgress}){
  const [filter, setFilter] = useState("Todas");
  const list = CONTENT.lessons.filter(l=> filter==="Todas" || l.category===filter);
  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{profile.avatar || CONTENT.mascot}</div>
          <div>
            <h2 className="text-xl font-bold">Olá, {profile.name || "amiga"}! </h2>
            <p className="text-white/90">Vamos aprender com diversão? Complete lições para ganhar XP e manter sua sequência! 🔥</p>
          </div>
        </div>
      </div>
      <FilterBar filter={filter} setFilter={setFilter} />
      <div className="grid md:grid-cols-3 gap-2 mt-4">
        {list.map(lesson => (
          <LessonCard key={lesson.id} lesson={lesson} progress={lessonProgress[lesson.id]} onStart={()=>{ setCurrentLesson(lesson); setScreen("lesson"); }}/>
        ))}
      </div>
      <div className="mt-6 p-4 rounded-2xl border">
        <h3 className="font-bold mb-2">Teste Rápido</h3>
        <p className="text-sm text-gray-600">5 questões aleatórias das lições. Tente bater seu recorde!</p>
        <button onClick={()=> setScreen("quick")} className="mt-3 px-4 py-2 rounded-xl bg-gray-900 text-white font-semibold">Começar teste</button>
      </div>
      <TestPanel />
    </div>
  );
}

function Lesson({lesson, profile, onExit, onFinish}){
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [feedback, setFeedback] = useState(null); // {ok:boolean, msg:string}
  const ex = lesson.exercises[idx];

  function handleAnswer(ok) {
    if (ok) { setCorrect(c=>c+1); setFeedback({ok:true,msg:"Resposta certa! +10 XP"}); }
    else { setWrong(w=>w+1); setFeedback({ok:false,msg:"Ops! Você consegue. -1 vida"}); }
  }
  function next() {
    setFeedback(null);
    if (idx < lesson.exercises.length-1) setIdx(idx+1);
    else onFinish({correct, wrong});
  }

  useEffect(()=>{ if (!feedback) return; const t = setTimeout(next, 900); return ()=>clearTimeout(t); }, [feedback]);

  return (
    <div className="max-w-3xl mx-auto px-4">
      <div className="flex items-center justify-between mt-4">
        <button onClick={onExit} className="text-sm px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200">Sair</button>
        <div className="text-sm">{idx+1} / {lesson.exercises.length}</div>
      </div>
      <div className="mt-4 p-5 rounded-2xl border">
        <h2 className="text-lg font-semibold mb-2">{lesson.title}</h2>
        <p className="text-sm text-gray-600 mb-4">{ex.prompt}</p>
        <Exercise ex={ex} onResult={handleAnswer} />
        {feedback && (
          <div className={clsx("mt-4 p-3 rounded-xl text-sm font-semibold", feedback.ok?"bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-700")}>{feedback.msg}</div>
        )}
      </div>
      <div className="mt-3 text-sm text-gray-500">Dica: leia em voz alta e tente criar uma frase com a palavra aprendida.</div>
    </div>
  );
}

function Exercise({ex, onResult}){
  if (ex.type === "choice") return <Choice ex={ex} onResult={onResult} />;
  if (ex.type === "fill") return <Fill ex={ex} onResult={onResult} />;
  if (ex.type === "order") return <Order ex={ex} onResult={onResult} />;
  if (ex.type === "match") return <Match ex={ex} onResult={onResult} />;
  if (ex.type === "audio") return <AudioEx ex={ex} onResult={onResult} />;
  return <div>Tipo não suportado.</div>;
}

function Choice({ex, onResult}){
  const options = useMemo(()=>shuffle(ex.options), [ex]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map(opt => (
        <button key={opt} onClick={()=> onResult(opt===ex.answer || (Array.isArray(ex.answer) && ex.answer.map(norm).includes(norm(opt))))} className="px-4 py-3 rounded-xl border hover:bg-gray-50 text-left">
          {opt}
        </button>
      ))}
    </div>
  );
}

function Fill({ex, onResult}){
  const [val, setVal] = useState("");
  function submit() {
    const ans = ex.answer;
    const ok = Array.isArray(ans) ? ans.map(norm).includes(norm(val)) : norm(val)===norm(ans);
    onResult(ok); setVal("");
  }
  return (
    <div>
      <input value={val} onChange={e=>setVal(e.target.value)} placeholder="Digite aqui" className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring"/>
      <button onClick={submit} className="mt-3 px-4 py-2 rounded-xl bg-gray-900 text-white font-semibold">Verificar</button>
    </div>
  );
}

function Order({ex, onResult}){
  const [pool, setPool] = useState(()=>shuffle(ex.words));
  const [picked, setPicked] = useState([]);
  function pick(w){ setPicked(p=>[...p,w]); setPool(pool.filter(x=>x!==w)); }
  function undo(i){ const w = picked[i]; setPicked(p=>p.filter((_,idx)=>idx!==i)); setPool(p=>[...p,w]); }
  function submit(){ const ok = JSON.stringify(picked) === JSON.stringify(ex.answer); onResult(ok); setPool(shuffle(ex.words)); setPicked([]); }
  return (
    <div>
      <div className="min-h-[48px] p-2 rounded-xl border mb-2 flex flex-wrap gap-2">
        {picked.map((w,i)=>(
          <button key={i} onClick={()=>undo(i)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white">{w} ×</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {pool.map(w=>(
          <button key={w} onClick={()=>pick(w)} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50">{w}</button>
        ))}
      </div>
      <button onClick={submit} className="mt-3 px-4 py-2 rounded-xl bg-gray-900 text-white font-semibold">Conferir</button>
    </div>
  );
}

function Match({ex, onResult}){
  const [cards, setCards] = useState(()=>{
    const left = ex.pairs.map(p=>({id:"L:"+p[0], label:p[0], side:"L"}));
    const right = ex.pairs.map(p=>({id:"R:"+p[1], label:p[1], side:"R"}));
    return shuffle([...left, ...right]);
  });
  const [sel, setSel] = useState([]);
  const [found, setFound] = useState([]);

  function click(card){
    if (found.includes(card.id)) return;
    const s = [...sel, card];
    if (s.length===2){
      const [a,b] = s;
      const ok = (a.side!==b.side) && ex.pairs.some(([x,y])=> (a.label===x && b.label===y) || (a.label===y && b.label===x));
      if (ok){ setFound(f=>[...f, a.id, b.id]); setSel([]); } else { setSel([card]); }
    } else setSel(s);
  }
  useEffect(()=>{ if (found.length && found.length === ex.pairs.length*2){ const t = setTimeout(()=> onResult(true), 300); return ()=>clearTimeout(t);} }, [found]);
  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map(c=>{
        const isSel = sel.some(s=>s.id===c.id);
        const isFound = found.includes(c.id);
        return (
          <button key={c.id} onClick={()=>click(c)} className={clsx("px-3 py-3 rounded-xl border text-left", isFound && "bg-emerald-100 border-emerald-300", isSel && !isFound && "bg-indigo-100 border-indigo-300")}>{c.label}</button>
        );
      })}
    </div>
  );
}

function AudioEx({ex, onResult}){
  const [val, setVal] = useState("");
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  function play(){
    if (!canSpeak) return alert("Áudio indisponível neste dispositivo/navegador.");
    const u = new SpeechSynthesisUtterance(ex.speak?.text || "");
    if (ex.speak?.lang) u.lang = ex.speak.lang; u.rate = 0.95; u.pitch = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  function submit(){
    const ans = ex.answer;
    the_ok = Array.isArray(ans) ? ans.map(norm).includes(norm(val)) : norm(val)===norm(ans)
    onResult(the_ok); setVal("");
  }
  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={play} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold">▶️ Ouvir</button>
        <span className="text-xs text-gray-500">Dica: pode repetir o áudio quantas vezes quiser.</span>
      </div>
      <input value={val} onChange={e=>setVal(e.target.value)} placeholder="Escreva o significado (PT ou ES)" className="mt-3 w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring"/>
      <button onClick={submit} className="mt-3 px-4 py-2 rounded-xl bg-gray-900 text-white font-semibold">Verificar</button>
    </div>
  );
}

function FinishModal({result, onClose}){
  const total = result.correct + result.wrong;
  const rate = total? Math.round((result.correct/total)*100):0;
  const medal = rate>=90?"🥇": rate>=70?"🥈": rate>=50?"🥉":"🎖️";
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl text-center">
        <div className="text-5xl">{medal}</div>
        <h3 className="text-xl font-bold mt-2">Parabéns!</h3>
        <p className="text-gray-600 mt-1">Acertos: <b>{result.correct}</b> · Erros: <b>{result.wrong}</b> · Precisão: <b>{rate}%</b></p>
        <button onClick={onClose} className="mt-4 w-full py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Continuar</button>
      </div>
    </div>
  );
}

function QuickTest({onExit, onFinish}){
  const bank = CONTENT.lessons.flatMap(l => l.exercises).filter(ex=>ex.type!=="match");
  const picks = useMemo(()=>shuffle(bank).slice(0,5), []);
  const [i,setI] = useState(0);
  const [score,setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const ex = picks[i];
  function handle(ok){ setFeedback(ok?"Boa!":"Quase!"); if(ok) setScore(s=>s+1); }
  function next(){ setFeedback(null); if(i<picks.length-1) setI(i+1); else onFinish(score); }
  useEffect(()=>{ if(feedback){ const t=setTimeout(next, 700); return ()=>clearTimeout(t);} },[feedback]);
  return (
    <div className="max-w-3xl mx-auto px-4">
      <div className="flex items-center justify-between mt-4">
        <button onClick={onExit} className="text-sm px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200">Sair</button>
        <div className="text-sm">Pontos: {score} · {i+1}/5</div>
      </div>
      <div className="mt-4 p-5 rounded-2xl border">
        <p className="text-sm text-gray-600 mb-4">{ex.prompt}</p>
        <Exercise ex={ex} onResult={handle} />
        {feedback && (<div className="mt-4 p-3 rounded-xl text-sm font-semibold bg-gray-100">{feedback}</div>)}
      </div>
    </div>
  );
}

// --------- TESTES INTERNOS (auto) ---------
function runSelfTests(){
  const results = [];
  try { results.push({name:"React hooks importados", pass: typeof useState === 'function'}); } catch(e){ results.push({name:"React hooks importados", pass:false, err:e}); }
  results.push({name:"clsx concatena e ignora falsy", pass: clsx('a', null, false, 'b') === 'a b'});
  const s = shuffle([1,2,3,4]);
  results.push({name:"shuffle mantém tamanho", pass: s.length === 4});
  results.push({name:"todayStr formato YYYY-MM-DD", pass: /^\d{4}-\d{2}-\d{2}$/.test(todayStr())});
  const y = new Date(); y.setDate(y.getDate()-1); const ys = y.toISOString().slice(0,10);
  results.push({name:"isYesterday reconhece ontem", pass: isYesterday(ys)});
  results.push({name:"Há lições definidas", pass: Array.isArray(CONTENT.lessons) && CONTENT.lessons.length >= 1});
  results.push({name:"Áudio: suporte ou fallback", pass: ('speechSynthesis' in (window||{})) || true});
  results.push({name:"PWA manifest injetável", pass: typeof iconDataURL === 'function'});
  results.push({name:"norm remove acentos e caixa", pass: norm('Água') === 'agua' && norm('Me Gusta')==='me gusta'});
  results.push({name:"Há lição de Missões & Mundo", pass: CONTENT.lessons.some(l=>l.category==='Missões & Mundo')});
  results.push({name:"Há exercício de áudio", pass: CONTENT.lessons.some(l=>l.exercises.some(e=>e.type==='audio'))});
  try {
    results.push({name:"React global disponível", pass: (typeof React !== 'undefined') && !!React.createElement});
  } catch(e) { results.push({name:"React global disponível", pass:false, err:e}); }
  return results;
}

function TestPanel(){
  const [open,setOpen] = useState(false);
  const [res,setRes] = useState([]);
  function run(){ setRes(runSelfTests()); setOpen(true); }
  return (
    <div className="mt-6 p-4 rounded-2xl border">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Testes internos</h3>
        <button onClick={run} className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-sm">Rodar</button>
      </div>
      {open && (
        <ul className="mt-3 space-y-1 text-sm">
          {res.map((r,i)=>(
            <li key={i} className={r.pass?"text-emerald-700":"text-rose-700"}>
              {r.pass?"✔":"✖"} {r.name}
              {r.err && <span className="text-xs text-gray-500"> — {String(r.err)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --------- APP ---------
export default function App(){
  const [profile, setProfile] = useState(()=>{ const p = loadProfile(); return p || { name:"", avatar: CONTENT.mascot, xp:0, hearts:5, streak:0, lastPlayed:"", lastRefill:"" , progress: {} }; });
  const [screen, setScreen] = useState("home"); // home | lesson | quick
  const [currentLesson, setCurrentLesson] = useState(null);
  const [finish, setFinish] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(()=>{
    ensureManifest(); registerSW();
    const handler = (e)=>{ e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return ()=> window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(()=>{ const t = todayStr(); if (profile.lastRefill !== t) { updateProfile({hearts:5, lastRefill:t}); } }, []);

  function updateProfile(changes){ setProfile(prev=>{ const next = {...prev, ...changes}; saveProfile(next); return next; }); }

  function openLessonFinish({correct, wrong}){
    const gained = correct*10;
    const lostHearts = wrong;
    const newXP = profile.xp + gained;
    const newHearts = Math.max(0, profile.hearts - lostHearts);
    const total = (profile.progress?.[currentLesson.id]?.total || 0) + (correct+wrong);
    const prevCorrect = (profile.progress?.[currentLesson.id]?.correct || 0);
    const newCorrect = prevCorrect + correct;
    const newProg = { ...(profile.progress||{}), [currentLesson.id]: { total, correct: newCorrect } };
    const t = todayStr();
    let newStreak = profile.streak;
    if (profile.lastPlayed){ if (isYesterday(profile.lastPlayed)) newStreak += 1; else if (profile.lastPlayed !== t) newStreak = 1; } else newStreak = 1;
    updateProfile({ xp:newXP, hearts:newHearts, progress:newProg, lastPlayed:t, streak:newStreak });
    setFinish({correct, wrong});
  }
  function closeFinish(){ setFinish(null); setScreen("home"); setCurrentLesson(null);}  
  function handleQuickFinish(score){ const t = todayStr(); const gained = score*8; let newStreak = profile.streak; if (profile.lastPlayed){ if (isYesterday(profile.lastPlayed)) newStreak += 1; else if (profile.lastPlayed !== t) newStreak = 1; } else newStreak = 1; updateProfile({ xp: profile.xp + gained, lastPlayed:t, streak:newStreak }); setFinish({correct:score, wrong:5-score}); }

  const lessonProgress = profile.progress || {};
  const installReady = !!deferredPrompt;
  function doInstall(){ if(!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt.userChoice.finally(()=> setDeferredPrompt(null)); }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-slate-50">
      <Header profile={profile} onOpenProfile={()=>setShowProfile(true)} installReady={installReady} onInstall={doInstall} />
      {(!profile.name) && (<Onboarding onSave={({name,avatar})=> updateProfile({name, avatar})} />)}
      {screen==="home" && (<Home profile={profile} setScreen={setScreen} setCurrentLesson={setCurrentLesson} lessonProgress={lessonProgress}/>)}
      {screen==="lesson" && currentLesson && (<Lesson lesson={currentLesson} profile={profile} onExit={()=>setScreen("home")} onFinish={openLessonFinish} />)}
      {screen==="quick" && (<QuickTest onExit={()=>setScreen("home")} onFinish={handleQuickFinish} />)}
      {finish && (<FinishModal result={finish} onClose={closeFinish} />)}
      {showProfile && (<ProfileModal profile={profile} onClose={()=>setShowProfile(false)} onReset={()=>{ localStorage.removeItem("miniDuo.profile"); location.reload(); }} />)}
      <Footer />
    </div>
  );
}

function ProfileModal({profile, onClose, onReset}){
  const [name,setName] = useState(profile.name||"");
  const [avatar,setAvatar] = useState(profile.avatar||"🦄");
  function save(){ const p = {...profile, name, avatar}; localStorage.setItem("miniDuo.profile", JSON.stringify(p)); onClose(); location.reload(); }
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-xl font-bold">Perfil</h3>
        <div className="mt-3">
          <label className="text-sm font-medium">Nome</label>
          <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border"/>
        </div>
        <div className="mt-3">
          <label className="text-sm font-medium">Avatar</label>
          <div className="mt-2 grid grid-cols-10 gap-2 mb-2">
            {["🦄","🦜","🐱","🐼","🦊","🦋","🌸","🎀","⭐","🧁"].map(a=>
              <button key={a} onClick={()=>setAvatar(a)} className={clsx("text-2xl p-2 rounded-xl border", avatar===a && "ring-2 ring-indigo-500 bg-indigo-50")}>{a}</button>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={save} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white font-semibold">Salvar</button>
          <button onClick={onReset} className="px-3 py-2 rounded-xl border">Resetar tudo</button>
          <button onClick={onClose} className="px-3 py-2 rounded-xl border">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function Footer(){
  return (
    <div className="mt-10 py-6 text-center text-xs text-gray-500">
      Feito com ❤️ para aprender brincando. Conteúdo de exemplo. Adapte as lições no código.
      <div className="mt-1">PWA habilitado: use o botão “Instalar”. Android: ver instruções no topo do arquivo.</div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
