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
  "CIRCULO DE LIDERAZGO": "from-[#2457c5] to-[#4CC8FF]",
  HEALTH: "from-[#19d7d0] to-[#268dff]",
  MENTORIA: "from-[#9b5cff] to-[#4CC8FF]",
  MASTERCLASS: "from-[#38c9ff] to-[#2457c5]",
  "ANUNCIOS CORPORATIVOS": "from-[#ff4d78] to-[#b83cff]",
  ORDINARIA: "from-[#ffc338] to-[#ff8a24]",
}[category] || "from-[#2457c5] to-[#4CC8FF]");

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
  <section className={`group relative overflow-hidden rounded-2xl border border-[rgba(82,146,230,0.28)] bg-gradient-to-br from-[#0A1329] via-[#081126] to-[#020A1B] p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-[#4CC8FF]/50 hover:shadow-[0_18px_42px_rgba(76,200,255,0.15)] ${className}`}>
    <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#4CC8FF]/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    <div className="relative mb-3">
      <h2 className="text-[15px] font-extrabold tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[9px] text-[#AAB9DA]">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const KpiCard = ({ icon, label, value, color, iconColor, accent, glow = "shadow-[0_0_22px_rgba(76,200,255,.16)]", suffix = "%", decimals = 1, helper }) => (
  <div className="group relative overflow-hidden rounded-2xl border border-[rgba(82,146,230,0.28)] bg-gradient-to-br from-[#0A1329] via-[#081126] to-[#020A1B] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.38)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#4CC8FF]/60 hover:shadow-[0_0_28px_rgba(76,200,255,0.2)]">
    <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${color} opacity-95 transition-all duration-300 group-hover:h-[3px]`} />
    <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full ${accent} opacity-20 blur-2xl transition-all duration-500 group-hover:opacity-35 group-hover:scale-125`} />
    <div className="relative flex items-center justify-between gap-2">
      <div className={`grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-[#020A1B]/95 ${iconColor} ${glow} shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
        <Icon name={icon} className="h-4 w-4" />
      </div>
      <span className="rounded-full border border-white/5 bg-[#020A1B]/80 px-2 py-1 text-[7px] font-black tracking-[.08em] text-[#AAB9DA]">
        {helper}
      </span>
    </div>
    <p className="relative mt-2 text-[8px] font-black uppercase tracking-[0.13em] text-[#AAB9DA]">{label}</p>
    <p className="relative mt-0.5 text-[27px] font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.08)]">
      <AnimatedNumber value={value} suffix={suffix} decimals={decimals} />
    </p>
    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#020A1B]">
      <div className={`h-full rounded-full bg-gradient-to-r ${color} opacity-90 transition-all duration-700 group-hover:brightness-125`} style={{ width: `${clamp(value)}%` }} />
    </div>
  </div>
);

const DatasetKpis = ({ data }) => {
  const summary = data?.summary || {};
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      <div className="group relative overflow-hidden rounded-2xl border border-[rgba(82,146,230,0.28)] bg-gradient-to-br from-[#0A1329] via-[#081126] to-[#020A1B] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.38)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#4CC8FF]/60 hover:shadow-[0_0_28px_rgba(76,200,255,0.2)]">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#2457c5] to-[#4CC8FF] transition-all duration-300 group-hover:h-[3px]" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[#4CC8FF] opacity-10 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-20" />
        <div className="relative flex items-center justify-between">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-[#4CC8FF]/40 bg-[#020A1B]/95 text-[#4CC8FF] shadow-[0_0_18px_rgba(76,200,255,0.15)] transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
            <Icon name="users" className="h-4 w-4" />
          </div>
          <span className="text-[7px] font-black tracking-wide text-[#4CC8FF]">MIEMBROS</span>
        </div>
        <p className="relative mt-2 text-[8px] font-black uppercase tracking-[0.13em] text-[#AAB9DA]">Total Registrado</p>
        <p className="relative mt-0.5 text-[27px] font-black tracking-tight text-white"><AnimatedNumber value={summary.members} suffix="" decimals={0}/></p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#020A1B]"><div className="h-full w-full rounded-full bg-gradient-to-r from-[#2457c5] to-[#4CC8FF] opacity-90" /></div>
      </div>
      <KpiCard icon="check" label="Asistencia" value={summary.attendanceRate} color="from-[#19d7d0] to-[#268dff]" iconColor="text-[#39d8a1]" accent="bg-[#19d7d0]" helper="DEL PERÍODO" glow="shadow-[0_0_22px_rgba(25,215,208,.28)]" />
      <KpiCard icon="x" label="Faltas" value={summary.absenceRate} color="from-[#ff4d78] to-[#b83cff]" iconColor="text-[#ff718d]" accent="bg-[#ff4d78]" helper="DEL PERÍODO" glow="shadow-[0_0_22px_rgba(255,77,120,.28)]" />
      <KpiCard icon="shield" label="Justificados" value={summary.justifiedRate} color="from-[#ffc338] to-[#ff8a24]" iconColor="text-[#ffc86b]" accent="bg-[#ffc338]" helper="DEL PERÍODO" glow="shadow-[0_0_22px_rgba(255,195,56,.24)]" />
      <KpiCard icon="trend" label="Promedio Por Sesión" value={summary.averageSessionAttendance} color="from-[#4CC8FF] to-[#2457c5]" iconColor="text-[#4CC8FF]" accent="bg-[#4CC8FF]" helper="PROMEDIO" glow="shadow-[0_0_22px_rgba(76,200,255,.26)]" />
      <KpiCard icon="gift" label="Bonos" value={summary.bonus} color="from-[#9b5cff] to-[#4CC8FF]" iconColor="text-[#a984ff]" accent="bg-[#9b5cff]" suffix="" decimals={0} helper="RECIBIDOS" glow="shadow-[0_0_22px_rgba(155,92,255,.28)]" />
    </div>
  );
};

const StatusDonut = ({ data }) => {
  const status = data?.status || { attended: 0, absent: 0, justified: 0 };
  const total = status.attended + status.absent + status.justified;
  const a = total ? status.attended / total * 360 : 0;
  const f = total ? status.absent / total * 360 : 0;
  const j = total ? status.justified / total * 360 : 0;
  const style = { background: `conic-gradient(#39d8a1 0deg ${a}deg,#ff718d ${a}deg ${a + f}deg,#ffc86b ${a + f}deg ${a + f + j}deg,#020A1B ${a + f + j}deg 360deg)`, filter: "drop-shadow(0 0 10px rgba(76,200,255,.35)) drop-shadow(0 0 24px rgba(76,200,255,.15))" };
  return (
    <div className="flex h-[205px] items-center justify-center gap-6">
      <div className="relative grid h-40 w-40 shrink-0 place-items-center rounded-full p-3 shadow-[inset_0_0_18px_rgba(0,0,0,.65)] transition-transform duration-500 hover:rotate-3 hover:scale-105" style={style}>
        <div className="grid h-full w-full place-items-center rounded-full bg-[#080F24] shadow-sm">
          <div className="text-center"><p className="text-[9px] font-semibold text-[#AAB9DA]">Registros</p><strong className="text-3xl font-black text-white"><AnimatedNumber value={total} suffix="" decimals={0}/></strong><p className="text-[8px] text-[#AAB9DA]">Del Período</p></div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {[["Asistió",status.attended,"bg-[#39d8a1]","text-[#39d8a1]"],["Faltó",status.absent,"bg-[#ff718d]","text-[#ff718d]"],["Justificado",status.justified,"bg-[#ffc86b]","text-[#ffc86b]"]].map(([label,value,dot,text]) => (
          <div key={label} className="flex items-center justify-between border-b border-[rgba(82,146,230,0.2)] pb-2 transition-all duration-200 hover:translate-x-1">
            <span className="flex items-center gap-2 text-xs font-bold text-[#AAB9DA]"><span className={`h-2.5 w-2.5 rounded-full ${dot}`}/>{label}</span>
            <span className={`font-black ${text}`}>{value} <small className="ml-1 font-bold text-[#AAB9DA]">{total ? pct(value / total * 100) : "0.0%"}</small></span>
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
    <div className="relative h-[225px] w-full overflow-hidden rounded-xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] p-2 transition-all duration-300 group-hover:bg-[#06122b]">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
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

const CategoryBars = ({ data }) => (
  <div className="space-y-3">
    {(data?.categories || []).length === 0 && <p className="py-10 text-center text-xs text-[#AAB9DA]">No Hay Sesiones En El Período.</p>}
    {(data?.categories || []).map((item, index) => (
      <div key={item.type} className="group/bar rounded-xl border border-[rgba(82,146,230,0.2)] bg-[#020A1B] p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#4CC8FF]/60 hover:bg-[#06122b]">
        <div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-[9px] font-bold text-white">{formatCategory(item.type)}</span><span className="text-[10px] font-black text-[#4CC8FF] drop-shadow-[0_0_6px_rgba(76,200,255,.35)]">{pct(item.rate)}</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#080F24] shadow-[inset_0_0_8px_rgba(0,0,0,.5)]"><div className={`h-full origin-left rounded-full bg-gradient-to-r ${categoryColor(item.type)} animate-[growBar_.9s_cubic-bezier(.2,.8,.2,1)_forwards] transition-all duration-300 group-hover/bar:brightness-125`} style={{ width: `${clamp(item.rate)}%`, animationDelay: `${index*90}ms`, boxShadow: "0 0 8px rgba(76,200,255,.55)" }}/></div>
        <p className="mt-1 text-[7px] font-semibold text-[#AAB9DA]">{item.sessions} {item.sessions === 1 ? "Sesión" : "Sesiones"} · {item.attended + item.justified} Asistencias Válidas</p>
      </div>
    ))}
  </div>
);

const JustificationBars = ({ data }) => {
  const source = data?.justificationTypes || [];
  const order = ["Trabajo", "Salud", "Viaje Programado", "Conexión Inestable"];

  const colorByType = {
    "Trabajo": {
      border: "border-[#4CC8FF]/45",
      hoverBorder: "hover:border-[#4CC8FF]",
      background: "bg-[#020A1B]",
      hoverBackground: "hover:bg-[#06122b]",
      badge: "border-[#4CC8FF]/40 bg-[#4CC8FF]/10 text-[#4CC8FF]",
      track: "bg-[#080F24]",
      bar: "bg-gradient-to-r from-[#2457c5] to-[#4CC8FF]",
      glow: "0 0 7px rgba(76,200,255,.85), 0 0 18px rgba(76,200,255,.35)",
    },
    "Salud": {
      border: "border-[#ff3b68]/45",
      hoverBorder: "hover:border-[#ff6f91]",
      background: "bg-[#020A1B]",
      hoverBackground: "hover:bg-[#06122b]",
      badge: "border-[#ff3b68]/40 bg-[#ff3b68]/10 text-[#ff7f9d]",
      track: "bg-[#080F24]",
      bar: "bg-gradient-to-r from-[#b91c3c] via-[#ff2f63] to-[#ff7a96]",
      glow: "0 0 7px rgba(255,59,104,.85)",
    },
    "Viaje Programado": {
      border: "border-[#b86cff]/45",
      hoverBorder: "hover:border-[#db9cff]",
      background: "bg-[#020A1B]",
      hoverBackground: "hover:bg-[#06122b]",
      badge: "border-[#b86cff]/40 bg-[#b86cff]/10 text-[#d7a5ff]",
      track: "bg-[#080F24]",
      bar: "bg-gradient-to-r from-[#7c3aed] via-[#b64cff] to-[#ec8cff]",
      glow: "0 0 7px rgba(184,108,255,.85)",
    },
    "Conexión Inestable": {
      border: "border-[#16e0d2]/45",
      hoverBorder: "hover:border-[#65fff5]",
      background: "bg-[#020A1B]",
      hoverBackground: "hover:bg-[#06122b]",
      badge: "border-[#16e0d2]/40 bg-[#16e0d2]/10 text-[#72fff6]",
      track: "bg-[#080F24]",
      bar: "bg-gradient-to-r from-[#0891b2] via-[#14d9cf] to-[#75fff5]",
      glow: "0 0 7px rgba(22,224,210,.85)",
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
        <p className="py-10 text-center text-xs text-[#AAB9DA]">No Hay Justificaciones Registradas.</p>
      ) : (
        items.map((item, index) => {
          const palette = colorByType[item.type] || {
            border: "border-[rgba(82,146,230,0.28)]",
            hoverBorder: "hover:border-[#4CC8FF]",
            background: "bg-[#020A1B]",
            hoverBackground: "hover:bg-[#06122b]",
            badge: "border-[#4CC8FF]/40 bg-[#4CC8FF]/10 text-[#4CC8FF]",
            track: "bg-[#080F24]",
            bar: "bg-gradient-to-r from-[#2457c5] to-[#4CC8FF]",
            glow: "0 0 7px rgba(76,200,255,.8)",
          };

          return (
            <div
              key={item.type}
              className={`group/just rounded-xl border ${palette.border} ${palette.background} p-2 transition-all duration-200 hover:-translate-y-0.5 ${palette.hoverBorder} ${palette.hoverBackground}`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-[9px] font-bold text-white">{item.type}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${palette.badge}`}>
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
  <div className="overflow-hidden rounded-xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B]">
    <div className={`grid ${bonus ? "grid-cols-[1.5fr_.65fr_.55fr_.65fr]" : "grid-cols-[1.5fr_.55fr_.55fr_.7fr]"} bg-[#0A1329] px-3 py-2 text-[7px] font-black uppercase tracking-wide text-[#AAB9DA]`}>
      <span>Nombre</span><span>{bonus ? "Asistencia" : "Asistencia"}</span><span>Faltas</span><span>{bonus ? "Bono" : "Estado"}</span>
    </div>
    <div className="max-h-[225px] overflow-auto">
      {(data || []).length === 0 ? <p className="px-3 py-9 text-center text-xs text-[#AAB9DA]">No Hay Miembros En Esta Categoría.</p> : (data || []).map((member, index) => (
        <div key={member.id || member.doc || member.name} className={`grid ${bonus ? "grid-cols-[1.5fr_.65fr_.55fr_.65fr]" : "grid-cols-[1.5fr_.55fr_.55fr_.7fr]"} items-center border-t border-[rgba(82,146,230,0.18)] px-3 py-2 text-[8px] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0A1329]`} style={{animationDelay:`${index*30}ms`}}>
          <span className="truncate font-bold text-white" title={member.name}>{member.name}</span>
          <span><b className={`rounded-full px-2 py-1 ${member.pct >= 90 ? "bg-[#0b3c36] text-[#39d8a1]" : member.pct >= 70 ? "bg-[#493315] text-[#ffc86b]" : "bg-[#4a1830] text-[#ff718d]"}`}>{pct(member.pct)}</b></span>
          <span className="font-black text-[#ff718d]">{member.absent}</span>
          {bonus ? <span className="font-black text-[#39d8a1]">✓ Bono</span> : <span className="font-semibold text-[#AAB9DA]">{member.pct >= 70 ? "Cumple" : "No Cumple"}</span>}
        </div>
      ))}
    </div>
  </div>
);

const ComparisonPanel = ({ data, tone, selectedWeek, onWeek }) => {
  const isVirtual = tone === "virtual";
  return (
    <div className={`rounded-3xl border p-4 shadow-[0_12px_35px_rgba(0,0,0,0.35)] transition-all duration-500 hover:-translate-y-1 ${isVirtual ? "border-[#b86cff]/35 bg-gradient-to-br from-[#0A1329] via-[#081126] to-[#020A1B] hover:border-[#b86cff]" : "border-[rgba(82,146,230,0.28)] bg-gradient-to-br from-[#0A1329] via-[#081126] to-[#020A1B] hover:border-[#4CC8FF]"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2"><div className={`grid h-10 w-10 place-items-center rounded-2xl text-white shadow-lg ${isVirtual ? "bg-gradient-to-br from-[#9b5cff] to-[#2457c5]" : "bg-gradient-to-br from-[#2457c5] to-[#4CC8FF]"}`}><Icon name={isVirtual ? "monitor" : "location"} className="h-5 w-5"/></div><div><h2 className="text-sm font-black text-white">{data?.label}</h2><p className="text-[8px] font-semibold text-[#AAB9DA]">Resumen Del Mes Seleccionado</p></div></div>
        <span className={`rounded-full px-2.5 py-1 text-[8px] font-black ${isVirtual ? "bg-[#020A1B] text-[#a984ff]" : "bg-[#020A1B] text-[#4CC8FF]"}`}>{data?.summary?.members || 0} Miembros</span>
      </div>
      <DatasetKpis data={data} comparison />
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] p-3"><h3 className="mb-2 text-[10px] font-black text-white">Evolución De Asistencia</h3><WeeklyChart data={data} selectedWeek={selectedWeek} onWeek={onWeek} /></div>
        <div className="rounded-2xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] p-3"><h3 className="mb-2 text-[10px] font-black text-white">Estado De Asistencia</h3><StatusDonut data={data}/></div>
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
      exportArea.style.background = "#080F24";
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
    }
  }, [mode, selectedCircle, month, year]);

  return (
    <section className="relative min-h-[calc(100vh-44px)] w-full overflow-hidden bg-[#080F24] px-2 py-2 sm:px-3 lg:px-4 text-white">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#2457c5]/15 blur-3xl animate-[floatOrb_8s_ease-in-out_infinite]"/>
      <div className="pointer-events-none absolute right-[-100px] top-[-70px] h-80 w-80 rounded-full bg-[#4CC8FF]/10 blur-3xl animate-[floatOrb_10s_ease-in-out_infinite_reverse]"/>
      <div className="pointer-events-none absolute bottom-[-120px] left-1/3 h-72 w-72 rounded-full bg-[#4CC8FF]/5 blur-3xl animate-[floatOrb_12s_ease-in-out_infinite]"/>

      <div className="relative mx-auto flex w-full max-w-[1800px] flex-col gap-2 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 rounded-2xl border border-[rgba(82,146,230,0.28)] bg-[#0A1329] p-3 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur-md lg:sticky lg:top-2 lg:w-[248px]">
          <div className="mb-2 flex items-center gap-2 border-b border-[rgba(82,146,230,0.2)] pb-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#2457c5] to-[#4CC8FF] text-white shadow-[0_0_18px_rgba(76,200,255,.22)]"><Icon name="trend" className="h-4 w-4"/></div>
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#4CC8FF]">Círculos Connect</p><h1 className="text-xl font-black leading-tight text-white">Dashboard</h1></div>
          </div>

          <div className="space-y-2">
            <div>
              <p className="mb-1 px-1 text-[8px] font-black uppercase tracking-[.14em] text-[#4CC8FF]">Vista</p>
              <div className="grid grid-cols-2 rounded-xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] p-1">
                <button type="button" onClick={() => {setMode("comparison");setSelectedWeek(null);}} className={`rounded-lg px-2.5 py-2.5 text-[10px] font-black transition-all ${mode === "comparison" ? "bg-gradient-to-r from-[#2457c5] to-[#4CC8FF] text-white shadow-[0_0_14px_rgba(76,200,255,.25)]" : "text-[#AAB9DA] hover:bg-white/5 hover:text-white"}`}>Comparativa</button>
                <button type="button" onClick={() => {setMode("circle");setSelectedWeek(null);}} className={`rounded-lg px-2.5 py-2.5 text-[10px] font-black transition-all ${mode === "circle" ? "bg-gradient-to-r from-[#2457c5] to-[#4CC8FF] text-white shadow-[0_0_14px_rgba(76,200,255,.25)]" : "text-[#AAB9DA] hover:bg-white/5 hover:text-white"}`}>Por Círculo</button>
              </div>
            </div>

            {mode === "circle" && (
              <label className="block">
                <span className="mb-1 block px-1 text-[8px] font-black uppercase tracking-[.14em] text-[#4CC8FF]">Círculo</span>
                <select value={selectedCircle} onChange={(e) => {setSelectedCircle(e.target.value);setSelectedWeek(null);}} disabled={loadingCircles} className="h-10 w-full rounded-xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] px-3 text-[11px] font-black text-white outline-none transition hover:border-[#4CC8FF] focus:border-[#4CC8FF]">
                  <option value="">Seleccionar Círculo</option>
                  {circles.map((circle) => <option key={circle._id || circle.name} value={circle.name}>{circle.name}</option>)}
                </select>
              </label>
            )}

            <div>
              <p className="mb-1 px-1 text-[8px] font-black uppercase tracking-[.14em] text-[#4CC8FF]">Período</p>
              <div className="grid grid-cols-[32px_1fr_32px] gap-1">
                <button type="button" onClick={() => moveMonth(-1)} className="grid h-9 place-items-center rounded-xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-[#4CC8FF] hover:bg-[#06122b]">‹</button>
                <div className="grid h-9 place-items-center rounded-xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] px-1 text-[9px] font-black text-white">{MONTHS[month-1]} {year}</div>
                <button type="button" onClick={() => moveMonth(1)} className="grid h-9 place-items-center rounded-xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-[#4CC8FF] hover:bg-[#06122b]">›</button>
              </div>
            </div>

            <button type="button" onClick={() => load()} disabled={loading || (mode === "circle" && !selectedCircle)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#4CC8FF]/40 bg-gradient-to-r from-[#2457c5] to-[#4CC8FF] text-[9px] font-black text-white shadow-[0_8px_18px_rgba(76,200,255,.2)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50"><Icon name="refresh" className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}/>Actualizar</button>

            {selectedWeek && (
              <button type="button" onClick={clearWeek} className="w-full rounded-xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] px-3 py-2.5 text-[9px] font-black text-[#4CC8FF] transition hover:border-[#4CC8FF] hover:bg-[#06122b]">Ver Todo El Mes</button>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={downloadDashboardPdf}
                data-dashboard-pdf-button
                className="group flex w-full items-center justify-center gap-2 rounded-xl border border-[#ff4d78]/45 bg-gradient-to-r from-[#45152a] via-[#5b1930] to-[#3d162b] px-3 py-3 text-[9px] font-black text-[#ffd9e2] shadow-[0_8px_20px_rgba(255,77,120,.12)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#ff718d] hover:brightness-110 hover:shadow-[0_12px_26px_rgba(255,77,120,.22)] active:translate-y-0"
                title="Descargar Dashboard Como PDF"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#ff718d]/30 bg-[#7f1738]/55 text-[#ff718d] transition-transform duration-300 group-hover:scale-105">
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
            <div className="grid min-h-[620px] place-items-center rounded-2xl border border-[rgba(82,146,230,0.28)] bg-[#0A1329] text-xs font-bold text-[#AAB9DA] animate-pulse">Cargando Dashboard...</div>
          ) : mode === "comparison" ? (
            <div className="space-y-2">
              <div className="rounded-2xl border border-[rgba(82,146,230,0.28)] bg-[#0A1329] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[7px] font-black uppercase tracking-[.16em] text-[#4CC8FF]">Visión General</p><h2 className="text-sm font-black text-white">Presenciales Vs. Virtuales{selectedWeek ? ` · Semana ${selectedWeek}` : ""}</h2></div><div className="flex gap-1.5"><span className="rounded-lg border border-white/5 bg-[#020A1B] px-2 py-1.5 text-[8px] font-black text-[#AAB9DA]">{comparisonSummary.members} Miembros</span><span className="rounded-lg border border-white/5 bg-[#020A1B] px-2 py-1.5 text-[8px] font-black text-[#ffc86b]">{comparisonSummary.bonus} Bonos</span></div></div>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                <div className="min-w-0 rounded-3xl border border-[rgba(82,146,230,0.28)] bg-gradient-to-br from-[#0A1329] via-[#081126] to-[#020A1B] p-3.5 shadow-[0_12px_35px_rgba(0,0,0,0.35)] transition-all duration-500 hover:-translate-y-1 hover:border-[#4CC8FF]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#2457c5] to-[#4CC8FF] text-white shadow-[0_0_20px_rgba(76,200,255,.22)]"><Icon name="location" className="h-5 w-5"/></div>
                      <div><p className="text-[7px] font-black uppercase tracking-[.16em] text-[#4CC8FF]">Presenciales</p><h2 className="text-sm font-black text-white">Asistencias Presenciales</h2></div>
                    </div>
                    <span className="rounded-full bg-[#020A1B] px-2.5 py-1 text-[8px] font-black text-[#4CC8FF]">{comparison.presential?.summary?.members || 0} Miembros</span>
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

                <div className="min-w-0 rounded-3xl border border-[#b86cff]/35 bg-gradient-to-br from-[#0A1329] via-[#081126] to-[#020A1B] p-3.5 shadow-[0_12px_35px_rgba(0,0,0,0.35)] transition-all duration-500 hover:-translate-y-1 hover:border-[#b86cff]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#9b5cff] to-[#2457c5] text-white shadow-[0_0_20px_rgba(155,92,255,.24)]"><Icon name="monitor" className="h-5 w-5"/></div>
                      <div><p className="text-[7px] font-black uppercase tracking-[.16em] text-[#a984ff]">Virtuales</p><h2 className="text-sm font-black text-white">Asistencias Virtuales</h2></div>
                    </div>
                    <span className="rounded-full bg-[#020A1B] px-2.5 py-1 text-[8px] font-black text-[#a984ff]">{comparison.virtual?.summary?.members || 0} Miembros</span>
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
              <div className="rounded-2xl border border-[rgba(82,146,230,0.28)] bg-[#0A1329] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,.35)]"><p className="text-[7px] font-black uppercase tracking-[.16em] text-[#4CC8FF]">Dashboard Del Círculo</p><h2 className="text-sm font-black text-white">{selectedCircle}{weekLabel}</h2><p className="text-[8px] text-[#AAB9DA]">Métricas Del Mes Seleccionado{selectedWeek ? ` · ${currentDataset.weekly?.find(w=>w.week===selectedWeek)?.label || `Semana ${selectedWeek}`}` : ""}.</p></div>
              <DatasetKpis data={currentDataset}/>
              <div className="grid gap-2 xl:grid-cols-[1.25fr_.9fr]"><Section title="Evolución De Asistencia" subtitle="Selecciona Una Semana Para Filtrar Todo El Dashboard."><WeeklyChart data={currentDataset} selectedWeek={selectedWeek} onWeek={loadWeek}/></Section><Section title="Estado De Asistencia" subtitle={selectedWeek ? `Solo ${currentDataset.weekly?.find(w=>w.week===selectedWeek)?.label || `Semana ${selectedWeek}`}.` : "Todo El Mes Seleccionado."}><StatusDonut data={currentDataset}/></Section></div>
              <div className="grid gap-2 xl:grid-cols-2"><Section title="Asistencia Por Tipo De Sesión" subtitle="Porcentaje De Asistencia Válida En Cada Tipo De Sesión."><CategoryBars data={currentDataset}/></Section><Section title="Tipo De Justificación" subtitle="Cantidad De Cada Tipo Registrado En El Período."><JustificationBars data={currentDataset}/></Section></div>
              <div className="grid gap-2 xl:grid-cols-2"><Section title="Reciben Bono" subtitle="Miembros Con Asistencia Válida." className="hover:border-emerald-300/50"><MemberTable data={currentDataset.recipients} bonus/></Section><Section title="No Reciben Bono" subtitle="Miembros Que No Cumplen El Requisito Y Sus Faltas." className="hover:border-rose-300/50"><MemberTable data={currentDataset.nonRecipients}/></Section></div>
            </div>
          ) : <div className="grid min-h-[400px] place-items-center rounded-2xl border border-[rgba(82,146,230,0.28)] bg-[#0A1329] text-xs font-bold text-[#AAB9DA]">Selecciona Un Círculo.</div>}
        </main>
      </div>
      <style>{`@keyframes neonPulse{0%,100%{opacity:.75;filter:brightness(1)}50%{opacity:1;filter:brightness(1.18)}}@keyframes drawLine{from{stroke-dashoffset:1000}to{stroke-dashoffset:0}}@keyframes growBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes floatOrb{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(18px,-12px,0) scale(1.08)}}@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}`}</style>
    </section>
  );
};

export default Dashboard;