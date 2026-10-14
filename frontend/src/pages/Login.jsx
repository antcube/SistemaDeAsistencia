import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import seinfinityLogo from "../assets/seinfinty-logo.png";

const TITLE_LINE_ONE = "Todo El Control De Tus Círculos,";
const TITLE_LINE_TWO = "En Un Solo Lugar.";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [typedLineOne, setTypedLineOne] = useState("");
  const [typedLineTwo, setTypedLineTwo] = useState("");
  const [typingLine, setTypingLine] = useState(1);
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) {
      setTypedLineOne(TITLE_LINE_ONE);
      setTypedLineTwo(TITLE_LINE_TWO);
      setTypingLine(2);
      setTypingDone(true);
      return undefined;
    }

    let phase = 1;
    let index = 0;
    let pauseTicks = 0;

    const timer = window.setInterval(() => {
      if (phase === 1) {
        if (index < TITLE_LINE_ONE.length) {
          index += 1;
          setTypedLineOne(TITLE_LINE_ONE.slice(0, index));
          return;
        }

        if (pauseTicks < 4) {
          pauseTicks += 1;
          return;
        }

        phase = 2;
        index = 0;
        setTypingLine(2);
        return;
      }

      if (index < TITLE_LINE_TWO.length) {
        index += 1;
        setTypedLineTwo(TITLE_LINE_TWO.slice(0, index));
        return;
      }

      setTypingDone(true);
      window.clearInterval(timer);
    }, 42);

    return () => window.clearInterval(timer);
  }, []);

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
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 animate-pulse rounded-full bg-[#2457c5]/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[32rem] w-[32rem] animate-pulse rounded-full bg-[#4CC8FF]/15 blur-3xl [animation-delay:1s]" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-[#4CC8FF]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1180px] items-center justify-center">
        <section className="login-shell grid w-full overflow-hidden rounded-[24px] border border-[rgba(82,146,230,0.28)] bg-[#0A1329] shadow-2xl shadow-black/80 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative hidden min-h-[650px] overflow-hidden border-r border-[rgba(82,146,230,0.2)] bg-gradient-to-br from-[#020A1B] via-[#0A1329] to-[#080F24] p-8 text-white lg:flex lg:flex-col xl:p-9">
            <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-[#4CC8FF]/10 bg-[#4CC8FF]/5" />
            <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full border border-[rgba(82,146,230,0.15)] bg-[#2457c5]/10" />
            <div className="absolute right-20 top-24 h-3 w-3 animate-ping rounded-full bg-[#4CC8FF]" />
            <div className="absolute bottom-28 right-28 h-2 w-2 animate-pulse rounded-full bg-white/70" />

            <div className="relative z-10 flex min-h-[112px] items-center justify-center py-4">
              <img
                src={seinfinityLogo}
                alt="SEINFINITY"
                className="h-auto w-[300px] object-contain transition-transform duration-500 hover:scale-[1.025] xl:w-[340px]"
              />
            </div>

            <div className="relative z-10 mt-3 max-w-xl xl:mt-4">
              <h1
                className="max-w-[540px] text-[42px] font-black leading-[1.08] tracking-[-0.045em] xl:text-[46px]"
                aria-label={`${TITLE_LINE_ONE} ${TITLE_LINE_TWO}`}
              >
                <span
                  className="block min-h-[92px] xl:min-h-[100px]"
                  aria-hidden="true"
                >
                  {typedLineOne}
                  {typingLine === 1 && !typingDone && (
                    <span className="type-caret ml-1 inline-block h-[0.9em] w-[3px] translate-y-[0.08em] rounded-full bg-white align-baseline" />
                  )}
                </span>

                <span
                  className="mt-2 block min-h-[54px] pb-1.5 bg-gradient-to-r from-[#4CC8FF] via-sky-200 to-white bg-clip-text text-transparent"
                  aria-hidden="true"
                >
                  {typedLineTwo}
                  {typingLine === 2 && !typingDone && (
                    <span className="type-caret ml-1 inline-block h-[0.9em] w-[3px] translate-y-[0.08em] rounded-full bg-[#4CC8FF] align-baseline" />
                  )}
                </span>
              </h1>

              <p className="mt-4 max-w-[510px] text-[15px] leading-6 text-[#AAB9DA]">
                Reuniones, Asistencia, Miembros Y Reportes En Un Solo Espacio.
              </p>
            </div>

            <div className="relative z-10 mt-auto grid grid-cols-2 gap-3.5 pt-7">
              <FeatureCard
                title="Reportes"
                text="Información Para Una Mejor Gestión."
                icon="chart"
              />
              <FeatureCard
                title="Asistencia"
                text="Seguimiento Rápido Y Centralizado."
                icon="users"
              />
              <FeatureCard
                title="Seguridad"
                text="Acceso Controlado Por Rol."
                icon="shield"
              />
              <FeatureCard
                title="Gestión"
                text="Todo En Un Mismo Espacio."
                icon="panel"
              />
            </div>
          </div>

          <div className="relative flex min-h-[650px] items-center overflow-hidden bg-[#0A1329] px-7 py-10 sm:px-10 lg:px-12 xl:px-14">
            <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-[#2457c5]/10 blur-2xl" />
            <div className="absolute -bottom-40 -left-36 h-96 w-96 rounded-full bg-[#020A1B]" />
            <div className="absolute right-16 top-20 h-2 w-2 animate-bounce rounded-full bg-[#4CC8FF] [animation-delay:400ms]" />

            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2457c5]/[0.05] blur-[80px]" />

            <div className="relative z-10 mx-auto w-full max-w-[450px]">
              <div className="mb-10">
                <h2 className="login-welcome text-[48px] font-black leading-none tracking-[-0.04em] sm:text-[52px]">
                  Bienvenido
                </h2>

                <div className="welcome-accent mt-4 h-[3px] w-[74px] rounded-full bg-gradient-to-r from-[#2457c5] to-[#4CC8FF]" />

                <p className="welcome-copy mt-5 max-w-[410px] text-[16px] leading-7 text-[#AAB9DA]">
                  Ingresa Tus Credenciales Para Acceder Al Sistema.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="group">
                  <label
                    htmlFor="email"
                    className="mb-2.5 block text-[15px] font-bold text-[#AAB9DA]"
                  >
                    Correo Electrónico
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-14 items-center justify-center text-[#AAB9DA] transition-colors duration-200 group-focus-within:text-[#4CC8FF]">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
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
                      className="h-[60px] w-full rounded-[14px] border border-[rgba(82,146,230,0.28)] bg-[#020A1B] pl-14 pr-4 text-[16px] font-medium text-white outline-none transition-all duration-300 placeholder:text-[#AAB9DA]/40 hover:border-[rgba(82,146,230,0.5)] focus:border-[#4CC8FF] focus:bg-[#020A1B] focus:ring-4 focus:ring-[#4CC8FF]/10"
                    />
                  </div>
                </div>

                <div className="group">
                  <label
                    htmlFor="password"
                    className="mb-2.5 block text-[15px] font-bold text-[#AAB9DA]"
                  >
                    Contraseña
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-14 items-center justify-center text-[#AAB9DA] transition-colors duration-200 group-focus-within:text-[#4CC8FF]">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
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
                      className="h-[60px] w-full rounded-[14px] border border-[rgba(82,146,230,0.28)] bg-[#020A1B] pl-14 pr-14 text-[16px] font-medium text-white outline-none transition-all duration-300 placeholder:text-[#AAB9DA]/40 hover:border-[rgba(82,146,230,0.5)] focus:border-[#4CC8FF] focus:bg-[#020A1B] focus:ring-4 focus:ring-[#4CC8FF]/10"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-[#AAB9DA] transition hover:text-[#4CC8FF]"
                      aria-label={
                        showPassword
                          ? "Ocultar Contraseña"
                          : "Mostrar Contraseña"
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
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
                  className="group relative mt-1 flex h-[60px] w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(100deg,#2457c5_0%,#247de0_48%,#4CC8FF_100%)] px-6 text-[16px] font-extrabold text-white shadow-[0_12px_30px_rgba(36,87,197,0.26)] transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_16px_38px_rgba(76,200,255,0.30)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="absolute inset-y-0 -left-24 w-20 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent transition-all duration-700 group-hover:left-[120%]" />

                  {loading ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span>Ingresando...</span>
                    </>
                  ) : (
                    <>
                      <span>Iniciar Sesión</span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 transition-all duration-300 group-hover:translate-x-1 group-hover:scale-105 group-hover:bg-white/25">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M5 12h13" />
                          <path d="m13 6 6 6-6 6" />
                        </svg>
                      </span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-9">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[rgba(82,146,230,0.2)]" />

                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[#AAB9DA]">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-[#4CC8FF]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    Acceso Seguro
                  </div>

                  <div className="h-px flex-1 bg-[rgba(82,146,230,0.2)]" />
                </div>

                <p className="mt-3 text-center text-[12px] font-medium text-[#AAB9DA]/60">
                  Sistema Administrativo · Acceso Autorizado
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @media (max-height: 760px) and (min-width: 1024px) {
          .login-shell {
            transform: scale(0.9);
            transform-origin: center;
          }
        }

        .login-welcome {
          background: linear-gradient(
            90deg,
            #ffffff 0%,
            #ffffff 58%,
            #bcecff 82%,
            #4CC8FF 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: welcomeEnter 0.7s ease-out both;
        }

        .welcome-accent {
          transform-origin: left;
          animation: accentGrow 0.8s 0.25s ease-out both;
        }

        .welcome-copy {
          animation: welcomeCopy 0.7s 0.42s ease-out both;
        }

        @keyframes welcomeEnter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes accentGrow {
          from {
            opacity: 0;
            transform: scaleX(0);
          }

          to {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        @keyframes welcomeCopy {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .type-caret {
          animation: typeCaretBlink 0.72s steps(1, end) infinite;
        }

        @keyframes typeCaretBlink {
          0%,
          46% {
            opacity: 1;
          }

          47%,
          100% {
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
};

const FeatureCard = ({ title, text, icon }) => {
  const icons = {
    chart: <path d="M4 19V5M4 19h16M7 15l3-4 3 2 5-7" />,
    users: (
      <>
        <path d="M7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M17 13a3 3 0 1 0 0-6" />
        <path d="M2.5 21a6.5 6.5 0 0 1 13 0M15 15a5 5 0 0 1 6.5 6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    panel: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
  };

  return (
    <div className="group min-h-[108px] rounded-[14px] border border-[rgba(82,146,230,0.2)] bg-[#020A1B]/70 p-[18px] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#4CC8FF]/50 hover:bg-[#020A1B] hover:shadow-xl hover:shadow-black/40">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0A1329] text-[#4CC8FF] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            {icons[icon]}
          </svg>
        </div>

        <h3 className="text-[16px] font-extrabold leading-tight text-white">
          {title}
        </h3>
      </div>

      <p className="mt-3 text-[12px] font-medium leading-[1.55] text-[#AAB9DA]">
        {text}
      </p>
    </div>
  );
};

export default Login;
