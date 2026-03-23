"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { agent, downloads } from "../api/client";
import { RefreshCw, Download, Calendar, User } from "lucide-react";
import { FilterSidebar, FilterButton } from "../components/FilterSidebar";

interface DispoData {
  DISPO: string;
  DIALER_CALLS: number;
  CRM_CALLS: number;
  TOTAL_CALLS: number;
}

interface AgentReportState {
  agentName: string;
  data: DispoData[];
  summary: {
    grandTotal: { dialer: number; crm: number; total: number };
    ansCalls: { dialer: number; crm: number; total: number };
    prospect: { dialer: number; crm: number; total: number };
    ratio: { dialer: string; crm: string; total: string };
  };
}

const DISPO_ORDER = [
  "ALREADY PAID",
  "BUSY",
  "CALL BACK",
  "INTERESTED",
  "INTRODUCTION",
  "LANGUAGE ISSUE",
  "NEED UPDATE",
  "NOT INTERESTED",
  "NOT PICKUP",
  "OTHER",
  "SCRAP",
  "UNDISPOSED",
];

const getDispoRowStyle = (dispo: string) => {
  switch (dispo) {
    case "INTERESTED":
    case "INTRODUCTION":
      return "bg-[#92D050] text-black";
    case "NOT INTERESTED":
      return "bg-[#C65911] text-white";
    default:
      return "";
  }
};

