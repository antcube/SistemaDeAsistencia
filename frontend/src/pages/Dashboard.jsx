import { useCallback, useEffect, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import dashboardService from "../services/dashboardService";
import circleService from "../services/circleService";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CATEGORY_LABELS = {
  "CIRCULO DE LIDERAZGO": "Círculo De Liderazgo",
  HEALTH: "Health",
  MENTORIA: "Mentoría",
  MASTERCLASS: "Masterclass",
  "ANUNCIOS CORPORATIVOS": "Anuncios Corporativos",
  ORDINARIA: "Ordinaria",
};

const pct = (value) => `${Number(value || 0).toFixed(1)}%`;
const clamp = (value) => Math.min(100, Math.max(0, Number(value) || 0));
const formatCategory = (value) => CATEGORY_LABELS[value] || value || "Sesión";

const Icon = ({ name, className = "h-5 w-5" }) => {
  const common = {
    fill: "none", stroke: "currentColor", strokeWidth: 1.8,
    strokeLinecap: "round", strokeLinejoin: "round", className,
    viewBox: "0 0 24 24",
  };
  if (name === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
  if (name === "x") return <svg {...common}><path d="m7 7 10 10M17 7 7 17"/></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 19 6v5c0 4.6-2.8 8.1-7 10-4.2-1.9-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (name === "trend") return <svg {...common}><path d="M3 17 9 11l4 4 8-9"/><path d="M16 6h5v5"/></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18"/></svg>;
  if (name === "refresh") return <svg {...common}><path d="M20 11a8.1 8.1 0 0 0-14.8-4L3 10"/><path d="M3 5v5h5"/><path d="M4 13a8.1 8.1 0 0 0 14.8 4L21 14"/><path d="M21 19v-5h-5"/></svg>;
  if (name === "pdf") return <svg {...common}><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M8 13h2.2a1.8 1.8 0 0 0 0-3.6H8v7.2M13 16.6V9.4h2.1a3.6 3.6 0 0 1 0 7.2H13M8 16.6v-7.2"/></svg>;
  if (name === "monitor") return <svg {...common}><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
  if (name === "location") return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
  if (name === "gift") return <svg {...common}><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H8.5a2.5 2.5 0 1 1 2.5-2.5V8ZM12 8h3.5A2.5 2.5 0 1 0 13 5.5V8Z"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="8"/></svg>;
};

const AnimatedNumber = ({ value, suffix = "", decimals = 1 }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    let frame;
    const start = performance.now();
    const duration = 700;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display.toFixed(decimals)}{suffix}</>;
};

const WeeklyChart = ({ data, selectedWeek, onWeek }) => {
  const weekly = data?.weekly || [];
  const width = 620;
  const height = 170;
  const left = 38;
  const right = 18;
  const top = 18;
  const bottom = 34;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const points = weekly.map((item, index) => ({
    ...item,
    x: left + (weekly.length <= 1 ? innerW / 2 : index * innerW / (weekly.length - 1)),
    y: top + innerH - clamp(item.rate) / 100 * innerH,
  }));
  const path = points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] p-2 transition-all duration-300 group-hover:bg-[#06122b]">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {[0,25,50,75,100].map((value) => {
          const y = top + innerH - value / 100 * innerH;
          return <g key={value}><line x1={left} x2={width-right} y1={y} y2={y} stroke="rgba(82,146,230,0.2)" strokeDasharray="4 5"/><text x={left-8} y={y+3} textAnchor="end" className="fill-[#AAB9DA] text-[9px]">{value}%</text></g>;
        })}
        {path && <path d={path} fill="none" stroke="#4CC8FF" strokeWidth="4" filter="drop-shadow(0 0 5px rgba(76,200,255,.8))" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1000" strokeDashoffset="1000" className="animate-[drawLine_1.2s_ease-out_forwards]"/>}
        {points.map((item) => {
          const active = selectedWeek === item.week;
          return <g key={item.week} onClick={() => onWeek(item.week)} className="cursor-pointer">
            <circle cx={item.x} cy={item.y} r={active ? 9 : 6} fill={active ? "#4CC8FF" : "#080F24"} stroke="#4CC8FF" strokeWidth="3" filter="drop-shadow(0 0 4px rgba(76,200,255,.75))" className="transition-all duration-300 hover:scale-125"/>
            <text x={item.x} y={item.y-14} textAnchor="middle" className={`text-[10px] font-black ${active ? "fill-[#4CC8FF]" : "fill-[#AAB9DA]"}`}>{pct(item.rate)}</text>
          </g>;
        })}
      </svg>
      <div className="absolute inset-x-7 bottom-1 flex justify-between gap-1">
        {weekly.map((item) => <button key={item.week} type="button" onClick={() => onWeek(item.week)} className={`rounded-lg px-2 py-1 text-[8px] font-black transition-all duration-200 hover:-translate-y-0.5 ${selectedWeek === item.week ? "bg-[#2457c5] text-white shadow-md" : "text-[#AAB9DA] hover:bg-white/5 hover:text-[#4CC8FF]"}`}>{item.label}</button>)}
      </div>
    </div>
  );
};

