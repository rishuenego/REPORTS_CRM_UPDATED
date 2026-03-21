"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { downloads } from "../api/client";
import { RefreshCw, FileText } from "lucide-react";

interface DownloadLog {
  username: string;
  reportType: string;
  branch: string;
  downloadedAt: string;
}

export const LoginReport: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [logs, setLogs] = useState<DownloadLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDownloadLogs();
    const interval = setInterval(loadDownloadLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDownloadLogs = async () => {
    try {
      const response = await downloads.getDownloadLogs();
      setLogs(response.data);
    } catch (error) {
      console.error("Failed to load download logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1
          className={`text-2xl sm:text-3xl font-bold ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          Login Report
        </h1>
        <button
          onClick={loadDownloadLogs}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div
        className={`rounded-lg shadow overflow-hidden ${
          isDark ? "bg-slate-800" : "bg-white"
        }`}
      >
        <div
          className={`px-4 sm:px-6 py-4 border-b ${
            isDark ? "border-slate-700" : "border-slate-200"
          }`}
        >
          <h2
            className={`text-lg sm:text-xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Report Download History
          </h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw
              className={`w-10 h-10 animate-spin mb-3 ${
                isDark ? "text-yellow-400" : "text-yellow-500"
              }`}
            />
            <p
              className={`text-lg ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              Loading...
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div
            className={`p-6 text-center ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No download history available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead
                className={
                  isDark
                    ? "bg-slate-700 border-b border-slate-600"
                    : "bg-slate-50 border-b border-slate-200"
                }
              >
                <tr>
                  <th
                    className={`px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold ${
                      isDark ? "text-slate-200" : "text-slate-900"
                    }`}
                  >
                    Username
                  </th>
                  <th
                    className={`px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold ${
                      isDark ? "text-slate-200" : "text-slate-900"
                    }`}
                  >
                    Report Type
                  </th>
                  <th
                    className={`px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold ${
                      isDark ? "text-slate-200" : "text-slate-900"
                    }`}
                  >
                    Branch
                  </th>
                  <th
                    className={`px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold ${
                      isDark ? "text-slate-200" : "text-slate-900"
                    }`}
                  >
                    Downloaded At
                  </th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${
                  isDark ? "divide-slate-700" : "divide-slate-200"
                }`}
              >
                {logs.map((log, index) => (
                  <tr
                    key={index}
                    className={
                      isDark ? "hover:bg-slate-700" : "hover:bg-slate-50"
                    }
                  >
                    <td
                      className={`px-4 sm:px-6 py-4 text-xs sm:text-sm font-medium ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {log.username}
                    </td>
                    <td
                      className={`px-4 sm:px-6 py-4 text-xs sm:text-sm capitalize ${
                        isDark ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {log.reportType}
                    </td>
                    <td
                      className={`px-4 sm:px-6 py-4 text-xs sm:text-sm ${
                        isDark ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {log.branch || "-"}
                    </td>
                    <td
                      className={`px-4 sm:px-6 py-4 text-xs sm:text-sm ${
                        isDark ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {formatDateTime(log.downloadedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
