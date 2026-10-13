
import { useState } from "react";
import { API_BASE_URL, parseApiResponse } from "./api";

export default function HealthWorkerLogin({ onLogin, initialMessage = "" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await parseApiResponse(response);

      if (!data.token || !data.worker || data.worker.role !== "health_worker") {
        throw new Error("The server returned an invalid health-worker session.");
      }

      onLogin(data);
    } catch (error) {
      setMessage(error.message || "Unable to connect to the authentication server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-card">
      <div className="login-logo">✚</div>
      <p className="login-eyebrow">SECURE STAFF ACCESS</p>
      <h2>Welcome back</h2>
      <p className="login-subtitle">
        Sign in with your registered health-worker account.
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="worker-email">Email address</label>
        <input
          id="worker-email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="worker-password">Password</label>
        <div className="password-field">
          <input
            id="worker-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="show-password"
            onClick={() => setShowPassword((previous) => !previous)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {message && <p className="error-message" role="alert">{message}</p>}

        <button className="login-submit" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="login-security">
        Only provisioned health-worker accounts can sign in.
      </p>
    </section>
  );
}
