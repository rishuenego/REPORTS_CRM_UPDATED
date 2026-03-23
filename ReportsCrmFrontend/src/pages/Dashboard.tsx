"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { dashboard } from "../api/client";
import { Users, Clock, Activity, TrendingUp, RefreshCw } from "lucide-react";

interface UserSession {
  id: string;
  username: string;
  loginTime: string;
  logoutTime: string | null;
  status: string;
}

interface DashboardData {
  sessions: UserSession[];
  stats: {
    activeUsers: number;
    totalSessions: number;
    todaySessions: number;
    avgSessionDuration: string;
  };
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [stats, setStats] = useState({
    activeUsers: 0,
    totalSessions: 0,
    todaySessions: 0,
    avgSessionDuration: "0m",
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dashboard.getUserActivity();
      const data: DashboardData = response.data;
      setSessions(data.sessions || []);
      setStats(
        data.stats || {
          activeUsers: 0,
          totalSessions: 0,
          todaySessions: 0,
          avgSessionDuration: "0m",
        }
      );
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusDistribution = () => {
    const active = sessions.filter((s) => s.status === "active").length;
    const inactive = sessions.filter((s) => s.status === "inactive").length;
    return { active, inactive };
  };

  const getHourlyActivity = () => {
    const hourCounts: { [key: number]: number } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    sessions.forEach((session) => {
      const loginDate = new Date(session.loginTime);
      if (loginDate >= today) {
        const hour = loginDate.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourCounts[i] || 0,
    }));
  };

  const statusDist = getStatusDistribution();
  const hourlyData = getHourlyActivity();
  const maxHourlyCount = Math.max(...hourlyData.map((h) => h.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1
            className={`text-lg sm:text-xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Dashboard
          </h1>
          {lastUpdated && (
            <p
              className={`text-xs ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <RefreshCw className="w-4 h-4 animate-spin text-yellow-500" />
          )}
          <span
            className={`text-xs ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Auto-refresh: 30s
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          className={`rounded-lg shadow-md p-3 sm:p-4 border-l-4 border-blue-500 ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-[10px] sm:text-xs font-medium ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              >
                Active Users
              </p>
              <p
                className={`text-xl sm:text-2xl font-bold mt-1 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {stats.activeUsers}
              </p>
            </div>
            <div className="p-1.5 sm:p-2 bg-blue-500 bg-opacity-20 rounded-full">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-center text-[10px] sm:text-xs">
            <span className="text-green-500 font-medium">Online now</span>
          </div>
        </div>

        <div
          className={`rounded-lg shadow-md p-3 sm:p-4 border-l-4 border-green-500 ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-[10px] sm:text-xs font-medium ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              >
                Total Sessions
              </p>
              <p
                className={`text-xl sm:text-2xl font-bold mt-1 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {stats.totalSessions}
              </p>
            </div>
            <div className="p-1.5 sm:p-2 bg-green-500 bg-opacity-20 rounded-full">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-center text-[10px] sm:text-xs">
            <span className={isDark ? "text-slate-400" : "text-slate-500"}>
              All time
            </span>
          </div>
        </div>

        <div
          className={`rounded-lg shadow-md p-3 sm:p-4 border-l-4 border-purple-500 ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-[10px] sm:text-xs font-medium ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              >
                Today's Sessions
              </p>
              <p
                className={`text-xl sm:text-2xl font-bold mt-1 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {stats.todaySessions}
              </p>
            </div>
            <div className="p-1.5 sm:p-2 bg-purple-500 bg-opacity-20 rounded-full">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-center text-[10px] sm:text-xs">
            <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-500 mr-1" />
            <span className="text-green-500 font-medium">Today</span>
          </div>
        </div>

        <div
          className={`rounded-lg shadow-md p-3 sm:p-4 border-l-4 border-orange-500 ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className={`text-[10px] sm:text-xs font-medium ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              >
                Avg Duration
              </p>
              <p
                className={`text-xl sm:text-2xl font-bold mt-1 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {stats.avgSessionDuration}
              </p>
            </div>
            <div className="p-1.5 sm:p-2 bg-orange-500 bg-opacity-20 rounded-full">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-center text-[10px] sm:text-xs">
            <span className={isDark ? "text-slate-400" : "text-slate-500"}>
              Per session
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className={`rounded-lg shadow-md p-3 sm:p-4 ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
        >
          <h3
            className={`text-sm font-bold mb-3 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Session Status Distribution
          </h3>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <div className="relative">
              <svg className="w-24 h-24 sm:w-28 sm:h-28" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={isDark ? "#334155" : "#e2e8f0"}
                  strokeWidth="20"
                />
                {statusDist.active + statusDist.inactive > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="20"
                    strokeDasharray={`${
                      (statusDist.active /
                        (statusDist.active + statusDist.inactive)) *
                      251.2
                    } 251.2`}
                    transform="rotate(-90 50 50)"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p
                    className={`text-lg sm:text-xl font-bold ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {statusDist.active + statusDist.inactive}
                  </p>
                  <p
                    className={`text-[10px] ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Total
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div>
                  <p
                    className={`text-xs font-medium ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Active
                  </p>
                  <p
                    className={`text-[10px] ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {statusDist.active} sessions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div>
                  <p
                    className={`text-xs font-medium ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Inactive
                  </p>
                  <p
                    className={`text-[10px] ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {statusDist.inactive} sessions
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`rounded-lg shadow-md p-3 sm:p-4 ${
            isDark ? "bg-slate-800" : "bg-white"
          }`}
        >
          <h3
            className={`text-sm font-bold mb-3 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Today's Hourly Activity
          </h3>
          <div className="flex items-end justify-between h-24 sm:h-28 gap-0.5">
            {hourlyData.slice(6, 22).map((data) => (
              <div
                key={data.hour}
                className="flex flex-col items-center flex-1"
              >
                <div
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all duration-300"
                  style={{
                    height: `${(data.count / maxHourlyCount) * 100}%`,
                    minHeight: data.count > 0 ? "6px" : "2px",
                    opacity: data.count > 0 ? 1 : 0.3,
                  }}
                />
                <span
                  className={`text-[8px] sm:text-[10px] mt-0.5 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {data.hour}
                </span>
              </div>
            ))}
          </div>
          <p
            className={`text-center text-[10px] sm:text-xs mt-1.5 ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Hour of Day (6 AM - 10 PM)
          </p>
        </div>
      </div>

      <div
        className={`rounded-lg shadow-md overflow-hidden ${
          isDark ? "bg-slate-800" : "bg-white"
        }`}
      >
        <div
          className={`px-3 sm:px-4 py-3 border-b ${
            isDark ? "border-slate-700" : "border-slate-200"
          }`}
        >
          <h2
            className={`text-sm sm:text-base font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            User Activity History
          </h2>
        </div>

        {loading && sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <RefreshCw
              className={`w-8 h-8 animate-spin mb-2 ${
                isDark ? "text-yellow-400" : "text-yellow-500"
              }`}
            />
            <p
              className={`text-sm ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              Loading report...
            </p>
          </div>
        ) : sessions.length === 0 ? (
          <div
            className={`p-4 text-center text-xs ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            No session data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-xs">
              <thead className={isDark ? "bg-slate-700" : "bg-slate-50"}>
                <tr>
                  <th
                    className={`px-3 sm:px-4 py-2 text-left font-semibold ${
                      isDark ? "text-slate-200" : "text-slate-900"
                    }`}
                  >
                    Username
                  </th>
                  <th
                    className={`px-3 sm:px-4 py-2 text-left font-semibold ${
                      isDark ? "text-slate-200" : "text-slate-900"
                    }`}
                  >
                    Login Time
                  </th>
                  <th
                    className={`px-3 sm:px-4 py-2 text-left font-semibold ${
                      isDark ? "text-slate-200" : "text-slate-900"
                    }`}
                  >
                    Logout Time
                  </th>
                  <th
                    className={`px-3 sm:px-4 py-2 text-left font-semibold ${
                      isDark ? "text-slate-200" : "text-slate-900"
                    }`}
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${
                  isDark ? "divide-slate-700" : "divide-slate-200"
                }`}
              >
                {sessions.map((session) => (
                  <tr
                    key={session.id}
                    className={
                      isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                    }
                  >
                    <td
                      className={`px-3 sm:px-4 py-2 font-medium ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {session.username}
                    </td>
                    <td
                      className={`px-3 sm:px-4 py-2 ${
                        isDark ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {formatDateTime(session.loginTime)}
                    </td>
                    <td
                      className={`px-3 sm:px-4 py-2 ${
                        isDark ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {formatDateTime(session.logoutTime)}
                    </td>
                    <td className="px-3 sm:px-4 py-2">
                      <span
                        className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          session.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {session.status === "active"
                          ? "LOGGED IN"
                          : "LOGGED OUT"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        className={`rounded-lg p-3 ${
          isDark
            ? "bg-blue-900 border border-blue-800"
            : "bg-blue-50 border border-blue-200"
        }`}
      >
        <p className={`text-xs ${isDark ? "text-blue-200" : "text-slate-700"}`}>
          <span className="font-semibold">Logged in as:</span> {user?.username}{" "}
          ({user?.role})
        </p>
      </div>
    </div>
  );
};
