import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(form.email, form.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "No Se Pudo Iniciar Sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#080F24] px-3 py-4 font-sans text-white sm:px-5 sm:py-5 lg:px-6 lg:py-6">
      {/* Luces de fondo ambientales */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 animate-pulse rounded-full bg-[#2457c5]/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[32rem] w-[32rem] animate-pulse rounded-full bg-[#4CC8FF]/15 blur-3xl [animation-delay:1s]" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-[#4CC8FF]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1120px] items-center justify-center">
        <section className="login-shell grid w-full overflow-hidden rounded-[24px] border border-[rgba(82,146,230,0.28)] bg-[#0A1329] shadow-2xl shadow-black/80 lg:grid-cols-[1fr_0.92fr]">
          
          {/* PANEL IZQUIERDO (Branding & Features) */}
          <div className="relative hidden min-h-0 overflow-hidden border-r border-[rgba(82,146,230,0.2)] bg-gradient-to-br from-[#020A1B] via-[#0A1329] to-[#080F24] p-7 text-white lg:flex lg:flex-col xl:p-9">
            <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-[#4CC8FF]/10 bg-[#4CC8FF]/5" />
            <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full border border-[rgba(82,146,230,0.15)] bg-[#2457c5]/10" />
            <div className="absolute right-20 top-24 h-3 w-3 animate-ping rounded-full bg-[#4CC8FF]" />
            <div className="absolute bottom-28 right-28 h-2 w-2 animate-pulse rounded-full bg-white/70" />

            <div className="relative z-10 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(82,146,230,0.3)] bg-[#020A1B] shadow-xl shadow-black/50 transition-transform duration-500 hover:rotate-6 hover:scale-105">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#4CC8FF]" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="5" width="14" height="14" rx="3" />
                  <path d="M9 12h6M12 9v6" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-white">Sistema De Gestión</h1>
                <p className="text-sm font-semibold text-[#4CC8FF]">Círculos Y Asistencia</p>
              </div>
            </div>

            <div className="relative z-10 mt-9 max-w-xl xl:mt-11">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#4CC8FF]/30 bg-[#4CC8FF]/10 px-3 py-1.5 text-[11px] font-bold text-[#4CC8FF] backdrop-blur-md">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#4CC8FF] shadow-[0_0_8px_#4CC8FF]" />
                Plataforma Administrativa
              </div>

              <h2 className="text-4xl font-black leading-[1.05] tracking-[-0.04em] xl:text-[40px]">
                Todo El Control De Tus Círculos,
                <span className="mt-2 block bg-gradient-to-r from-[#4CC8FF] via-sky-200 to-white bg-clip-text text-transparent">
                  En Un Solo Lugar.
                </span>
              </h2>

              <p className="mt-4 max-w-md text-sm leading-5 text-[#AAB9DA] xl:text-[15px]">
                Reuniones, Asistencia, Miembros Y Reportes En Un Solo Espacio.
              </p>
            </div>

            <div className="relative z-10 mt-auto grid grid-cols-2 gap-3 pt-6">
              <FeatureCard title="Reportes" text="Información Para Una Mejor Gestión." icon="chart" />
              <FeatureCard title="Asistencia" text="Seguimiento Rápido Y Centralizado." icon="users" />
              <FeatureCard title="Seguridad" text="Acceso Controlado Por Rol." icon="shield" />
              <FeatureCard title="Gestión" text="Todo En Un Mismo Espacio." icon="panel" />
            </div>
          </div>

          {/* PANEL DERECHO (Formulario de Acceso) */}
          <div className="relative flex min-h-0 items-center overflow-hidden bg-[#0A1329] px-6 py-8 sm:px-9 lg:px-10 xl:px-12">
            <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-[#2457c5]/10 blur-2xl" />
            <div className="absolute -bottom-40 -left-36 h-96 w-96 rounded-full bg-[#020A1B]" />
            <div className="absolute right-16 top-20 h-2 w-2 animate-bounce rounded-full bg-[#4CC8FF] [animation-delay:400ms]" />

            <div className="relative z-10 mx-auto w-full max-w-[400px]">
              <div className="mb-7 animate-[fadeIn_.7s_ease-out]">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgba(82,146,230,0.3)] bg-[#020A1B] px-3 py-1.5 text-[11px] font-bold text-[#4CC8FF]">
                  <span className="h-2 w-2 rounded-full bg-[#4CC8FF] shadow-[0_0_8px_rgba(76,200,255,0.8)]" />
                  Acceso Administrativo
                </div>

                <h2 className="text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Bienvenido</h2>
                <p className="mt-2 text-sm leading-5 text-[#AAB9DA]">Ingresa Tus Credenciales Para Acceder Al Sistema.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="group">
                  <label htmlFor="email" className="mb-1.5 block text-xs font-bold sm:text-sm text-[#AAB9DA]">Correo Electrónico</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-[#AAB9DA] transition-colors duration-200 group-focus-within:text-[#4CC8FF]">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="m4 7 8 6 8-6" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="admin@empresa.com"
                      autoComplete="email"
                      required
                      className="h-12 w-full rounded-xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] pl-12 pr-4 text-sm font-medium text-white outline-none transition-all duration-300 placeholder:text-[#AAB9DA]/40 hover:border-[rgba(82,146,230,0.5)] focus:border-[#4CC8FF] focus:bg-[#020A1B] focus:ring-4 focus:ring-[#4CC8FF]/10"
                    />
                  </div>
                </div>

                <div className="group">
                  <label htmlFor="password" className="mb-1.5 block text-xs font-bold sm:text-sm text-[#AAB9DA]">Contraseña</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-[#AAB9DA] transition-colors duration-200 group-focus-within:text-[#4CC8FF]">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="5" y="10" width="14" height="10" rx="2" />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className="h-12 w-full rounded-xl border border-[rgba(82,146,230,0.28)] bg-[#020A1B] pl-12 pr-14 text-sm font-medium text-white outline-none transition-all duration-300 placeholder:text-[#AAB9DA]/40 hover:border-[rgba(82,146,230,0.5)] focus:border-[#4CC8FF] focus:bg-[#020A1B] focus:ring-4 focus:ring-[#4CC8FF]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#AAB9DA] transition hover:text-[#4CC8FF]"
                      aria-label={showPassword ? "Ocultar Contraseña" : "Mostrar Contraseña"}
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                        <circle cx="12" cy="12" r="2.5" />
                        {showPassword && <path d="M3 3l18 18" />}
                      </svg>
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="animate-[fadeIn_.25s_ease-out] rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm font-semibold text-rose-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative mt-1 flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#2457c5] via-sky-600 to-[#4CC8FF] px-6 text-sm font-extrabold text-white shadow-lg shadow-[#2457c5]/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#4CC8FF]/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="absolute inset-y-0 -left-20 w-16 -skew-x-12 bg-white/30 transition-all duration-700 group-hover:left-[115%]" />
                  {loading ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>Ingresando...</span>
                    </>
                  ) : (
                    <>
                      <span>Iniciar Sesión</span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 transition-transform duration-300 group-hover:translate-x-1 group-hover:bg-white/25">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h13" />
                          <path d="m13 6 6 6-6 6" />
                        </svg>
                      </span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-7">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[rgba(82,146,230,0.2)]" />
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#AAB9DA]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#4CC8FF]" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    Acceso Seguro
                  </div>
                  <div className="h-px flex-1 bg-[rgba(82,146,230,0.2)]" />
                </div>
                <p className="mt-3 text-center text-[11px] font-medium text-[#AAB9DA]/60">Sistema Administrativo · Acceso Autorizado</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @media (max-height: 760px) and (min-width: 1024px) {
          .login-shell {
            transform: scale(0.92);
            transform-origin: center;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
};

const FeatureCard = ({ title, text, icon }) => {
  const icons = {
    chart: <path d="M4 19V5M4 19h16M7 15l3-4 3 2 5-7" />,
    users: <><path d="M7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M17 13a3 3 0 1 0 0-6" /><path d="M2.5 21a6.5 6.5 0 0 1 13 0M15 15a5 5 0 0 1 6.5 6" /></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 9h8M8 13h5" /></>,
  };

  return (
    <div className="group rounded-xl border border-[rgba(82,146,230,0.2)] bg-[#020A1B]/70 p-3.5 xl:p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#4CC8FF]/50 hover:bg-[#020A1B] hover:shadow-xl hover:shadow-black/40">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[#0A1329] text-[#4CC8FF] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">{icons[icon]}</svg>
      </div>
      <h3 className="text-sm font-extrabold text-white">{title}</h3>
      <p className="mt-0.5 text-[10px] font-medium leading-4 text-[#AAB9DA]">{text}</p>
    </div>
  );
};

export default Login;