export const AgentReport: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [agents, setAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [report, setReport] = useState<AgentReportState | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [tempAgent, setTempAgent] = useState("");
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  useEffect(() => {
    // Load all agents from all branches
    loadAllAgents();
  }, []);

  const loadAllAgents = async () => {
    try {
      const branches = ["AHM", "NOIDA", "CHENNAI"];
      const allAgents: string[] = [];
      for (const branch of branches) {
        const response = await agent.getAgentList(branch);
        allAgents.push(...(response.data.agents || []));
      }
      // Remove duplicates and sort
      const uniqueAgents = [...new Set(allAgents)].sort();
      setAgents(uniqueAgents);
    } catch (error) {
      console.error("Failed to load agents:", error);
    }
  };

  const loadReport = async () => {
    if (!selectedAgent) {
      alert("Please select an agent");
      return;
    }

    setLoading(true);
    try {
      const response = await agent.getDispoReport(
        selectedAgent,
        startDate,
        endDate
      );
      setReport(response.data);
    } catch (error) {
      console.error("Failed to load report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setSelectedAgent(tempAgent);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);

    if (tempAgent) {
      setTimeout(() => {
        loadReportWithParams(tempAgent, tempStartDate, tempEndDate);
      }, 0);
    }
  };

  const loadReportWithParams = async (
    agentName: string,
    start: string,
    end: string
  ) => {
    setLoading(true);
    try {
      const response = await agent.getDispoReport(agentName, start, end);
      setReport(response.data);
    } catch (error) {
      console.error("Failed to load report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    const today = new Date().toISOString().split("T")[0];
    setTempAgent("");
    setTempStartDate(today);
    setTempEndDate(today);
  };

  const handleDownload = async () => {
    if (!report) return;

    setDownloading(true);
    try {
      const response = await downloads.downloadAgentDispoExcel(
        report.data,
        report.agentName,
        user?.id || "",
        report.summary,
        startDate,
        endDate
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${report.agentName}_Dispo_Report.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error("Failed to download:", error);
      alert("Failed to download report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const hasActiveFilters = selectedAgent !== "";

  // Format date for title
  const formatDateForTitle = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const suffix =
      day === 1 || day === 21 || day === 31
        ? "ST"
        : day === 2 || day === 22
        ? "ND"
        : day === 3 || day === 23
        ? "RD"
        : "TH";
    const month = date
      .toLocaleString("en-US", { month: "short" })
      .toUpperCase();
    const year = date.getFullYear();
    return `${day}${suffix} ${month} ${year}`;
  };

  return (
    <div className="space-y-6 px-4 md:px-8 w-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <div>
          <h1
            className={`text-2xl font-bold uppercase ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            AGENT DISPO REPORT
          </h1>
          {selectedAgent && (
            <p
              className={`text-sm ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Agent: {selectedAgent} | {formatDateForTitle(startDate)} -{" "}
              {formatDateForTitle(endDate)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <FilterButton
            onClick={() => {
              setTempAgent(selectedAgent);
              setTempStartDate(startDate);
              setTempEndDate(endDate);
              setFilterOpen(true);
            }}
            hasFilters={hasActiveFilters}
          />
          <button
            onClick={loadReport}
            disabled={loading || !selectedAgent}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            Generate
          </button>
        </div>
      </div>

      {/* Filter Sidebar - Removed branch filter */}
      <FilterSidebar
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Agent Report Filters"
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      >
        <div className="space-y-4">
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                isDark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              <User className="w-4 h-4 inline mr-1" />
              Select Agent
            </label>
            <select
              value={tempAgent}
              onChange={(e) => setTempAgent(e.target.value)}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDark
                  ? "bg-slate-700 border-slate-600 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
            >
              <option value="">-- Select Agent --</option>
              {agents.map((agentName) => (
                <option key={agentName} value={agentName}>
                  {agentName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                isDark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={tempStartDate}
              onChange={(e) => setTempStartDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDark
                  ? "bg-slate-700 border-slate-600 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
            />
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                isDark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={tempEndDate}
              onChange={(e) => setTempEndDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              min={tempStartDate}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDark
                  ? "bg-slate-700 border-slate-600 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
            />
          </div>
        </div>
      </FilterSidebar>

      {/* Centered loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <RefreshCw
            className={`w-12 h-12 animate-spin mb-4 ${
              isDark ? "text-yellow-400" : "text-yellow-500"
            }`}
          />
          <p
            className={`text-lg font-medium ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Loading report...
          </p>
        </div>
      )}

      {/* Report Table - Disposition format like image */}
      {report && !loading && (
        <div className="space-y-4">
          <div className="overflow-x-auto border rounded-lg shadow-md w-full border-[#002060]">
            <table className="w-full table-auto">
              <thead>
                {/* Title Row */}
                <tr className="bg-[#002060]">
                  <th
                    colSpan={5}
                    className="px-4 py-3 text-center text-white font-bold text-lg"
                  >
                    DISPO REPORT OF {formatDateForTitle(startDate)}
                    {startDate !== endDate &&
                      ` - ${formatDateForTitle(endDate)}`}{" "}
                    ({report.agentName})
                  </th>
                </tr>
                {/* Header Row */}
                <tr className="bg-[#002060]">
                  <th className="border border-slate-500 px-3 py-2 text-center text-sm font-bold text-white w-16">
                    SR NO
                  </th>
                  <th className="border border-slate-500 px-3 py-2 text-center text-sm font-bold text-white">
                    DISPO
                  </th>
                  <th className="border border-slate-500 px-3 py-2 text-center text-sm font-bold text-white">
                    DIALER CALLS
                  </th>
                  <th className="border border-slate-500 px-3 py-2 text-center text-sm font-bold text-white">
                    CRM CALLS
                  </th>
                  <th className="border border-slate-500 px-3 py-2 text-center text-sm font-bold text-white">
                    TOTAL CALLS
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.data.map((row, index) => (
                  <tr key={index} className={getDispoRowStyle(row.DISPO)}>
                    <td
                      className={`border px-3 py-2 text-center text-sm ${
                        getDispoRowStyle(row.DISPO)
                          ? ""
                          : isDark
                          ? "border-slate-600 text-slate-200"
                          : "border-slate-300 text-slate-900"
                      }`}
                    >
                      {index + 1}
                    </td>
                    <td
                      className={`border px-3 py-2 text-center text-sm font-medium ${
                        getDispoRowStyle(row.DISPO)
                          ? ""
                          : isDark
                          ? "border-slate-600 text-slate-200"
                          : "border-slate-300 text-slate-900"
                      }`}
                    >
                      {row.DISPO}
                    </td>
                    <td
                      className={`border px-3 py-2 text-center text-sm ${
                        getDispoRowStyle(row.DISPO)
                          ? ""
                          : isDark
                          ? "border-slate-600 text-slate-200"
                          : "border-slate-300 text-slate-900"
                      }`}
                    >
                      {row.DIALER_CALLS}
                    </td>
                    <td
                      className={`border px-3 py-2 text-center text-sm ${
                        getDispoRowStyle(row.DISPO)
                          ? ""
                          : isDark
                          ? "border-slate-600 text-slate-200"
                          : "border-slate-300 text-slate-900"
                      }`}
                    >
                      {row.CRM_CALLS}
                    </td>
                    <td
                      className={`border px-3 py-2 text-center text-sm font-bold ${
                        getDispoRowStyle(row.DISPO)
                          ? ""
                          : isDark
                          ? "border-slate-600 text-slate-200"
                          : "border-slate-300 text-slate-900"
                      }`}
                    >
                      {row.TOTAL_CALLS}
                    </td>
                  </tr>
                ))}
                {/* Grand Total */}
                <tr className="bg-[#002060] text-white font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-3 py-2 text-center"
                  >
                    GRAND TOTAL
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.grandTotal.dialer}
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.grandTotal.crm}
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.grandTotal.total}
                  </td>
                </tr>
                {/* Ans Calls */}
                <tr className="bg-[#C65911] text-white font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-3 py-2 text-center"
                  >
                    ANS CALLS
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.ansCalls.dialer}
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.ansCalls.crm}
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.ansCalls.total}
                  </td>
                </tr>
                {/* Prospect */}
                <tr className="bg-[#92D050] text-black font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-3 py-2 text-center"
                  >
                    PROSPECT
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.prospect.dialer}
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.prospect.crm}
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.prospect.total}
                  </td>
                </tr>
                {/* Ratio */}
                <tr className="bg-[#00B0F0] text-white font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-3 py-2 text-center"
                  >
                    RATIO
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.ratio.dialer}
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.ratio.crm}
                  </td>
                  <td className="border border-slate-500 px-3 py-2 text-center">
                    {report.summary.ratio.total}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-start gap-4 pt-6">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 font-semibold hover:bg-green-700 transition disabled:opacity-50 rounded-lg"
            >
              <Download className="w-5 h-5" />
              {downloading ? "Downloading..." : "Download Excel"}
            </button>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <User
            className={`w-16 h-16 mb-4 ${
              isDark ? "text-slate-600" : "text-slate-300"
            }`}
          />
          <p
            className={`text-lg ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Click "Filters" to select an agent, date range, then apply to
            generate report
          </p>
        </div>
      )}
    </div>
  );
};
