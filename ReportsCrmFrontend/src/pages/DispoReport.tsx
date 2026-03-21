"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { dispo, downloads } from "../api/client";
import { RefreshCw, Download, Calendar } from "lucide-react";
import { FilterSidebar, FilterButton } from "../components/FilterSidebar";
import { reportCache } from "../utils/reportCache";

interface DispoData {
  DISPO: string;
  DIALER_CALLS: number;
  CRM_CALLS: number;
  TOTAL_CALLS: number;
}

interface MergedDispoData {
  DISPO: string;
  AHMEDABAD: number;
  CHENNAI: number;
  NOIDA: number;
  TOTAL_CALLS: number;
}

interface DispoReportState {
  branch: string;
  date: string;
  data: DispoData[];
  summary: {
    grandTotal: { dialer: number; crm: number; total: number };
    ansCalls: { dialer: number; crm: number; total: number };
    prospect: { dialer: number; crm: number; total: number };
    ratio: { dialer: string; crm: string; total: string };
    pickupRatio: { dialer: string; crm: string; total: string };
    uniqueAgents: number;
  };
  lastUpdated?: number;
}

interface MergedReportState {
  date: string;
  data: MergedDispoData[];
  summary: {
    grandTotal: {
      ahmedabad: number;
      chennai: number;
      noida: number;
      total: number;
    };
    ansCalls: {
      ahmedabad: number;
      chennai: number;
      noida: number;
      total: number;
    };
    prospect: {
      ahmedabad: number;
      chennai: number;
      noida: number;
      total: number;
    };
    ratio: {
      ahmedabad: string;
      chennai: string;
      noida: string;
      total: string;
    };
    pickupRatio: {
      ahmedabad: string;
      chennai: string;
      noida: string;
      total: string;
    };
    uniqueAgents: {
      ahmedabad: number;
      chennai: number;
      noida: number;
      total: number;
    };
  };
  lastUpdated?: number;
}

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

