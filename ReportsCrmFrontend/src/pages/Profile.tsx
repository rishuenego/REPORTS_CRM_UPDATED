"use client";

import type React from "react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../api/client";
import {
  User,
  Mail,
  Shield,
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
} from "lucide-react";

export const Profile: React.FC = () => {
  const { user, setUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (newPassword.length < 4) {
      setMessage({
        type: "error",
        text: "Password must be at least 4 characters",
      });
      return;
    }

    setLoading(true);
    try {
      await auth.updateUser(user!.id, { password: newPassword });
      setMessage({ type: "success", text: "Password updated successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);

      // Update token in localStorage if needed
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify(userData));
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to update password",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center">
          <User className="w-10 h-10 text-slate-900" />
        </div>
        <div>
          <h1
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {user?.username}
          </h1>
          <p
            className={`text-sm ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Manage your profile and account settings
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
          }`}
        >
          {message.type === "success" ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Details Card */}
      <div
        className={`rounded-xl p-6 ${
          isDark ? "bg-slate-800" : "bg-white"
        } shadow-lg`}
      >
        <h2
          className={`text-lg font-bold mb-6 ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          Profile Information
        </h2>

        <div className="space-y-4">
          {/* Username */}
          <div
            className={`flex items-center gap-4 p-4 rounded-lg ${
              isDark ? "bg-slate-700/50" : "bg-slate-50"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-slate-600" : "bg-slate-200"
              }`}
            >
              <User
                className={`w-5 h-5 ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              />
            </div>
            <div className="flex-1">
              <p
                className={`text-xs ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Username
              </p>
              <p
                className={`font-medium ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {user?.username}
              </p>
            </div>
          </div>

          {/* Role */}
          <div
            className={`flex items-center gap-4 p-4 rounded-lg ${
              isDark ? "bg-slate-700/50" : "bg-slate-50"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-slate-600" : "bg-slate-200"
              }`}
            >
              <Shield
                className={`w-5 h-5 ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              />
            </div>
            <div className="flex-1">
              <p
                className={`text-xs ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Role
              </p>
              <div className="flex items-center gap-2">
                <p
                  className={`font-medium capitalize ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {user?.role}
                </p>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    user?.role === "admin"
                      ? "bg-yellow-400/20 text-yellow-500"
                      : "bg-blue-400/20 text-blue-500"
                  }`}
                >
                  {user?.role === "admin" ? "Administrator" : "Standard User"}
                </span>
              </div>
            </div>
          </div>

          {/* User ID */}
          <div
            className={`flex items-center gap-4 p-4 rounded-lg ${
              isDark ? "bg-slate-700/50" : "bg-slate-50"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isDark ? "bg-slate-600" : "bg-slate-200"
              }`}
            >
              <Mail
                className={`w-5 h-5 ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              />
            </div>
            <div className="flex-1">
              <p
                className={`text-xs ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                User ID
              </p>
              <p
                className={`font-medium font-mono text-sm ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {user?.id}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Password Reset Card */}
      <div
        className={`rounded-xl p-6 ${
          isDark ? "bg-slate-800" : "bg-white"
        } shadow-lg`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className={`text-lg font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Security
          </h2>
          <button
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              showPasswordSection
                ? isDark
                  ? "bg-slate-700 text-slate-300"
                  : "bg-slate-200 text-slate-700"
                : "bg-yellow-400 text-slate-900 hover:bg-yellow-500"
            }`}
          >
            {showPasswordSection ? "Cancel" : "Change Password"}
          </button>
        </div>

        {showPasswordSection && (
          <form onSubmit={handlePasswordReset} className="space-y-4 mt-6">
            {/* New Password */}
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                New Password
              </label>
              <div className="relative">
                <Key
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                />
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full pl-10 pr-12 py-3 rounded-lg border ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Confirm New Password
              </label>
              <div className="relative">
                <Key
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 pr-12 py-3 rounded-lg border ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  } ${
                    newPassword &&
                    confirmPassword &&
                    newPassword !== confirmPassword
                      ? "border-red-500"
                      : ""
                  }`}
                  placeholder="Confirm new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {newPassword &&
                confirmPassword &&
                newPassword !== confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">
                    Passwords do not match
                  </p>
                )}
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword
              }
              className="w-full py-3 bg-yellow-400 text-slate-900 font-bold rounded-lg hover:bg-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}

        {!showPasswordSection && (
          <p
            className={`text-sm ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Keep your account secure by using a strong password.
          </p>
        )}
      </div>
    </div>
  );
};
