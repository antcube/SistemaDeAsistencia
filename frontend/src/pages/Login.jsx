import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      setError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Sistema de Asistencia</h1>

        <p style={styles.subtitle}>
          Inicia sesión para continuar
        </p>

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>
            Correo electrónico
          </label>

          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="admin@empresa.com"
            autoComplete="email"
            required
            style={styles.input}
          />

          <label style={styles.label}>
            Contraseña
          </label>

          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            style={styles.input}
          />

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f4f6f8",
    padding: "20px",
  },

  card: {
    width: "100%",
    maxWidth: "420px",
    background: "#ffffff",
    padding: "35px",
    borderRadius: "12px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
  },

  title: {
    margin: "0 0 8px",
    textAlign: "center",
  },

  subtitle: {
    margin: "0 0 30px",
    textAlign: "center",
    color: "#666",
  },

  label: {
    display: "block",
    marginBottom: "7px",
    fontWeight: "600",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    marginBottom: "18px",
    border: "1px solid #d5d9dd",
    borderRadius: "7px",
    fontSize: "15px",
  },

  error: {
    marginBottom: "15px",
    padding: "10px",
    borderRadius: "6px",
    background: "#ffe8e8",
    color: "#b00020",
    fontSize: "14px",
  },

  button: {
    width: "100%",
    padding: "13px",
    border: "none",
    borderRadius: "7px",
    background: "#222",
    color: "#fff",
    fontSize: "16px",
    cursor: "pointer",
  },

  buttonDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
};

export default Login;