const getStatusTotal = (data) => {
  const status = data?.status || {};
  return Number(status.attended || 0) + Number(status.absent || 0) + Number(status.justified || 0);
};

const getGlobalRate = (presential, virtual, field) => {
  const pTotal = getStatusTotal(presential);
  const vTotal = getStatusTotal(virtual);
  const total = pTotal + vTotal;
  if (!total) {
    const p = Number(presential?.summary?.[field] || 0);
    const v = Number(virtual?.summary?.[field] || 0);
    return (p + v) / (presential && virtual ? 2 : 1);
  }
  const pValue = Number(presential?.summary?.[field] || 0);
  const vValue = Number(virtual?.summary?.[field] || 0);
  return ((pValue * pTotal) + (vValue * vTotal)) / total;
};

const ComparisonWeeklyChart = ({ presential, virtual, selectedWeek, onWeek }) => {
  const pWeekly = presential?.weekly || [];
  const vWeekly = virtual?.weekly || [];
  const weeks = Array.from(new Map([...pWeekly, ...vWeekly].map((item) => [item.week, item])).values()).sort((a,b) => Number(a.week)-Number(b.week));
  const width = 920;
  const height = 250;
  const left = 48;
  const right = 24;
  const top = 24;
  const bottom = 42;
  const innerW = width-left-right;
  const innerH = height-top-bottom;
  const pointFor = (weekly, item, index) => {
    const found = weekly.find((row) => row.week === item.week);
    const rate = clamp(found?.rate || 0);
    return { week:item.week, label:item.label || `Semana ${item.week}`, rate, x:left+(weeks.length<=1?innerW/2:index*innerW/(weeks.length-1)), y:top+innerH-rate/100*innerH };
  };
  const pPoints = weeks.map((item,i)=>pointFor(pWeekly,item,i));
  const vPoints = weeks.map((item,i)=>pointFor(vWeekly,item,i));
  const path = (pts) => pts.map((p,i)=>`${i?"L":"M"} ${p.x} ${p.y}`).join(" ");
  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl border border-[#1E293B] bg-[#090D16] p-2">
      <div className="absolute right-4 top-3 z-10 flex items-center gap-3 rounded-xl border border-[#1E293B] bg-[#0D111D]/90 px-3 py-2 text-[9px] font-bold text-[#CBD5E1] backdrop-blur">
        <span className="flex items-center gap-1.5"><i className="h-2 w-5 rounded-full bg-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,.6)]"/>Presencial</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-5 rounded-full bg-[#8B5CF6] shadow-[0_0_10px_rgba(139,92,246,.6)]"/>Virtual</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="presentialArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00F0FF" stopOpacity=".18"/><stop offset="100%" stopColor="#00F0FF" stopOpacity="0"/></linearGradient>
          <linearGradient id="virtualArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity=".16"/><stop offset="100%" stopColor="#8B5CF6" stopOpacity="0"/></linearGradient>
        </defs>
        {[0,25,50,75,100].map((value)=>{const y=top+innerH-value/100*innerH;return <g key={value}><line x1={left} x2={width-right} y1={y} y2={y} stroke="rgba(148,163,184,.16)" strokeDasharray="4 7"/><text x={left-10} y={y+4} textAnchor="end" className="fill-[#64748B] text-[10px]">{value}%</text></g>})}
        {pPoints.length>1 && <path d={`${path(pPoints)} L ${pPoints[pPoints.length-1].x} ${top+innerH} L ${pPoints[0].x} ${top+innerH} Z`} fill="url(#presentialArea)"/>}
        {vPoints.length>1 && <path d={`${path(vPoints)} L ${vPoints[vPoints.length-1].x} ${top+innerH} L ${vPoints[0].x} ${top+innerH} Z`} fill="url(#virtualArea)"/>}
        {pPoints.length>0 && <path d={path(pPoints)} fill="none" stroke="#00F0FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 6px rgba(0,240,255,.55))"/>}
        {vPoints.length>0 && <path d={path(vPoints)} fill="none" stroke="#8B5CF6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 6px rgba(139,92,246,.55))"/>}
        {pPoints.map((p)=> <g key={`p-${p.week}`} onClick={()=>onWeek(p.week)} className="cursor-pointer"><circle cx={p.x} cy={p.y} r={selectedWeek===p.week?7:5} fill="#090D16" stroke="#00F0FF" strokeWidth="3"/><text x={p.x} y={p.y-12} textAnchor="middle" className="fill-[#67E8F9] text-[9px] font-black">{pct(p.rate)}</text></g>)}
        {vPoints.map((p)=> <g key={`v-${p.week}`} onClick={()=>onWeek(p.week)} className="cursor-pointer"><circle cx={p.x} cy={p.y} r={selectedWeek===p.week?7:5} fill="#090D16" stroke="#8B5CF6" strokeWidth="3"/><text x={p.x} y={p.y+18} textAnchor="middle" className="fill-[#C4B5FD] text-[9px] font-black">{pct(p.rate)}</text></g>)}
      </svg>
      <div className="absolute bottom-2 left-12 right-6 flex justify-between">
        {weeks.map((item)=><button key={item.week} type="button" onClick={()=>onWeek(item.week)} className={`rounded-lg px-2 py-1 text-[8px] font-black transition ${selectedWeek===item.week?"bg-[#1E293B] text-white":"text-[#64748B] hover:text-white"}`}>{item.label || `Semana ${item.week}`}</button>)}
      </div>
    </div>
  );
};

const CompactStatusDonut = ({ title, data, tone = "cyan" }) => {
  const status = data?.status || {attended:0,absent:0,justified:0};
  const total = getStatusTotal(data);
  const values = [Number(status.attended||0),Number(status.absent||0),Number(status.justified||0)];
  const colors = [tone === "violet" ? "#8B5CF6" : "#00F0FF", "#F43F5E", "#F59E0B"];
  let current = 0;
  const gradient = total ? values.map((value,index)=>{const start=current;current += value/total*360;return `${colors[index]} ${start}deg ${current}deg`;}).join(", ") : "#111827 0deg 360deg";
  return (
    <div className="flex min-w-0 items-center gap-6 rounded-2xl border border-[#1E293B] bg-[#090D16]/80 p-5">
      <div className="relative h-32 w-32 shrink-0 rounded-full p-[8px]" style={{background:`conic-gradient(${gradient})`,boxShadow:`0 0 30px ${tone==="violet"?"rgba(139,92,246,.14)":"rgba(0,240,255,.14)"}`}}>
        <div className="grid h-full w-full place-items-center rounded-full bg-[#0D111D] text-center"><div><p className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">Registros</p><strong className="text-[28px] font-black text-white">{total}</strong></div></div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between"><div><p className={`text-[9px] font-black uppercase tracking-[.18em] ${tone==="violet"?"text-[#A78BFA]":"text-[#67E8F9]"}`}>{title}</p><h4 className="text-[15px] font-black text-white">Estado de asistencia</h4></div></div>
        <div className="space-y-2">
          {[["Asistió",values[0],colors[0]],["Faltó",values[1],colors[1]],["Justificado",values[2],colors[2]]].map(([label,value,color])=><div key={label} className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-2 font-bold text-[#CBD5E1]"><i className="h-2 w-2 rounded-full" style={{background:color}}/>{label}</span><strong className="text-white">{value} <small className="ml-1 text-[#64748B]">{total?pct(value/total*100):"0.0%"}</small></strong></div>)}
        </div>
      </div>
    </div>
  );
};

const DenseCategoryBars = ({ data, tone = "cyan" }) => {
  const items = data?.categories || [];
  const accent = tone === "violet" ? "from-[#8B5CF6] to-[#6366F1]" : "from-[#00F0FF] to-[#38BDF8]";
  return (
    <div className="grid min-h-0 gap-2">
      {items.length === 0 ? <p className="grid h-16 place-items-center text-[9px] text-[#64748B]">Sin sesiones en el período.</p> : items.map((item) => (
        <div key={item.type} className="rounded-lg border border-[#1E293B] bg-[#090D16]/70 px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-[10px] font-bold text-[#E2E8F0]">{formatCategory(item.type)}</span>
            <span className="text-[10px] font-black text-white">{pct(item.rate)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#111827]">
            <div className={`h-full rounded-full bg-gradient-to-r ${accent} transition-all duration-700`} style={{width:`${clamp(item.rate)}%`}} />
          </div>
          <p className="mt-1.5 truncate text-[8px] text-[#64748B]">{item.sessions} sesiones · {item.attended + item.justified} válidas</p>
        </div>
      ))}
    </div>
  );
};

const DenseJustifications = ({ data }) => {
  const source = data?.justificationTypes || [];
  const order = ["Trabajo", "Salud", "Viaje Programado", "Conexión Inestable"];
  const palette = {
    "Trabajo": "bg-[#38BDF8]",
    "Salud": "bg-[#F43F5E]",
    "Viaje Programado": "bg-[#8B5CF6]",
    "Conexión Inestable": "bg-[#10B981]",
  };
  const items = order.map((type) => ({
    type,
    count: Number(source.find((row) => String(row.type || "").trim().toLowerCase() === type.toLowerCase())?.count || 0),
  }));
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.type} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#1E293B] bg-[#090D16]/70 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold text-[#CBD5E1]"><i className={`h-1.5 w-1.5 shrink-0 rounded-full ${palette[item.type]}`}/><span className="truncate">{item.type}</span></span>
          <strong className="text-[11px] text-white">{item.count}</strong>
        </div>
      ))}
    </div>
  );
};

