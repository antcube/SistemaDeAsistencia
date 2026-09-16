import { useCallback, useEffect, useMemo, useState } from "react";
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

const categoryColor = (category) => ({
  "CIRCULO DE LIDERAZGO": "from-blue-500 to-indigo-500",
  HEALTH: "from-cyan-400 to-teal-500",
  MENTORIA: "from-violet-500 to-purple-500",
  MASTERCLASS: "from-sky-400 to-blue-500",
  "ANUNCIOS CORPORATIVOS": "from-pink-400 to-rose-500",
  ORDINARIA: "from-amber-400 to-orange-500",
}[category] || "from-blue-500 to-cyan-500");

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

const Section = ({ title, subtitle, children, className = "" }) => (
  <section className={`group relative overflow-hidden rounded-2xl border border-[#17366b] bg-gradient-to-br from-[#0d2045] via-[#102b5c] to-[#0a1b3d] p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:border-[#2f73d9] hover:shadow-[0_18px_42px_rgba(36,126,232,0.18)] ${className}`}>
    <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    <div className="relative mb-3">
      <h2 className="text-[15px] font-extrabold tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[9px] text-[#8ea6cc]">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const KpiCard = ({ icon, label, value, color, iconColor, accent, glow = "shadow-[0_0_22px_rgba(36,126,232,.16)]", suffix = "%", decimals = 1, helper }) => (
  <div className={`group relative overflow-hidden rounded-2xl border border-[#24558f] bg-gradient-to-br from-[#102b5c] via-[#0b2147] to-[#071833] p-3 shadow-[0_8px_24px_rgba(2,12,35,0.38)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#4d9cff] hover:shadow-[0_0_28px_rgba(36,126,232,0.22)]`}>
    <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${color} opacity-95 transition-all duration-300 group-hover:h-[3px]`} />
    <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full ${accent} opacity-20 blur-2xl transition-all duration-500 group-hover:opacity-35 group-hover:scale-125`} />
    <div className="relative flex items-center justify-between gap-2">
      <div className={`grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-[#0b234b]/95 ${iconColor} ${glow} shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
        <Icon name={icon} className="h-4 w-4" />
      </div>
      <span className="rounded-full border border-white/5 bg-[#163461]/80 px-2 py-1 text-[7px] font-black tracking-[.08em] text-[#8ea6cc]">
        {helper}
      </span>
    </div>
    <p className="relative mt-2 text-[8px] font-black uppercase tracking-[0.13em] text-[#8ea6cc]">{label}</p>
    <p className="relative mt-0.5 text-[27px] font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.08)]">
      <AnimatedNumber value={value} suffix={suffix} decimals={decimals} />
    </p>
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#102e57]">
      <div className={`h-full rounded-full bg-gradient-to-r ${color} opacity-90 transition-all duration-700 group-hover:brightness-125`} style={{ width: `${clamp(value)}%` }} />
    </div>
  </div>
);

const DatasetKpis = ({ data }) => {
  const summary = data?.summary || {};
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      <div className="group relative overflow-hidden rounded-2xl border border-[#24558f] bg-gradient-to-br from-[#123363] via-[#0b234b] to-[#071833] p-3 shadow-[0_8px_24px_rgba(2,12,35,0.38)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#4d9cff] hover:shadow-[0_0_28px_rgba(36,126,232,0.22)]">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#1d8cff] to-[#38c9ff] transition-all duration-300 group-hover:h-[3px]" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[#1598ff] opacity-10 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-20" />
        <div className="relative flex items-center justify-between">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-[#2a8de0]/60 bg-[#0b234b]/95 text-[#5dc7ff] shadow-[0_0_18px_rgba(29,140,255,0.12)] transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
            <Icon name="users" className="h-4 w-4" />
          </div>
          <span className="text-[7px] font-black tracking-wide text-[#64b5ff]">MIEMBROS</span>
        </div>
        <p className="relative mt-2 text-[8px] font-black uppercase tracking-[0.13em] text-[#8ea6cc]">Total Registrado</p>
        <p className="relative mt-0.5 text-[27px] font-black tracking-tight text-white"><AnimatedNumber value={summary.members} suffix="" decimals={0}/></p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#102e57]"><div className="h-full w-full rounded-full bg-gradient-to-r from-[#1d8cff] to-[#38c9ff] opacity-90" /></div>
      </div>
      <KpiCard icon="check" label="Asistencia" value={summary.attendanceRate} color="from-[#19d7d0] to-[#268dff]" iconColor="text-[#45e1df]" accent="bg-[#19d7d0]" helper="DEL PERÍODO" glow="shadow-[0_0_22px_rgba(25,215,208,.28)]" />
      <KpiCard icon="x" label="Faltas" value={summary.absenceRate} color="from-[#ff4d78] to-[#b83cff]" iconColor="text-[#ff6b91]" accent="bg-[#ff4d78]" helper="DEL PERÍODO" glow="shadow-[0_0_22px_rgba(255,77,120,.28)]" />
      <KpiCard icon="shield" label="Justificados" value={summary.justifiedRate} color="from-[#ffc338] to-[#ff8a24]" iconColor="text-[#ffc94d]" accent="bg-[#ffc338]" helper="DEL PERÍODO" glow="shadow-[0_0_22px_rgba(255,195,56,.24)]" />
      <KpiCard icon="trend" label="Promedio Por Sesión" value={summary.averageSessionAttendance} color="from-[#32b9ff] to-[#4169ff]" iconColor="text-[#58c8ff]" accent="bg-[#32b9ff]" helper="PROMEDIO" glow="shadow-[0_0_22px_rgba(50,185,255,.26)]" />
      <KpiCard icon="gift" label="Bonos" value={summary.bonus} color="from-[#9b5cff] to-[#4f6cff]" iconColor="text-[#a984ff]" accent="bg-[#8b5cf6]" suffix="" decimals={0} helper="RECIBIDOS" glow="shadow-[0_0_22px_rgba(155,92,255,.28)]" />
    </div>
  );
};

const StatusDonut = ({ data }) => {
  const status = data?.status || { attended: 0, absent: 0, justified: 0 };
  const total = status.attended + status.absent + status.justified;
  const a = total ? status.attended / total * 360 : 0;
  const f = total ? status.absent / total * 360 : 0;
  const j = total ? status.justified / total * 360 : 0;
  const style = { background: `conic-gradient(#18e0c2 0deg ${a}deg,#ff4f7b ${a}deg ${a + f}deg,#ffc53d ${a + f}deg ${a + f + j}deg,#12345f ${a + f + j}deg 360deg)`, filter: "drop-shadow(0 0 10px rgba(39,209,255,.45)) drop-shadow(0 0 24px rgba(39,209,255,.18))" };
  return (
    <div className="flex h-[205px] items-center justify-center gap-6">
      <div className="relative grid h-40 w-40 shrink-0 place-items-center rounded-full p-3 shadow-[inset_0_0_18px_rgba(0,0,0,.55)] transition-transform duration-500 hover:rotate-3 hover:scale-105" style={style}>
        <div className="grid h-full w-full place-items-center rounded-full bg-[#0a1d3d] shadow-sm">
          <div className="text-center"><p className="text-[9px] font-semibold text-[#7f99c1]">Registros</p><strong className="text-3xl font-black text-white"><AnimatedNumber value={total} suffix="" decimals={0}/></strong><p className="text-[8px] text-[#7f99c1]">Del Período</p></div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {[["Asistió",status.attended,"bg-[#0b3c36]0","text-[#39d8a1]"],["Faltó",status.absent,"bg-rose-400","text-[#ff718d]"],["Justificado",status.justified,"bg-amber-300","text-[#ffc86b]"]].map(([label,value,dot,text]) => (
          <div key={label} className="flex items-center justify-between border-b border-[#1b3d70] pb-2 transition-all duration-200 hover:translate-x-1">
            <span className="flex items-center gap-2 text-xs font-bold text-[#b8cbe8]"><span className={`h-2.5 w-2.5 rounded-full ${dot}`}/>{label}</span>
            <span className={`font-black ${text}`}>{value} <small className="ml-1 font-bold text-[#7f99c1]">{total ? pct(value / total * 100) : "0.0%"}</small></span>
          </div>
        ))}
      </div>
    </div>
  );
};

const WeeklyChart = ({ data, selectedWeek, onWeek }) => {
  const weekly = data?.weekly || [];
  const width = 620;
  const height = 205;
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
    <div className="relative h-[225px] w-full overflow-hidden rounded-xl border border-[#1d4178] bg-[#0b1f43] p-2 transition-all duration-300 group-hover:bg-[#102754]">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
        {[0,25,50,75,100].map((value) => {
          const y = top + innerH - value / 100 * innerH;
          return <g key={value}><line x1={left} x2={width-right} y1={y} y2={y} stroke="#244572" strokeDasharray="4 5"/><text x={left-8} y={y+3} textAnchor="end" className="fill-[#6f8db8] text-[9px]">{value}%</text></g>;
        })}
        {path && <path d={path} fill="none" stroke="#25b8ff" strokeWidth="4" filter="drop-shadow(0 0 5px rgba(37,184,255,.8))" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1000" strokeDashoffset="1000" className="animate-[drawLine_1.2s_ease-out_forwards]"/>}
        {points.map((item) => {
          const active = selectedWeek === item.week;
          return <g key={item.week} onClick={() => onWeek(item.week)} className="cursor-pointer">
            <circle cx={item.x} cy={item.y} r={active ? 9 : 6} fill={active ? "#18a8ff" : "#eaf8ff"} stroke="#5bd0ff" strokeWidth="3" filter="drop-shadow(0 0 4px rgba(91,208,255,.75))" className="transition-all duration-300 hover:scale-125"/>
            <text x={item.x} y={item.y-14} textAnchor="middle" className={`text-[10px] font-black ${active ? "fill-blue-700" : "fill-slate-600"}`}>{pct(item.rate)}</text>
          </g>;
        })}
      </svg>
      <div className="absolute inset-x-7 bottom-1 flex justify-between gap-1">
        {weekly.map((item) => <button key={item.week} type="button" onClick={() => onWeek(item.week)} className={`rounded-lg px-2 py-1 text-[8px] font-black transition-all duration-200 hover:-translate-y-0.5 ${selectedWeek === item.week ? "bg-[#1559b8] text-white shadow-md" : "text-[#8ea6cc] hover:bg-blue-50 hover:text-[#6cbcff]"}`}>{item.label}</button>)}
      </div>
    </div>
  );
};

const CategoryBars = ({ data }) => (
  <div className="space-y-3">
    {(data?.categories || []).length === 0 && <p className="py-10 text-center text-xs text-[#7f99c1]">No Hay Sesiones En El Período.</p>}
    {(data?.categories || []).map((item, index) => (
      <div key={item.type} className="group/bar rounded-xl border border-[#1b4a82]/60 bg-[#091b3b]/55 p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#38c9ff]/70 hover:bg-[#0d2854]/80">
        <div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-[9px] font-bold text-[#d9e9ff]">{formatCategory(item.type)}</span><span className="text-[10px] font-black text-white drop-shadow-[0_0_6px_rgba(255,255,255,.25)]">{pct(item.rate)}</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#102d55] shadow-[inset_0_0_8px_rgba(0,0,0,.35)]"><div className={`h-full origin-left rounded-full bg-gradient-to-r ${categoryColor(item.type)} animate-[growBar_.9s_cubic-bezier(.2,.8,.2,1)_forwards] transition-all duration-300 group-hover/bar:brightness-150 group-hover/bar:saturate-150`} style={{ width: `${clamp(item.rate)}%`, animationDelay: `${index*90}ms`, boxShadow: "0 0 8px rgba(37,184,255,.55), 0 0 18px rgba(37,184,255,.22)" }}/></div>
        <p className="mt-1 text-[7px] font-semibold text-[#91add4]">{item.sessions} {item.sessions === 1 ? "Sesión" : "Sesiones"} · {item.attended + item.justified} Asistencias Válidas</p>
      </div>
    ))}
  </div>
);

const JustificationBars = ({ data }) => {
  const source = data?.justificationTypes || [];
  const order = ["Trabajo", "Salud", "Viaje Programado", "Conexión Inestable"];

  const colorByType = {
    "Trabajo": {
      border: "border-[#58f5ff]/45",
      hoverBorder: "hover:border-[#8bffff]",
      background: "bg-[#07131f]/65",
      hoverBackground: "hover:bg-[#0b1d2c]",
      badge: "border-[#58f5ff]/40 bg-[#58f5ff]/10 text-[#8bffff]",
      track: "bg-[#10212d]",
      bar: "bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#58f5ff]",
      glow: "0 0 7px rgba(88,245,255,.85), 0 0 18px rgba(88,245,255,.45), 0 0 30px rgba(88,245,255,.18)",
    },
    "Salud": {
      border: "border-[#ff3b68]/45",
      hoverBorder: "hover:border-[#ff6f91]",
      background: "bg-[#1b101d]/65",
      hoverBackground: "hover:bg-[#29121f]",
      badge: "border-[#ff3b68]/40 bg-[#ff3b68]/10 text-[#ff7f9d]",
      track: "bg-[#321827]",
      bar: "bg-gradient-to-r from-[#b91c3c] via-[#ff2f63] to-[#ff7a96]",
      glow: "0 0 7px rgba(255,59,104,.9), 0 0 18px rgba(255,59,104,.5), 0 0 30px rgba(255,59,104,.2)",
    },
    "Viaje Programado": {
      border: "border-[#b86cff]/45",
      hoverBorder: "hover:border-[#db9cff]",
      background: "bg-[#17112a]/65",
      hoverBackground: "hover:bg-[#24163d]",
      badge: "border-[#b86cff]/40 bg-[#b86cff]/10 text-[#d7a5ff]",
      track: "bg-[#29203b]",
      bar: "bg-gradient-to-r from-[#7c3aed] via-[#b64cff] to-[#ec8cff]",
      glow: "0 0 7px rgba(184,108,255,.9), 0 0 18px rgba(184,108,255,.5), 0 0 30px rgba(184,108,255,.2)",
    },
    "Conexión Inestable": {
      border: "border-[#16e0d2]/45",
      hoverBorder: "hover:border-[#65fff5]",
      background: "bg-[#071d22]/65",
      hoverBackground: "hover:bg-[#0a2a30]",
      badge: "border-[#16e0d2]/40 bg-[#16e0d2]/10 text-[#72fff6]",
      track: "bg-[#103033]",
      bar: "bg-gradient-to-r from-[#0891b2] via-[#14d9cf] to-[#75fff5]",
      glow: "0 0 7px rgba(22,224,210,.9), 0 0 18px rgba(22,224,210,.5), 0 0 30px rgba(22,224,210,.2)",
    },
  };

  const normalized = order.map((type) => {
    const found = source.find((item) => String(item.type || "").trim().toLowerCase() === type.toLowerCase());
    return { type, count: Number(found?.count || 0) };
  });

  const extra = source.filter((item) => !order.some((type) => String(item.type || "").trim().toLowerCase() === type.toLowerCase()));
  const items = [...normalized, ...extra];
  const max = Math.max(...items.map((item) => Number(item.count) || 0), 1);

  return (
    <div className="space-y-2.5">
      {items.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#7f99c1]">No Hay Justificaciones Registradas.</p>
      ) : (
        items.map((item, index) => {
          const palette = colorByType[item.type] || {
            border: "border-[#3289df]/40",
            hoverBorder: "hover:border-[#55c7ff]",
            background: "bg-[#091b3b]/55",
            hoverBackground: "hover:bg-[#0d2854]",
            badge: "border-[#3289df]/40 bg-[#3289df]/10 text-[#7dccff]",
            track: "bg-[#102d55]",
            bar: "bg-gradient-to-r from-[#2457c5] to-[#38c9ff]",
            glow: "0 0 7px rgba(56,201,255,.8), 0 0 18px rgba(56,201,255,.35)",
          };

          return (
            <div
              key={item.type}
              className={`group/just rounded-xl border ${palette.border} ${palette.background} p-2 transition-all duration-200 hover:-translate-y-0.5 ${palette.hoverBorder} ${palette.hoverBackground}`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-[9px] font-bold text-[#d9e9ff]">{item.type}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black shadow-[0_0_10px_rgba(88,245,255,.08)] ${palette.badge}`}>
                  {item.count}
                </span>
              </div>
              <div className={`h-2 overflow-hidden rounded-full ${palette.track} shadow-[inset_0_0_8px_rgba(0,0,0,.35)]`}>
                <div
                  className={`h-full origin-left rounded-full ${palette.bar} animate-[growBar_.8s_ease-out_forwards] transition-all duration-300 group-hover/just:brightness-125`}
                  style={{
                    width: `${((Number(item.count) || 0) / max) * 100}%`,
                    animationDelay: `${index * 70}ms`,
                    boxShadow: palette.glow,
                  }}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

const MemberTable = ({ title, data, bonus = false }) => (
  <div className="overflow-hidden rounded-xl border border-[#1d4178] bg-[#0b1f43]">
    <div className={`grid ${bonus ? "grid-cols-[1.5fr_.65fr_.55fr_.65fr]" : "grid-cols-[1.5fr_.55fr_.55fr_.7fr]"} bg-[#102a55] px-3 py-2 text-[7px] font-black uppercase tracking-wide text-[#8ea6cc]`}>
      <span>Nombre</span><span>{bonus ? "Asistencia" : "Asistencia"}</span><span>Faltas</span><span>{bonus ? "Bono" : "Estado"}</span>
    </div>
    <div className="max-h-[225px] overflow-auto">
      {(data || []).length === 0 ? <p className="px-3 py-9 text-center text-xs text-[#7f99c1]">No Hay Miembros En Esta Categoría.</p> : (data || []).map((member, index) => (
        <div key={member.id || member.doc || member.name} className={`grid ${bonus ? "grid-cols-[1.5fr_.65fr_.55fr_.65fr]" : "grid-cols-[1.5fr_.55fr_.55fr_.7fr]"} items-center border-t border-[#183b70] px-3 py-2 text-[8px] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#102b5c]/90`} style={{animationDelay:`${index*30}ms`}}>
          <span className="truncate font-bold text-[#c6d6ef]" title={member.name}>{member.name}</span>
          <span><b className={`rounded-full px-2 py-1 ${member.pct >= 90 ? "bg-[#0b3c36] text-[#39d8a1]" : member.pct >= 70 ? "bg-[#493315] text-[#ffc86b]" : "bg-[#4a1830] text-[#ff718d]"}`}>{pct(member.pct)}</b></span>
          <span className="font-black text-[#ff718d]">{member.absent}</span>
          {bonus ? <span className="font-black text-[#39d8a1]">✓ Bono</span> : <span className="font-semibold text-[#7f99c1]">{member.pct >= 70 ? "Cumple" : "No Cumple"}</span>}
        </div>
      ))}
    </div>
  </div>
);

const ComparisonPanel = ({ data, tone, selectedWeek, onWeek }) => {
  const isVirtual = tone === "virtual";
  return (
    <div className={`rounded-3xl border p-4 shadow-[0_12px_35px_rgba(15,23,42,0.13)] transition-all duration-500 hover:-translate-y-1 ${isVirtual ? "border-[#3c3472] bg-gradient-to-br from-[#181942] via-[#102b5c] to-[#151b4b] hover:shadow-[0_22px_45px_rgba(107,76,255,0.20)]" : "border-[#174d82] bg-gradient-to-br from-[#0b294d] via-[#102b5c] to-[#0c394f] hover:shadow-[0_22px_45px_rgba(36,126,232,0.20)]"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2"><div className={`grid h-10 w-10 place-items-center rounded-2xl text-white shadow-lg ${isVirtual ? "bg-gradient-to-br from-[#6d4cff] to-[#3f52c7]" : "bg-gradient-to-br from-[#1b78d1] to-[#19bfd3]"}`}><Icon name={isVirtual ? "monitor" : "location"} className="h-5 w-5"/></div><div><h2 className="text-sm font-black text-white">{data?.label}</h2><p className="text-[8px] font-semibold text-[#8ea6cc]">Resumen Del Mes Seleccionado</p></div></div>
        <span className={`rounded-full px-2.5 py-1 text-[8px] font-black ${isVirtual ? "bg-[#2c2458] text-[#b8a7ff]" : "bg-[#143764] text-[#6cbcff]"}`}>{data?.summary?.members || 0} Miembros</span>
      </div>
      <DatasetKpis data={data} comparison />
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#1d4178] bg-[#0c234b] p-3"><h3 className="mb-2 text-[10px] font-black text-white">Evolución De Asistencia</h3><WeeklyChart data={data} selectedWeek={selectedWeek} onWeek={onWeek} /></div>
        <div className="rounded-2xl border border-[#1d4178] bg-[#0c234b] p-3"><h3 className="mb-2 text-[10px] font-black text-white">Estado De Asistencia</h3><StatusDonut data={data}/></div>
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
  const weekLabel = selectedWeek ? ` · Semana ${selectedWeek}` : "";

  const comparisonSummary = useMemo(() => {
    const p = comparison.presential?.summary || {};
    const v = comparison.virtual?.summary || {};
    return { members: (p.members || 0) + (v.members || 0), bonus: (p.bonus || 0) + (v.bonus || 0) };
  }, [comparison]);

  const downloadDashboardPdf = useCallback(async () => {
    let exportArea = null;
    try {
      const source = document.querySelector("main");
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
      exportArea.style.background = "#050d20";
      exportArea.style.color = "#ffffff";
      exportArea.style.boxSizing = "border-box";
      exportArea.style.pointerEvents = "none";

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
        backgroundColor: "#050d20",
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
        context.fillStyle = "#050d20";
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
    }
  }, [mode, selectedCircle, month, year]);

  return (
    <section className="relative min-h-[calc(100vh-44px)] w-full overflow-hidden bg-[#050d20] px-2 py-2 sm:px-3 lg:px-4">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl animate-[floatOrb_8s_ease-in-out_infinite]"/>
      <div className="pointer-events-none absolute right-[-100px] top-[-70px] h-80 w-80 rounded-full bg-violet-500/10 blur-3xl animate-[floatOrb_10s_ease-in-out_infinite_reverse]"/>
      <div className="pointer-events-none absolute bottom-[-120px] left-1/3 h-72 w-72 rounded-full bg-cyan-400/5 blur-3xl animate-[floatOrb_12s_ease-in-out_infinite]"/>

      <div className="relative mx-auto flex w-full max-w-[1800px] flex-col gap-2 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 rounded-2xl border border-[#173968] bg-gradient-to-b from-[#0b2147]/98 via-[#091a38]/98 to-[#06132b]/98 p-3 shadow-[0_10px_30px_rgba(0,0,0,.24)] backdrop-blur-md lg:sticky lg:top-2 lg:w-[248px]">
          <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#2457c5] to-[#19bfd3] text-white shadow-[0_0_18px_rgba(36,126,232,.22)]"><Icon name="trend" className="h-4 w-4"/></div>
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#55c7ff]">Círculos Connect</p><h1 className="text-xl font-black leading-tight text-white">Dashboard</h1></div>
          </div>

          <div className="space-y-2">
            <div>
              <p className="mb-1 px-1 text-[8px] font-black uppercase tracking-[.14em] text-[#6cbcff]">Vista</p>
              <div className="grid grid-cols-2 rounded-xl border border-[#1b3d70] bg-[#071832] p-1">
                <button type="button" onClick={() => {setMode("comparison");setSelectedWeek(null);}} className={`rounded-lg px-2.5 py-2.5 text-[10px] font-black transition-all ${mode === "comparison" ? "bg-gradient-to-r from-[#1b78d1] to-[#2457c5] text-white shadow-[0_0_14px_rgba(36,126,232,.2)]" : "text-[#8ea6cc] hover:bg-white/5 hover:text-white"}`}>Comparativa</button>
                <button type="button" onClick={() => {setMode("circle");setSelectedWeek(null);}} className={`rounded-lg px-2.5 py-2.5 text-[10px] font-black transition-all ${mode === "circle" ? "bg-gradient-to-r from-[#1b78d1] to-[#2457c5] text-white shadow-[0_0_14px_rgba(36,126,232,.2)]" : "text-[#8ea6cc] hover:bg-white/5 hover:text-white"}`}>Por Círculo</button>
              </div>
            </div>

            {mode === "circle" && (
              <label className="block">
                <span className="mb-1 block px-1 text-[8px] font-black uppercase tracking-[.14em] text-[#6cbcff]">Círculo</span>
                <select value={selectedCircle} onChange={(e) => {setSelectedCircle(e.target.value);setSelectedWeek(null);}} disabled={loadingCircles} className="h-10 w-full rounded-xl border border-[#1b3d70] bg-[#102754] px-3 text-[11px] font-black text-white outline-none transition hover:border-[#3289df] focus:border-[#55c7ff]">
                  <option value="">Seleccionar Círculo</option>
                  {circles.map((circle) => <option key={circle._id || circle.name} value={circle.name}>{circle.name}</option>)}
                </select>
              </label>
            )}

            <div>
              <p className="mb-1 px-1 text-[8px] font-black uppercase tracking-[.14em] text-[#6cbcff]">Período</p>
              <div className="grid grid-cols-[32px_1fr_32px] gap-1">
                <button type="button" onClick={() => moveMonth(-1)} className="grid h-9 place-items-center rounded-xl border border-[#1b3d70] bg-[#102754] text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-[#3289df] hover:bg-[#1559b8]">‹</button>
                <div className="grid h-9 place-items-center rounded-xl border border-[#1b3d70] bg-[#102754] px-1 text-[9px] font-black text-white">{MONTHS[month-1]} {year}</div>
                <button type="button" onClick={() => moveMonth(1)} className="grid h-9 place-items-center rounded-xl border border-[#1b3d70] bg-[#102754] text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-[#3289df] hover:bg-[#1559b8]">›</button>
              </div>
            </div>

            <button type="button" onClick={() => load()} disabled={loading || (mode === "circle" && !selectedCircle)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#2b79cf]/50 bg-gradient-to-r from-[#1559b8] to-[#1b78d1] text-[9px] font-black text-white shadow-[0_8px_18px_rgba(21,89,184,.2)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50"><Icon name="refresh" className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}/>Actualizar</button>

            {selectedWeek && (
              <button type="button" onClick={clearWeek} className="w-full rounded-xl border border-[#2b79cf]/40 bg-[#102754] px-3 py-2.5 text-[9px] font-black text-[#7dccff] transition hover:border-[#55c7ff] hover:bg-[#163461]">Ver Todo El Mes</button>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={downloadDashboardPdf}
                data-dashboard-pdf-button
                className="group flex w-full items-center justify-center gap-2 rounded-xl border border-[#ef4444]/45 bg-gradient-to-r from-[#45152a] via-[#5b1930] to-[#3d162b] px-3 py-3 text-[9px] font-black text-[#ffd9e2] shadow-[0_8px_20px_rgba(225,29,72,.12)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#ff6687] hover:brightness-110 hover:shadow-[0_12px_26px_rgba(225,29,72,.22)] active:translate-y-0"
                title="Descargar Dashboard Como PDF"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#ff6687]/30 bg-[#7f1738]/55 text-[#ff9db5] transition-transform duration-300 group-hover:scale-105">
                  <Icon name="pdf" className="h-4 w-4" />
                </span>
                <span className="flex-1 text-left">Descargar Como PDF</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {error && <div className="mb-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-[9px] font-bold text-rose-200">{error}</div>}

          {loading && !dashboard ? (
            <div className="grid min-h-[620px] place-items-center rounded-2xl border border-[#173968] bg-[#091a38]/80 text-xs font-bold text-[#b8d4f7] animate-pulse">Cargando Dashboard...</div>
          ) : mode === "comparison" ? (
            <div className="space-y-2">
              <div className="rounded-2xl border border-[#173968] bg-gradient-to-r from-[#0b2044] via-[#0c234b] to-[#101b48] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,.2)]">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[7px] font-black uppercase tracking-[.16em] text-[#55c7ff]">Visión General</p><h2 className="text-sm font-black text-white">Presenciales Vs. Virtuales{selectedWeek ? ` · Semana ${selectedWeek}` : ""}</h2></div><div className="flex gap-1.5"><span className="rounded-lg border border-white/5 bg-[#102754] px-2 py-1.5 text-[8px] font-black text-[#b8d4f7]">{comparisonSummary.members} Miembros</span><span className="rounded-lg border border-white/5 bg-[#102754] px-2 py-1.5 text-[8px] font-black text-amber-200">{comparisonSummary.bonus} Bonos</span></div></div>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                <div className="min-w-0 rounded-3xl border border-[#174d82] bg-gradient-to-br from-[#0b294d] via-[#102b5c] to-[#0c394f] p-3.5 shadow-[0_12px_35px_rgba(15,23,42,0.18)] transition-all duration-500 hover:-translate-y-1 hover:border-[#2f9ee8] hover:shadow-[0_22px_45px_rgba(36,126,232,0.18)]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#1b78d1] to-[#19bfd3] text-white shadow-[0_0_20px_rgba(25,191,211,.22)]"><Icon name="location" className="h-5 w-5"/></div>
                      <div><p className="text-[7px] font-black uppercase tracking-[.16em] text-[#55c7ff]">Presenciales</p><h2 className="text-sm font-black text-white">Asistencias Presenciales</h2></div>
                    </div>
                    <span className="rounded-full bg-[#143764] px-2.5 py-1 text-[8px] font-black text-[#6cbcff]">{comparison.presential?.summary?.members || 0} Miembros</span>
                  </div>
                  <DatasetKpis data={comparison.presential}/>
                  <div className="mt-3 space-y-2">
                    <Section title="Evolución De Asistencia" subtitle="Selecciona Una Semana Para Comparar El Mismo Período."><WeeklyChart data={comparison.presential} selectedWeek={selectedWeek} onWeek={loadWeek}/></Section>
                    <Section title="Estado De Asistencia"><StatusDonut data={comparison.presential}/></Section>
                    <Section title="Asistencia Por Tipo De Sesión"><CategoryBars data={comparison.presential}/></Section>
                    <Section title="Tipo De Justificación" subtitle="Cantidad De Justificaciones Registradas Durante El Mes."><JustificationBars data={comparison.presential}/></Section>
                    <Section title="Reciben Bono"><MemberTable data={comparison.presential?.recipients} bonus/></Section>
                    <Section title="No Reciben Bono"><MemberTable data={comparison.presential?.nonRecipients}/></Section>
                  </div>
                </div>

                <div className="min-w-0 rounded-3xl border border-[#3c3472] bg-gradient-to-br from-[#181942] via-[#102b5c] to-[#151b4b] p-3.5 shadow-[0_12px_35px_rgba(15,23,42,0.18)] transition-all duration-500 hover:-translate-y-1 hover:border-[#7966e8] hover:shadow-[0_22px_45px_rgba(107,76,255,0.20)]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#6d4cff] to-[#3f52c7] text-white shadow-[0_0_20px_rgba(109,76,255,.24)]"><Icon name="monitor" className="h-5 w-5"/></div>
                      <div><p className="text-[7px] font-black uppercase tracking-[.16em] text-[#b8a7ff]">Virtuales</p><h2 className="text-sm font-black text-white">Asistencias Virtuales</h2></div>
                    </div>
                    <span className="rounded-full bg-[#2c2458] px-2.5 py-1 text-[8px] font-black text-[#b8a7ff]">{comparison.virtual?.summary?.members || 0} Miembros</span>
                  </div>
                  <DatasetKpis data={comparison.virtual}/>
                  <div className="mt-3 space-y-2">
                    <Section title="Evolución De Asistencia" subtitle="Selecciona Una Semana Para Comparar El Mismo Período."><WeeklyChart data={comparison.virtual} selectedWeek={selectedWeek} onWeek={loadWeek}/></Section>
                    <Section title="Estado De Asistencia"><StatusDonut data={comparison.virtual}/></Section>
                    <Section title="Asistencia Por Tipo De Sesión"><CategoryBars data={comparison.virtual}/></Section>
                    <Section title="Tipo De Justificación" subtitle="Cantidad De Justificaciones Registradas Durante El Mes."><JustificationBars data={comparison.virtual}/></Section>
                    <Section title="Reciben Bono"><MemberTable data={comparison.virtual?.recipients} bonus/></Section>
                    <Section title="No Reciben Bono"><MemberTable data={comparison.virtual?.nonRecipients}/></Section>
                  </div>
                </div>
              </div>
            </div>
          ) : currentDataset ? (
            <div className="space-y-2">
              <div className="rounded-2xl border border-[#173968] bg-gradient-to-r from-[#0b2044] via-[#0c234b] to-[#101b48] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,.2)]"><p className="text-[7px] font-black uppercase tracking-[.16em] text-[#55c7ff]">Dashboard Del Círculo</p><h2 className="text-sm font-black text-white">{selectedCircle}{weekLabel}</h2><p className="text-[8px] text-[#8ea6cc]">Métricas Del Mes Seleccionado{selectedWeek ? ` · ${currentDataset.weekly?.find(w=>w.week===selectedWeek)?.label || `Semana ${selectedWeek}`}` : ""}.</p></div>
              <DatasetKpis data={currentDataset}/>
              <div className="grid gap-2 xl:grid-cols-[1.25fr_.9fr]"><Section title="Evolución De Asistencia" subtitle="Selecciona Una Semana Para Filtrar Todo El Dashboard."><WeeklyChart data={currentDataset} selectedWeek={selectedWeek} onWeek={loadWeek}/></Section><Section title="Estado De Asistencia" subtitle={selectedWeek ? `Solo ${currentDataset.weekly?.find(w=>w.week===selectedWeek)?.label || `Semana ${selectedWeek}`}.` : "Todo El Mes Seleccionado."}><StatusDonut data={currentDataset}/></Section></div>
              <div className="grid gap-2 xl:grid-cols-2"><Section title="Asistencia Por Tipo De Sesión" subtitle="Porcentaje De Asistencia Válida En Cada Tipo De Sesión."><CategoryBars data={currentDataset}/></Section><Section title="Tipo De Justificación" subtitle="Cantidad De Cada Tipo Registrado En El Período."><JustificationBars data={currentDataset}/></Section></div>
              <div className="grid gap-2 xl:grid-cols-2"><Section title="Reciben Bono" subtitle="Miembros Con Asistencia Válida." className="hover:border-emerald-300/50"><MemberTable data={currentDataset.recipients} bonus/></Section><Section title="No Reciben Bono" subtitle="Miembros Que No Cumplen El Requisito Y Sus Faltas." className="hover:border-rose-300/50"><MemberTable data={currentDataset.nonRecipients}/></Section></div>
            </div>
          ) : <div className="grid min-h-[400px] place-items-center rounded-2xl border border-[#173968] bg-[#091a38]/80 text-xs font-bold text-[#b8d4f7]">Selecciona Un Círculo.</div>}
        </main>
      </div>
      <style>{`@keyframes neonPulse{0%,100%{opacity:.75;filter:brightness(1)}50%{opacity:1;filter:brightness(1.18)}}@keyframes drawLine{from{stroke-dashoffset:1000}to{stroke-dashoffset:0}}@keyframes growBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes floatOrb{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(18px,-12px,0) scale(1.08)}}@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}`}</style>
    </section>
  );
};

export default Dashboard;