export const DispoReport: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedFilter, setSelectedFilter] = useState<string>("NORMAL");
  const [report, setReport] = useState<DispoReportState | null>(null);
  const [mergedReport, setMergedReport] = useState<MergedReportState | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [tempDate, setTempDate] = useState(selectedDate);
  const [tempFilter, setTempFilter] = useState<string>("NORMAL");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const filterOptions = [
    { value: "NOIDA", label: "NOIDA" },
    { value: "AHMEDABAD", label: "AHMEDABAD" },
    { value: "CHENNAI", label: "CHENNAI" },
    { value: "MERGED", label: "MERGED REPORT" },
    { value: "NORMAL", label: "NORMAL (All Combined)" },
  ];

  const getCacheKey = (filter: string, date: string) => {
    return `dispo_${filter}_${date}`;
  };

  useEffect(() => {
    const cacheKey = getCacheKey(selectedFilter, selectedDate);
    const cachedReport = reportCache.getWithExpiry(cacheKey);

    if (cachedReport) {
      if (selectedFilter === "MERGED") {
        setMergedReport(cachedReport.data);
        setReport(null);
      } else {
        setReport(cachedReport.data);
        setMergedReport(null);
      }
      setLastUpdated(cachedReport.timestamp);
      setLoading(false);
    }
  }, []);

  const loadReport = async (date?: string, filter?: string) => {
    const dateToFetch = date || selectedDate;
    const filterToFetch = filter || selectedFilter;
    setLoading(true);

    try {
      if (filterToFetch === "MERGED") {
        const response = await dispo.getMergedReport(dateToFetch);
        const reportData = {
          ...response.data,
          lastUpdated: Date.now(),
        };
        setMergedReport(reportData);
        setReport(null);

        const cacheKey = getCacheKey(filterToFetch, dateToFetch);
        reportCache.set(cacheKey, reportData, {
          date: dateToFetch,
          filter: filterToFetch,
        });
      } else {
        const branchParam = filterToFetch === "NORMAL" ? "ALL" : filterToFetch;
        const response = await dispo.getReport(branchParam, dateToFetch);
        const reportData = {
          ...response.data,
          lastUpdated: Date.now(),
        };
        setReport(reportData);
        setMergedReport(null);

        const cacheKey = getCacheKey(filterToFetch, dateToFetch);
        reportCache.set(cacheKey, reportData, {
          date: dateToFetch,
          filter: filterToFetch,
        });
      }

      setLastUpdated(Date.now());
    } catch (error) {
      console.error("Failed to load report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setSelectedDate(tempDate);
    setSelectedFilter(tempFilter);
    loadReport(tempDate, tempFilter);
    setFilterOpen(false);
  };

  const handleResetFilters = () => {
    const today = new Date().toISOString().split("T")[0];
    setTempDate(today);
    setTempFilter("NORMAL");
  };

  const handleDownload = async () => {
    if (!report && !mergedReport) return;

    setDownloading(true);
    try {
      if (selectedFilter === "MERGED" && mergedReport) {
        const response = await downloads.downloadMergedDispoExcel(
          mergedReport.data,
          user?.id || "",
          mergedReport.summary,
          selectedDate,
        );
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        const dateStr = selectedDate.replace(/-/g, "");
        link.setAttribute("download", `Merged_Dispo_Report_${dateStr}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (report) {
        const branchLabel =
          selectedFilter === "NORMAL" ? "ALL" : selectedFilter;
        const response = await downloads.downloadDispoExcel(
          report.data,
          branchLabel,
          user?.id || "",
          report.summary,
          selectedDate,
        );
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        const dateStr = selectedDate.replace(/-/g, "");
        link.setAttribute(
          "download",
          `${branchLabel}_Dispo_Report_${dateStr}.xlsx`,
        );
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to download:", error);
      alert("Failed to download report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleRefresh = () => {
    const cacheKey = getCacheKey(selectedFilter, selectedDate);
    reportCache.clear(cacheKey);
    loadReport(selectedDate, selectedFilter);
  };

  const hasActiveFilters =
    selectedDate !== new Date().toISOString().split("T")[0] ||
    selectedFilter !== "NORMAL";

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
    return `${day} ${month} ${year}`;
  };

  const getFilterLabel = () => {
    const option = filterOptions.find((o) => o.value === selectedFilter);
    return option?.label || selectedFilter;
  };

  return (
    <div className="space-y-4 px-3 md:px-6 w-full">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <div>
          <h1
            className={`text-base font-bold uppercase ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            DISPOSITION REPORT
          </h1>
          <p
            className={`text-xs ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {getFilterLabel()} | Date: {formatDateForTitle(selectedDate)}
          </p>
          {lastUpdated && (
            <p
              className={`text-xs ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Last Updated: {reportCache.formatTimestamp(lastUpdated)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FilterButton
            onClick={() => {
              setTempDate(selectedDate);
              setTempFilter(selectedFilter);
              setFilterOpen(true);
            }}
            hasFilters={hasActiveFilters}
          />
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-800 transition disabled:opacity-50 text-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Sidebar */}
      <FilterSidebar
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter Options"
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      >
        <div className="space-y-4">
          <div>
            <label
              className={`block text-xs font-medium mb-2 ${
                isDark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              Report Type
            </label>
            <select
              value={tempFilter}
              onChange={(e) => setTempFilter(e.target.value)}
              className={`w-full px-3 py-2 rounded-md border text-sm ${
                isDark
                  ? "bg-slate-700 border-slate-600 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className={`block text-xs font-medium mb-1.5 ${
                isDark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              Report Date
            </label>
            <input
              type="date"
              value={tempDate}
              onChange={(e) => setTempDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className={`w-full px-3 py-1.5 rounded-md border text-xs ${
                isDark
                  ? "bg-slate-700 border-slate-600 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
            />
          </div>
        </div>
      </FilterSidebar>

      {/* Centered Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw
            className={`w-8 h-8 animate-spin mb-3 ${
              isDark ? "text-yellow-400" : "text-yellow-500"
            }`}
          />
          <p
            className={`text-sm font-medium ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Loading report...
          </p>
        </div>
      )}

      {selectedFilter === "MERGED" && mergedReport && !loading && (
        <div className="space-y-3">
          <div className="overflow-x-auto border rounded-md shadow-md w-full border-[#002060]">
            <table className="w-full table-auto border-collapse text-xs">
              <thead>
                <tr className="bg-[#002060]">
                  <th
                    colSpan={6}
                    className="px-3 py-2 text-center text-white font-bold text-sm"
                  >
                    BRANCH WISE DISPO REPORT OF{" "}
                    {formatDateForTitle(selectedDate)} (TODAY)
                  </th>
                </tr>

                <tr className="bg-[#002060]">
                  <th className="border border-slate-500 px-1 py-1.5 text-center font-bold text-white w-12">
                    SR NO
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white w-28">
                    DISPO
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white w-20">
                    AHMEDABAD
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white w-20">
                    CHENNAI
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white w-20">
                    NOIDA
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white w-24">
                    GRAND TOTAL
                  </th>
                </tr>
              </thead>

              <tbody>
                {mergedReport.data.map((row, index) => {
                  const rowStyle = getDispoRowStyle(row.DISPO);

                  const cellClass = rowStyle
                    ? "border px-2 py-1.5 text-center"
                    : `border px-2 py-1.5 text-center ${
                        isDark
                          ? "border-slate-600 text-slate-200"
                          : "border-slate-300 text-slate-900"
                      }`;

                  return (
                    <tr key={index} className={rowStyle}>
                      <td className="border px-1 py-1.5 text-center">
                        {index + 1}
                      </td>

                      <td className={`${cellClass} font-medium`}>
                        {row.DISPO}
                      </td>

                      <td className={cellClass}>{row.AHMEDABAD}</td>
                      <td className={cellClass}>{row.CHENNAI}</td>
                      <td className={cellClass}>{row.NOIDA}</td>

                      <td className={`${cellClass} font-bold`}>
                        {row.TOTAL_CALLS}
                      </td>
                    </tr>
                  );
                })}

                {/* GRAND TOTAL */}
                <tr className="bg-[#F79646] text-black font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    GRAND TOTAL
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.grandTotal.ahmedabad}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.grandTotal.chennai}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.grandTotal.noida}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.grandTotal.total}
                  </td>
                </tr>

                {/* ANS CALLS */}
                <tr className="bg-[#FFFF00] text-black font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    ANS CALLS
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.ansCalls.ahmedabad}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.ansCalls.chennai}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.ansCalls.noida}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.ansCalls.total}
                  </td>
                </tr>

                {/* PROSPECT */}
                <tr className="bg-[#00B0F0] text-black font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    PROSPECT
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.prospect.ahmedabad}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.prospect.chennai}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.prospect.noida}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.prospect.total}
                  </td>
                </tr>

                {/* RATIO */}
                <tr className="bg-[#F79646] text-black font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    RATIO
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.ratio.ahmedabad}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.ratio.chennai}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.ratio.noida}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.ratio.total}
                  </td>
                </tr>

                {/* PICKUP RATIO */}
                <tr className="bg-[#FF0000] text-black font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    PICKUP RATIO
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.pickupRatio.ahmedabad}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.pickupRatio.chennai}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.pickupRatio.noida}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.pickupRatio.total}
                  </td>
                </tr>

                {/* UNIQUE AGENTS */}
                <tr className="bg-[#00B0F0] text-black font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    UNIQUE AGENTS
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.uniqueAgents?.ahmedabad || 0}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.uniqueAgents?.chennai || 0}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.uniqueAgents?.noida || 0}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {mergedReport.summary.uniqueAgents?.total || 0}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-start gap-3 pt-4">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 font-semibold hover:bg-green-700 transition disabled:opacity-50 rounded-md text-xs"
            >
              <Download className="w-4 h-4" />
              {downloading ? "Downloading..." : "Download Excel"}
            </button>
          </div>
        </div>
      )}

      {selectedFilter !== "MERGED" && report && !loading && (
        <div className="space-y-3">
          <div
            className={`overflow-x-auto border rounded-md shadow-md w-full border-[#002060]`}
          >
            <table className="w-full table-auto border-collapse text-xs">
              <thead>
                <tr className="bg-[#002060]">
                  <th
                    colSpan={5}
                    className="px-3 py-2 text-center text-white font-bold text-sm"
                  >
                    DISPO REPORT OF {formatDateForTitle(selectedDate)} -{" "}
                    {getFilterLabel().toUpperCase()}
                  </th>
                </tr>
                <tr className="bg-[#002060]">
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white w-12">
                    SR NO
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white w-28">
                    DISPO
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white bg-yellow-500 w-24">
                    DIALER CALLS
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white bg-green-600 w-20">
                    CRM CALLS
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white bg-blue-600 w-24">
                    TOTAL CALLS
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.data.map((row, index) => (
                  <tr key={index} className={getDispoRowStyle(row.DISPO)}>
                    <td
                      className={`border px-2 py-1.5 text-center ${
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
                      className={`border px-2 py-1.5 text-center font-medium ${
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
                      className={`border px-2 py-1.5 text-center ${
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
                      className={`border px-2 py-1.5 text-center ${
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
                      className={`border px-2 py-1.5 text-center font-bold ${
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
                {/* Summary rows */}
                <tr className="bg-[#002060] text-white font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    GRAND TOTAL
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.grandTotal.dialer}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.grandTotal.crm}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.grandTotal.total}
                  </td>
                </tr>
                <tr className="bg-[#C65911] text-white font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    ANS CALLS
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.ansCalls.dialer}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.ansCalls.crm}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.ansCalls.total}
                  </td>
                </tr>
                <tr className="bg-[#92D050] text-black font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    PROSPECT
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.prospect.dialer}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.prospect.crm}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.prospect.total}
                  </td>
                </tr>
                <tr className="bg-[#00B0F0] text-white font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    RATIO
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.ratio.dialer}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.ratio.crm}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.ratio.total}
                  </td>
                </tr>
                <tr className="bg-[#FF0000] text-black font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    PICKUP RATIO
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.pickupRatio.dialer}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.pickupRatio.crm}
                  </td>
                  <td className="border border-slate-500 px-2 py-1.5 text-center">
                    {report.summary.pickupRatio.total}
                  </td>
                </tr>
                <tr className="bg-[#00B0F0] text-black font-bold">
                  <td
                    colSpan={2}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    UNIQUE AGENTS
                  </td>
                  <td
                    colSpan={3}
                    className="border border-slate-500 px-2 py-1.5 text-center"
                  >
                    {report.summary.uniqueAgents || 0}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-start gap-3 pt-4">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 font-semibold hover:bg-green-700 transition disabled:opacity-50 rounded-md text-xs"
            >
              <Download className="w-4 h-4" />
              {downloading ? "Downloading..." : "Download Excel"}
            </button>
          </div>
        </div>
      )}

      {!report && !mergedReport && !loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Calendar
            className={`w-12 h-12 mb-3 ${
              isDark ? "text-slate-600" : "text-slate-300"
            }`}
          />
          <p
            className={`text-sm ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Click "Filters" to select date and report type, then apply to load
            report
          </p>
        </div>
      )}
    </div>
  );
};