const DensePanel = ({ title, eyebrow, children, className = "" }) => (
  <section className={`min-h-0 overflow-hidden rounded-xl border border-[#1E293B] bg-[#0D1527]/90 p-3.5 shadow-[0_10px_28px_rgba(0,0,0,.24)] ${className}`}>
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <div className="min-w-0">
        {eyebrow && <p className="truncate text-[8px] font-black uppercase tracking-[.16em] text-[#38BDF8]">{eyebrow}</p>}
        <h3 className="truncate text-[13px] font-extrabold text-white">{title}</h3>
      </div>
    </div>
    <div className="min-h-0 flex-1">{children}</div>
  </section>
);

const MicroKpi = ({ label, value, tone = "cyan", suffix = "%", subLeft, subRight }) => {
  const tones = {
    cyan: ["border-t-[#38BDF8]", "text-[#67E8F9]"],
    green: ["border-t-[#10B981]", "text-[#34D399]"],
    red: ["border-t-[#F43F5E]", "text-[#FB7185]"],
    amber: ["border-t-[#F59E0B]", "text-[#FBBF24]"],
    violet: ["border-t-[#8B5CF6]", "text-[#A78BFA]"],
  };
  const [border, accent] = tones[tone] || tones.cyan;
  return (
    <article className={`min-w-0 rounded-xl border border-[#1E293B] border-t-2 ${border} bg-[#131B2E]/85 px-4 py-3 shadow-[0_8px_20px_rgba(0,0,0,.2)]`}>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0"><p className="truncate text-[8px] font-black uppercase tracking-[.13em] text-[#94A3B8]">{label}</p><p className="mt-0.5 text-[26px] font-black leading-none text-white"><AnimatedNumber value={value} suffix={suffix} decimals={suffix ? 1 : 0}/></p></div>
        <span className={`text-[8px] font-black ${accent}`}>{suffix ? pct(value) : value}</span>
      </div>
      {(subLeft || subRight) && <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#1E293B] pt-1.5 text-[10px] font-extrabold text-[#7C8FB3]"><span className="truncate">{subLeft}</span><span className="truncate">{subRight}</span></div>}
    </article>
  );
};

const CompactBonusRoster = ({ title, rows, bonus }) => {
  const filtered = (rows || []).filter((member) => bonus ? member.bonus === true : member.bonus !== true);
  const visible = filtered.slice(0, 3);
  return (
    <div className="min-h-0 rounded-lg border border-[#1E293B] bg-[#090D16]/70 p-2">
      <div className="mb-1.5 flex items-center justify-between"><p className={`text-[8px] font-black ${bonus ? "text-[#34D399]" : "text-[#FB7185]"}`}>{title}</p><span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-black text-white">{filtered.length}</span></div>
      <div className="space-y-1">
        {visible.length ? visible.map((member) => <div key={member.id || member.doc || member.name} className="flex items-center justify-between gap-2 text-[7px]"><span className="truncate font-bold text-[#CBD5E1]">{member.name}</span><span className={bonus ? "text-[#34D399]" : "text-[#FB7185]"}>{pct(member.pct)}</span></div>) : <p className="py-2 text-center text-[8px] text-[#64748B]">Sin miembros</p>}
        {filtered.length > 3 && <p className="text-right text-[7px] font-bold text-[#64748B]">+{filtered.length - 3} más</p>}
      </div>
    </div>
  );
};

const ComparisonExecutive = ({ comparison, selectedWeek, onWeek }) => {
  const presential = comparison?.presential || {};
  const virtual = comparison?.virtual || {};
  const pSummary = presential.summary || {};
  const vSummary = virtual.summary || {};
  const globalAttendance = getGlobalRate(presential, virtual, "attendanceRate");
  const globalAbsence = getGlobalRate(presential, virtual, "absenceRate");
  const globalJustified = getGlobalRate(presential, virtual, "justifiedRate");
  const globalAverage = getGlobalRate(presential, virtual, "averageSessionAttendance");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <MicroKpi label="Asistencia global" value={globalAttendance} tone="green" subLeft={`PRESENCIAL ${pct(pSummary.attendanceRate)}`} subRight={`VIRTUAL ${pct(vSummary.attendanceRate)}`}/>
        <MicroKpi label="Faltas globales" value={globalAbsence} tone="red" subLeft={`PRESENCIAL ${pct(pSummary.absenceRate)}`} subRight={`VIRTUAL ${pct(vSummary.absenceRate)}`}/>
        <MicroKpi label="Justificados" value={globalJustified} tone="amber" subLeft={`PRESENCIAL ${pct(pSummary.justifiedRate)}`} subRight={`VIRTUAL ${pct(vSummary.justifiedRate)}`}/>
        <MicroKpi label="Promedio por sesión" value={globalAverage} tone="cyan" subLeft={`PRESENCIAL ${pct(pSummary.averageSessionAttendance)}`} subRight={`VIRTUAL ${pct(vSummary.averageSessionAttendance)}`}/>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <DensePanel title="Evolución comparada de asistencia" eyebrow={selectedWeek ? `Semana ${selectedWeek}` : "Presencial vs. Virtual"} className="col-span-7">
          <div className="h-[305px]"><ComparisonWeeklyChart presential={presential} virtual={virtual} selectedWeek={selectedWeek} onWeek={onWeek}/></div>
        </DensePanel>

        <DensePanel title="Asistencia por tipo de sesión" eyebrow="Presencial vs. Virtual" className="col-span-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0 rounded-xl border border-[#1E293B] bg-[#090D16]/55 p-3">
              <p className="mb-2 text-[9px] font-black uppercase tracking-[.14em] text-[#67E8F9]">Presencial</p>
              <DenseCategoryBars data={presential} tone="cyan"/>
            </div>
            <div className="min-w-0 rounded-xl border border-[#1E293B] bg-[#090D16]/55 p-3">
              <p className="mb-2 text-[9px] font-black uppercase tracking-[.14em] text-[#A78BFA]">Virtual</p>
              <DenseCategoryBars data={virtual} tone="violet"/>
            </div>
          </div>
        </DensePanel>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <section className="col-span-7 grid grid-cols-2 gap-4">
          <CompactStatusDonut title="Presencial" data={presential} tone="cyan"/>
          <CompactStatusDonut title="Virtual" data={virtual} tone="violet"/>
        </section>

        <DensePanel title="Motivos de justificación" eyebrow="Comparativa por modalidad" className="col-span-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-[9px] font-black uppercase tracking-[.14em] text-[#67E8F9]">Presencial</p>
              <DenseJustifications data={presential}/>
            </div>
            <div>
              <p className="mb-2 text-[9px] font-black uppercase tracking-[.14em] text-[#A78BFA]">Virtual</p>
              <DenseJustifications data={virtual}/>
            </div>
          </div>
        </DensePanel>
      </div>
    </div>
  );
};

const CircleExecutive = ({ data, selectedCircle, selectedWeek, onWeek }) => {
  const summary = data?.summary || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-4">
        <MicroKpi label="Total registrado" value={summary.members} suffix="" tone="cyan"/>
        <MicroKpi label="Asistencia" value={summary.attendanceRate} tone="green"/>
        <MicroKpi label="Faltas" value={summary.absenceRate} tone="red"/>
        <MicroKpi label="Justificados" value={summary.justifiedRate} tone="amber"/>
        <MicroKpi label="Promedio / sesión" value={summary.averageSessionAttendance} tone="cyan"/>
        <MicroKpi label="Bonos" value={summary.bonus} suffix="" tone="violet"/>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <DensePanel title="Evolución de asistencia" eyebrow={selectedWeek ? `Semana ${selectedWeek}` : selectedCircle} className="col-span-7">
          <div className="h-[305px]"><WeeklyChart data={data} selectedWeek={selectedWeek} onWeek={onWeek}/></div>
        </DensePanel>

        <DensePanel title="Asistencia por tipo de sesión" eyebrow="Rendimiento por categoría" className="col-span-5">
          <DenseCategoryBars data={data}/>
        </DensePanel>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <section className="col-span-7">
          <CompactStatusDonut title={selectedCircle || "Círculo"} data={data} tone="cyan"/>
        </section>

        <div className="col-span-5 grid grid-cols-2 gap-4">
          <DensePanel title="Tipos de justificación" eyebrow="Motivos registrados">
            <DenseJustifications data={data}/>
          </DensePanel>
          <DensePanel title="Elegibilidad de bono" eyebrow="Regla oficial">
            <div className="grid grid-cols-2 gap-2">
              <CompactBonusRoster title="Reciben" rows={data?.recipients} bonus/>
              <CompactBonusRoster title="No reciben" rows={data?.nonRecipients}/>
            </div>
          </DensePanel>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [circles, setCircles] = useState([]);
  const [selectedCircle, setSelectedCircle] = useState("");
  const [mode, setMode] = useState("comparison");
  const [dashboard, setDashboard] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingCircles, setLoadingCircles] = useState(true);
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCircles(true);
        const data = await circleService.getCircles();
        if (!mounted) return;
        const list = Array.isArray(data) ? data : [];
        setCircles(list);
        setSelectedCircle((current) => current || list[0]?.name || "");
      } catch (err) {
        if (mounted) setError(err.message || "No Se Pudieron Cargar Los Círculos.");
      } finally { if (mounted) setLoadingCircles(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const load = useCallback(async (weekOverride = selectedWeek) => {
    try {
      setLoading(true); setError("");
      const data = await dashboardService.getDashboard(year, month, mode === "circle" ? selectedCircle : "", weekOverride);
      setDashboard(data);
    } catch (err) {
      console.error(err); setError(err.message || "No Se Pudo Cargar El Dashboard.");
    } finally { setLoading(false); }
  }, [year, month, mode, selectedCircle, selectedWeek]);

  useEffect(() => {
    if (mode === "comparison" || selectedCircle) load();
  }, [load, mode, selectedCircle]);

  const loadWeek = useCallback(async (week) => {
    try {
      setLoading(true); setError("");
      const data = await dashboardService.getDashboard(year, month, mode === "circle" ? selectedCircle : "", week);
      setDashboard(data);
      setSelectedWeek(week);
    } catch (err) { console.error(err); setError(err.message || "No Se Pudo Cargar La Semana."); }
    finally { setLoading(false); }
  }, [year, month, selectedCircle, mode]);

  const clearWeek = useCallback(async () => {
    setSelectedWeek(null);
    try {
      setLoading(true);
      const data = await dashboardService.getDashboard(year, month, mode === "circle" ? selectedCircle : "", null);
      setDashboard(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "No Se Pudo Cargar El Mes.");
    } finally {
      setLoading(false);
    }
  }, [year, month, mode, selectedCircle, selectedWeek]);

  const moveMonth = (amount) => {
    let next = month + amount; let nextYear = year;
    if (next > 12) { next = 1; nextYear += 1; }
    if (next < 1) { next = 12; nextYear -= 1; }
    setMonth(next); setYear(nextYear); setSelectedWeek(null);
  };

  const currentDataset = dashboard?.mode === "circle" ? dashboard : null;
  const comparison = dashboard?.comparison || {};
  const downloadDashboardPdf = useCallback(async () => {
    let exportArea = null;
    try {
      setPdfLoading(true);
      const source = document.querySelector("#dashboard-export-area");
      if (!source) throw new Error("No Se Encontró El Contenido Del Dashboard.");

      const rect = source.getBoundingClientRect();
      const exportWidth = Math.max(
        Math.ceil(source.scrollWidth || 0),
        Math.ceil(rect.width || 0),
        900
      );

      exportArea = source.cloneNode(true);
      exportArea.removeAttribute("id");
      exportArea.style.position = "absolute";
      exportArea.style.left = "-100000px";
      exportArea.style.top = "0";
      exportArea.style.margin = "0";
      exportArea.style.padding = "0";
      exportArea.style.transform = "none";
      exportArea.style.overflow = "visible";
      exportArea.style.width = `${exportWidth}px`;
      exportArea.style.minWidth = `${exportWidth}px`;
      exportArea.style.maxWidth = "none";
      exportArea.style.height = "auto";
      exportArea.style.maxHeight = "none";
      exportArea.style.background = "#080F24";
      exportArea.style.color = "#ffffff";
      exportArea.style.boxSizing = "border-box";
      exportArea.style.pointerEvents = "none";

      exportArea.querySelectorAll("[data-no-pdf]").forEach((el) => el.remove());
      exportArea.querySelectorAll("[data-pdf-only]").forEach((el) => { el.style.display = "flex"; });

      exportArea.querySelectorAll("button").forEach((el) => {
        el.style.pointerEvents = "none";
      });

      exportArea.querySelectorAll(".overflow-auto, .overflow-y-auto").forEach((el) => {
        el.style.maxHeight = "none";
        el.style.height = "auto";
        el.style.overflow = "visible";
        el.style.overflowX = "visible";
        el.style.overflowY = "visible";
      });

      document.body.appendChild(exportArea);

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await document.fonts?.ready;

      const finalWidth = Math.max(
        exportArea.scrollWidth,
        exportArea.clientWidth,
        exportWidth
      );
      const finalHeight = Math.max(
        exportArea.scrollHeight,
        exportArea.clientHeight
      );

      exportArea.style.width = `${finalWidth}px`;
      exportArea.style.minWidth = `${finalWidth}px`;

      const canvas = await html2canvas(exportArea, {
        backgroundColor: "#080F24",
        scale: 1.5,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: finalWidth,
        height: finalHeight,
        windowWidth: finalWidth,
        windowHeight: finalHeight,
      });

      if (!canvas?.width || !canvas?.height) {
        throw new Error("El Dashboard Quedó Vacío Al Generar El PDF.");
      }

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const imageHeight = canvas.height * usableWidth / canvas.width;
      const sourcePageHeight = Math.max(
        1,
        Math.floor(canvas.height * usableHeight / imageHeight)
      );

      let sourceY = 0;
      let page = 0;

      while (sourceY < canvas.height) {
        const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceHeight;

        const context = slice.getContext("2d");
        if (!context) throw new Error("No Se Pudo Preparar La Página Del PDF.");
        context.fillStyle = "#080F24";
        context.fillRect(0, 0, slice.width, slice.height);
        context.drawImage(
          canvas,
          0, sourceY, canvas.width, sliceHeight,
          0, 0, canvas.width, sliceHeight
        );

        if (page > 0) pdf.addPage();

        const sliceScaledHeight = slice.height * usableWidth / slice.width;
        pdf.addImage(
          slice.toDataURL("image/jpeg", 0.92),
          "JPEG",
          margin,
          margin,
          usableWidth,
          sliceScaledHeight,
          undefined,
          "FAST"
        );

        sourceY += sliceHeight;
        page += 1;
      }

      const scopeName = mode === "comparison"
        ? "Comparativa"
        : (selectedCircle || "Circulo");
      const safeScope = String(scopeName)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "");

      pdf.save(`Dashboard_${safeScope}_${MONTHS[month - 1]}_${year}.pdf`);
    } catch (error) {
      console.error("Error Exportando Dashboard A PDF:", error);
      alert(error?.message || "No Se Pudo Generar El PDF Del Dashboard.");
    } finally {
      if (exportArea?.parentNode) {
        exportArea.parentNode.removeChild(exportArea);
      }
      setPdfLoading(false);
    }
  }, [mode, selectedCircle, month, year]);

  return (
    <section className="relative min-h-[calc(100vh-58px)] w-full overflow-x-hidden bg-[#090D16] px-5 py-3 text-white">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#2457c5]/10 blur-3xl"/>
      <div className="pointer-events-none absolute right-[-100px] top-[-70px] h-80 w-80 rounded-full bg-[#8B5CF6]/8 blur-3xl"/>

      <div className="relative mx-auto w-full max-w-[1480px] space-y-4">
        <header data-no-pdf className="flex min-h-[66px] items-center gap-3.5 rounded-2xl border border-[#1E293B] bg-[#0D1527]/95 px-5 py-3 shadow-[0_10px_30px_rgba(0,0,0,.28)] backdrop-blur-xl">
          <div className="flex min-w-[205px] items-center gap-2">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#2457c5] to-[#4CC8FF] text-white shadow-[0_0_14px_rgba(76,200,255,.18)]"><Icon name="trend" className="h-3.5 w-3.5"/></div>
            <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#38BDF8]"></p><h1 className="truncate text-[15px] font-black leading-tight text-white">Dashboard Ejecutivo</h1></div>
          </div>

          <div className="flex h-10 rounded-lg border border-[#1E293B] bg-[#090D16] p-0.5">
            <button type="button" onClick={() => {setMode("comparison");setSelectedWeek(null);}} className={`rounded-md px-4 text-[10px] font-black transition-all ${mode === "comparison" ? "bg-gradient-to-r from-[#2457c5] to-[#38BDF8] text-white shadow-[0_0_12px_rgba(56,189,248,.2)]" : "text-[#94A3B8] hover:text-white"}`}>Comparativa</button>
            <button type="button" onClick={() => {setMode("circle");setSelectedWeek(null);}} className={`rounded-md px-4 text-[10px] font-black transition-all ${mode === "circle" ? "bg-gradient-to-r from-[#2457c5] to-[#38BDF8] text-white shadow-[0_0_12px_rgba(56,189,248,.2)]" : "text-[#94A3B8] hover:text-white"}`}>Por Círculo</button>
          </div>

          {mode === "circle" && <select value={selectedCircle} onChange={(e) => {setSelectedCircle(e.target.value);setSelectedWeek(null);}} disabled={loadingCircles} className="h-10 w-[190px] rounded-lg border border-[#1E293B] bg-[#090D16] px-3 text-[10px] font-black text-white outline-none focus:border-[#38BDF8]"><option value="">Seleccionar Círculo</option>{circles.map((circle) => <option key={circle._id || circle.name} value={circle.name}>{circle.name}</option>)}</select>}

          <div className="flex h-10 items-center overflow-hidden rounded-lg border border-[#1E293B] bg-[#090D16]">
            <button type="button" onClick={() => moveMonth(-1)} className="grid h-full w-9 place-items-center text-[#94A3B8] hover:text-[#38BDF8]">‹</button>
            <div className="min-w-[128px] border-x border-[#1E293B] px-2.5 text-center text-[10px] font-black text-white">{MONTHS[month-1]} {year}</div>
            <button type="button" onClick={() => moveMonth(1)} className="grid h-full w-9 place-items-center text-[#94A3B8] hover:text-[#38BDF8]">›</button>
          </div>

          <button type="button" onClick={() => load()} disabled={loading || (mode === "circle" && !selectedCircle)} className="flex h-10 items-center gap-2 rounded-lg border border-[#38BDF8]/35 bg-[#10244e] px-4 text-[10px] font-black text-[#7DD3FC] disabled:opacity-50"><Icon name="refresh" className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}/><span>Actualizar</span></button>
          {selectedWeek && <button type="button" onClick={clearWeek} className="h-10 rounded-lg border border-[#1E293B] bg-[#090D16] px-4 text-[10px] font-black text-[#38BDF8]">Mes completo</button>}

          <div className="ml-auto hidden min-w-0 text-right xl:block"><p className="truncate text-[10px] font-black text-white">{mode === "comparison" ? "Presencial vs. Virtual" : selectedCircle}</p><p className="text-[9px] text-[#64748B]">{selectedWeek ? `Semana ${selectedWeek}` : "Mes completo"}</p></div>
          <button type="button" onClick={downloadDashboardPdf} disabled={pdfLoading} className="flex h-10 items-center gap-2 rounded-lg border border-[#F43F5E]/35 bg-[#45152a]/80 px-4 text-[10px] font-black text-[#ffd9e2] disabled:opacity-60"><Icon name={pdfLoading ? "refresh" : "pdf"} className={`h-3.5 w-3.5 text-[#FB7185] ${pdfLoading ? "animate-spin" : ""}`}/><span>{pdfLoading ? "Generando" : "PDF"}</span></button>
        </header>

        <main id="dashboard-export-area" className="w-full">
          <div data-pdf-only style={{display:"none"}} className="mb-2 items-center justify-between rounded-xl border border-[#1E293B] bg-[#131B2E] px-4 py-3">
            <div><p className="text-[7px] font-black uppercase tracking-[.2em] text-[#38BDF8]">Círculos De Liderazgo · Círculos Connect</p><h2 className="text-base font-black text-white">Reporte Ejecutivo de Asistencia</h2><p className="text-[8px] text-[#94A3B8]">{mode === "comparison" ? "Comparativa Presencial vs. Virtual" : selectedCircle} · {MONTHS[month-1]} {year}</p></div>
            <div className="text-right"><div className="ml-auto grid h-8 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] text-[12px] font-black text-white">CL</div><p className="mt-1 text-[7px] text-[#94A3B8]">{new Date().toLocaleDateString("es-PE")}</p></div>
          </div>

          {error && <div className="mb-2 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-[8px] font-bold text-rose-200">{error}</div>}
          {loading && !dashboard ? (
            <div className="grid h-full place-items-center rounded-xl border border-[#1E293B] bg-[#0D1527] text-[10px] font-bold text-[#94A3B8] animate-pulse">Cargando Dashboard...</div>
          ) : mode === "comparison" ? (
            <ComparisonExecutive comparison={comparison} selectedWeek={selectedWeek} onWeek={loadWeek}/>
          ) : currentDataset ? (
            <CircleExecutive data={currentDataset} selectedCircle={selectedCircle} selectedWeek={selectedWeek} onWeek={loadWeek}/>
          ) : (
            <div className="grid h-full place-items-center rounded-xl border border-[#1E293B] bg-[#0D1527] text-[10px] font-bold text-[#94A3B8]">Selecciona Un Círculo.</div>
          )}
        </main>
      </div>
      <style>{`@keyframes drawLine{from{stroke-dashoffset:1000}to{stroke-dashoffset:0}}@keyframes growBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}@media (max-width:1280px){#dashboard-export-area{font-size:96%}}@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}`}</style>
    </section>
  );
};

export default Dashboard;