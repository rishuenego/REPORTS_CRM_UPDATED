"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../api/client";
import { User, Lock, Sun, Moon } from "lucide-react";

export const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isToggled, setIsToggled] = useState(false);
  const navigate = useNavigate();
  const { setUser, isAuthenticated, validateSession } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  // Register form state
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated) {
        const isValid = await validateSession();
        if (isValid) {
          navigate("/dashboard", { replace: true });
        }
      }
    };
    checkAuth();
  }, [isAuthenticated, navigate, validateSession]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await auth.login(username, password);
      const { token, user } = response.data;

      const userWithToken = { ...user, token };
      localStorage.setItem("user", JSON.stringify(userWithToken));
      setUser(userWithToken);

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Registration logic - for now just switch to login
      setIsToggled(false);
      setError("Registration is disabled. Please contact admin.");
    } catch (err: any) {
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const bgColor = isDark ? "#1a1a2e" : "#f0f4f8";
  const textColor = isDark ? "white" : "#1a1a2e";
  const inputBorderColor = isDark ? "white" : "#1a1a2e";
  const shapeGradientFrom = isDark ? "#1a1a2e" : "#e0e7ef";
  const shapeGradientTo = "#00d4ff";

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center p-5 transition-colors duration-300"
      style={{ backgroundColor: bgColor }}
    >
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={`fixed top-4 right-4 p-3 rounded-full border border-[#00d4ff] text-[#00d4ff] hover:bg-[#00d4ff]/10 transition z-50 ${
          isDark ? "bg-[#1a1a2e]" : "bg-white"
        }`}
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Auth Wrapper */}
      <div
        className={`relative w-full max-w-[800px] h-[500px] border-2 border-[#00d4ff] shadow-[0_0_25px_#00d4ff] overflow-hidden ${
          isDark ? "bg-[#1a1a2e]" : "bg-white"
        }`}
      >
        {/* Background Shape */}
        <div
          className={`absolute right-0 top-[-5px] h-[600px] w-[850px] transition-all duration-[1500ms] ${
            isToggled
              ? "rotate-0 skew-y-0 delay-500"
              : "rotate-[10deg] skew-y-[40deg] origin-bottom-right delay-[1600ms]"
          }`}
          style={{
            background: `linear-gradient(to bottom right, ${shapeGradientFrom}, ${shapeGradientTo})`,
          }}
        />

        {/* Secondary Shape */}
        <div
          className={`absolute left-[250px] top-full h-[700px] w-[850px] border-t-[3px] border-[#00d4ff] transition-all duration-[1500ms] origin-bottom-left ${
            isToggled
              ? "rotate-[-11deg] skew-y-[-41deg] delay-[1200ms]"
              : "rotate-0 skew-y-0 delay-500"
          }`}
          style={{ backgroundColor: isDark ? "#1a1a2e" : "#f0f4f8" }}
        />

        {/* Sign In Panel */}
        <div className="absolute top-0 left-0 w-1/2 h-full flex justify-center flex-col px-10">
          <h2
            className={`text-[32px] text-center font-semibold transition-all duration-700 ${
              isToggled
                ? "translate-x-[-120%] opacity-0"
                : "translate-x-0 opacity-100 delay-[2100ms]"
            }`}
            style={{ color: textColor }}
          >
            Login
          </h2>
          <form onSubmit={handleLogin}>
            {error && !isToggled && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div
              className={`relative w-full h-[50px] mt-6 transition-all duration-700 ${
                isToggled
                  ? "translate-x-[-120%] opacity-0 delay-100"
                  : "translate-x-0 opacity-100 delay-[2200ms]"
              }`}
            >
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-full bg-transparent border-0 border-b-2 outline-none font-semibold pr-6 focus:border-[#00d4ff] peer"
                style={{ borderColor: inputBorderColor, color: textColor }}
                autoComplete="username"
              />
              <label
                className={`absolute left-0 transition-all duration-500 ${
                  username
                    ? "top-[-5px] text-[#00d4ff]"
                    : "top-1/2 -translate-y-1/2"
                } peer-focus:top-[-5px] peer-focus:text-[#00d4ff]`}
                style={{ color: username ? "#00d4ff" : textColor }}
              >
                Username
              </label>
              <User
                className={`absolute top-1/2 right-0 -translate-y-1/2 w-[18px] h-[18px] transition-colors ${
                  username ? "text-[#00d4ff]" : ""
                }`}
                style={{ color: username ? "#00d4ff" : textColor }}
              />
            </div>

            <div
              className={`relative w-full h-[50px] mt-6 transition-all duration-700 ${
                isToggled
                  ? "translate-x-[-120%] opacity-0 delay-200"
                  : "translate-x-0 opacity-100 delay-[2300ms]"
              }`}
            >
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-full bg-transparent border-0 border-b-2 outline-none font-semibold pr-6 focus:border-[#00d4ff] peer"
                style={{ borderColor: inputBorderColor, color: textColor }}
                autoComplete="current-password"
              />
              <label
                className={`absolute left-0 transition-all duration-500 ${
                  password
                    ? "top-[-5px] text-[#00d4ff]"
                    : "top-1/2 -translate-y-1/2"
                } peer-focus:top-[-5px] peer-focus:text-[#00d4ff]`}
                style={{ color: password ? "#00d4ff" : textColor }}
              >
                Password
              </label>
              <Lock
                className={`absolute top-1/2 right-0 -translate-y-1/2 w-[18px] h-[18px] transition-colors ${
                  password ? "text-[#00d4ff]" : ""
                }`}
                style={{ color: password ? "#00d4ff" : textColor }}
              />
            </div>

            <div
              className={`relative w-full h-[50px] mt-6 transition-all duration-700 ${
                isToggled
                  ? "translate-x-[-120%] opacity-0 delay-300"
                  : "translate-x-0 opacity-100 delay-[2400ms]"
              }`}
            >
              <button
                type="submit"
                disabled={loading}
                className="relative w-full h-[45px] bg-transparent rounded-[40px] cursor-pointer font-semibold border-2 border-[#00d4ff] overflow-hidden z-[1] group disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: textColor }}
              >
                <span className="relative z-10">
                  {loading ? "Signing in..." : "Login"}
                </span>
                <div
                  className="absolute h-[300%] w-full top-[-100%] left-0 z-0 transition-all duration-500 group-hover:top-0"
                  style={{
                    background: `linear-gradient(to bottom, ${
                      isDark ? "#1a1a2e" : "#f0f4f8"
                    }, #00d4ff 50%, ${isDark ? "#1a1a2e" : "#f0f4f8"})`,
                  }}
                />
              </button>
            </div>

            <div
              className={`text-sm text-center mt-5 mb-2.5 transition-all duration-700 ${
                isToggled
                  ? "translate-x-[-120%] opacity-0 delay-[400ms]"
                  : "translate-x-0 opacity-100 delay-[2500ms]"
              }`}
              style={{ color: textColor }}
            >
              {/* <p>
                Don't have an account? <br />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsToggled(true);
                  }}
                  className="text-[#00d4ff] font-semibold hover:underline"
                >
                  Sign Up
                </button>
              </p> */}
            </div>
          </form>
        </div>

        {/* Welcome Section - Sign In */}
        <div className="absolute top-0 right-0 w-1/2 h-full flex justify-center flex-col text-right px-10 pb-[60px] pl-[150px]">
          <h2
            className={`text-[36px] text-white uppercase font-bold leading-[1.3] transition-all duration-700 ${
              isToggled
                ? "translate-x-[120%] opacity-0 blur-[10px]"
                : "translate-x-0 opacity-100 blur-0 delay-[2000ms]"
            }`}
          >
            WELCOME BACK!
          </h2>
        </div>

        {/* Sign Up Panel */}
        <div className="absolute top-0 right-0 w-1/2 h-full flex justify-center flex-col px-[60px]">
          <h2
            className={`text-[32px] text-center font-semibold transition-all duration-700 ${
              isToggled
                ? "translate-x-0 opacity-100 blur-0 delay-[1700ms]"
                : "translate-x-[120%] opacity-0 blur-[10px]"
            }`}
            style={{ color: textColor }}
          >
            Register
          </h2>
          <form onSubmit={handleRegister}>
            {error && isToggled && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div
              className={`relative w-full h-[50px] mt-6 transition-all duration-700 ${
                isToggled
                  ? "translate-x-0 opacity-100 blur-0 delay-[1800ms]"
                  : "translate-x-[120%] opacity-0 blur-[10px]"
              }`}
            >
              <input
                type="text"
                required
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="w-full h-full bg-transparent border-0 border-b-2 outline-none font-semibold pr-6 focus:border-[#00d4ff] peer"
                style={{ borderColor: inputBorderColor, color: textColor }}
              />
              <label
                className={`absolute left-0 transition-all duration-500 ${
                  regUsername
                    ? "top-[-5px] text-[#00d4ff]"
                    : "top-1/2 -translate-y-1/2"
                } peer-focus:top-[-5px] peer-focus:text-[#00d4ff]`}
                style={{ color: regUsername ? "#00d4ff" : textColor }}
              >
                Username
              </label>
              <User
                className={`absolute top-1/2 right-0 -translate-y-1/2 w-[18px] h-[18px] transition-colors`}
                style={{ color: regUsername ? "#00d4ff" : textColor }}
              />
            </div>

            <div
              className={`relative w-full h-[50px] mt-6 transition-all duration-700 ${
                isToggled
                  ? "translate-x-0 opacity-100 blur-0 delay-[1900ms]"
                  : "translate-x-[120%] opacity-0 blur-[10px]"
              }`}
            >
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full h-full bg-transparent border-0 border-b-2 outline-none font-semibold pr-6 focus:border-[#00d4ff] peer"
                style={{ borderColor: inputBorderColor, color: textColor }}
              />
              <label
                className={`absolute left-0 transition-all duration-500 ${
                  regEmail
                    ? "top-[-5px] text-[#00d4ff]"
                    : "top-1/2 -translate-y-1/2"
                } peer-focus:top-[-5px] peer-focus:text-[#00d4ff]`}
                style={{ color: regEmail ? "#00d4ff" : textColor }}
              >
                Email
              </label>
              <svg
                className={`absolute top-1/2 right-0 -translate-y-1/2 w-[18px] h-[18px] transition-colors`}
                style={{ color: regEmail ? "#00d4ff" : textColor }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            <div
              className={`relative w-full h-[50px] mt-6 transition-all duration-700 ${
                isToggled
                  ? "translate-x-0 opacity-100 blur-0 delay-[1900ms]"
                  : "translate-x-[120%] opacity-0 blur-[10px]"
              }`}
            >
              <input
                type="password"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full h-full bg-transparent border-0 border-b-2 outline-none font-semibold pr-6 focus:border-[#00d4ff] peer"
                style={{ borderColor: inputBorderColor, color: textColor }}
              />
              <label
                className={`absolute left-0 transition-all duration-500 ${
                  regPassword
                    ? "top-[-5px] text-[#00d4ff]"
                    : "top-1/2 -translate-y-1/2"
                } peer-focus:top-[-5px] peer-focus:text-[#00d4ff]`}
                style={{ color: regPassword ? "#00d4ff" : textColor }}
              >
                Password
              </label>
              <Lock
                className={`absolute top-1/2 right-0 -translate-y-1/2 w-[18px] h-[18px] transition-colors`}
                style={{ color: regPassword ? "#00d4ff" : textColor }}
              />
            </div>

            <div
              className={`relative w-full h-[50px] mt-6 transition-all duration-700 ${
                isToggled
                  ? "translate-x-0 opacity-100 blur-0 delay-[2000ms]"
                  : "translate-x-[120%] opacity-0 blur-[10px]"
              }`}
            >
              <button
                type="submit"
                disabled={loading}
                className="relative w-full h-[45px] bg-transparent rounded-[40px] cursor-pointer font-semibold border-2 border-[#00d4ff] overflow-hidden z-[1] group disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: textColor }}
              >
                <span className="relative z-10">
                  {loading ? "Registering..." : "Register"}
                </span>
                <div
                  className="absolute h-[300%] w-full top-[-100%] left-0 z-0 transition-all duration-500 group-hover:top-0"
                  style={{
                    background: `linear-gradient(to bottom, ${
                      isDark ? "#1a1a2e" : "#f0f4f8"
                    }, #00d4ff 50%, ${isDark ? "#1a1a2e" : "#f0f4f8"})`,
                  }}
                />
              </button>
            </div>

            <div
              className={`text-sm text-center mt-5 mb-2.5 transition-all duration-700 ${
                isToggled
                  ? "translate-x-0 opacity-100 blur-0 delay-[2100ms]"
                  : "translate-x-[120%] opacity-0 blur-[10px]"
              }`}
              style={{ color: textColor }}
            >
              <p>
                Already have an account? <br />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsToggled(false);
                  }}
                  className="text-[#00d4ff] font-semibold hover:underline"
                >
                  Sign In
                </button>
              </p>
            </div>
          </form>
        </div>

        {/* Welcome Section - Sign Up */}
        <div className="absolute top-0 left-0 w-1/2 h-full flex justify-center flex-col text-left px-10 pb-[60px] pr-[150px] pointer-events-none">
          <h2
            className={`text-[36px] text-white uppercase font-bold leading-[1.3] transition-all duration-700 ${
              isToggled
                ? "translate-x-0 opacity-100 blur-0 delay-[1700ms]"
                : "translate-x-[-120%] opacity-0 blur-[10px]"
            }`}
          >
            WELCOME!
          </h2>
        </div>
      </div>

      {/* Footer */}
      <div
        className="mt-[30px] text-center p-[15px] text-sm"
        style={{ color: textColor }}
      >
        <p>
          DEVELOPED AND <span className="text-red-500">DESIGNED</span> by{" "}
          <a
            href="#"
            className="text-[#00d4ff] font-semibold hover:underline transition"
          >
            RISHU
          </a>
        </p>
      </div>
    </div>
  );
};
