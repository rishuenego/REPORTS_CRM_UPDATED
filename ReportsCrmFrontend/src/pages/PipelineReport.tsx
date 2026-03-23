"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { pipeline, downloads } from "../api/client";
import { RefreshCw, Download, Calendar } from "lucide-react";
import { FilterSidebar, FilterButton } from "../components/FilterSidebar";
import { reportCache } from "../utils/reportCache";

interface PipelineData {
  STAGE: string;
  DIALER_CALLS: number;
  CRM_CALLS: number;
  TOTAL_CALLS: number;
}

interface PipelineReportState {
  branch: string;
  date: string;
  data: PipelineData[];
  summary: {
    grandTotal: { dialer: number; crm: number; total: number };
  };
  lastUpdated?: number;
}

export const PipelineReport: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [report, setReport] = useState<PipelineReportState | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [tempDate, setTempDate] = useState(selectedDate);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const getCacheKey = (date: string) => {
    return `pipeline_ALL_${date}`;
  };

  useEffect(() => {
    const cacheKey = getCacheKey(selectedDate);
    const cachedReport = reportCache.getWithExpiry(cacheKey);

    if (cachedReport) {
      setReport(cachedReport.data);
      setLastUpdated(cachedReport.timestamp);
      setLoading(false);
    }
  }, []);

  const loadReport = async (date?: string) => {
    const dateToFetch = date || selectedDate;
    setLoading(true);

    try {
      const response = await pipeline.getReport("ALL", dateToFetch);
      const reportData = {
        ...response.data,
        lastUpdated: Date.now(),
      };
      setReport(reportData);

      const cacheKey = getCacheKey(dateToFetch);
      reportCache.set(cacheKey, reportData, { date: dateToFetch });

      setLastUpdated(Date.now());
    } catch (error) {
      console.error("Failed to load report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setSelectedDate(tempDate);
    loadReport(tempDate);
  };

  const handleResetFilters = () => {
    const today = new Date().toISOString().split("T")[0];
    setTempDate(today);
  };

  const handleDownload = async () => {
    if (!report) return;

    setDownloading(true);
    try {
      const response = await downloads.downloadPipelineExcel(
        report.data,
        "ALL",
        report.summary,
        selectedDate
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const dateStr = selectedDate.replace(/-/g, "");
      link.setAttribute("download", `ALL_Pipeline_Report_${dateStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download:", error);
      alert("Failed to download report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleRefresh = () => {
    const cacheKey = getCacheKey(selectedDate);
    reportCache.clear(cacheKey);
    loadReport(selectedDate);
  };

  const hasActiveFilters =
    selectedDate !== new Date().toISOString().split("T")[0];

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
    <div className="space-y-4 px-3 md:px-6 w-full">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <div>
          <h1
            className={`text-base font-bold uppercase ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            PIPELINE REPORT
          </h1>
          <p
            className={`text-xs ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            All Branches | Date: {formatDateForTitle(selectedDate)}
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
        <div className="space-y-3">
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

      {report && !loading && (
        <div className="space-y-3">
          <div
            className={`overflow-x-auto border rounded-md shadow-md w-full border-[#002060]`}
          >
            <table className="w-full table-fixed border-collapse text-xs">
              <thead>
                <tr className="bg-[#002060]">
                  <th
                    colSpan={5}
                    className="px-3 py-2 text-center text-white font-bold text-sm"
                  >
                    PIPELINE REPORT OF {formatDateForTitle(selectedDate)} TILL
                    TIME
                  </th>
                </tr>
                <tr className="bg-[#002060]">
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white w-12">
                    SR NO
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white w-32">
                    STAGE
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white bg-yellow-500 w-20">
                    DIALER CALLS
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white bg-green-600 w-20">
                    CRM CALLS
                  </th>
                  <th className="border border-slate-500 px-2 py-1.5 text-center font-bold text-white bg-blue-600 w-20">
                    TOTAL CALLS
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.data.map((row, index) => (
                  <tr
                    key={index}
                    className={
                      index % 2 === 0
                        ? isDark
                          ? "bg-slate-700"
                          : "bg-slate-50"
                        : ""
                    }
                  >
                    <td
                      className={`border px-2 py-1.5 text-center ${
                        isDark
                          ? "border-slate-600 text-slate-200"
                          : "border-slate-300 text-slate-900"
                      }`}
                    >
                      {index + 1}
                    </td>
                    <td
                      className={`border px-2 py-1.5 text-center font-medium ${
                        isDark
                          ? "border-slate-600 text-slate-200"
                          : "border-slate-300 text-slate-900"
                      }`}
                    >
                      {row.STAGE}
                    </td>
                    <td
                      className={`border px-2 py-1.5 text-center ${
                        isDark
                          ? "border-slate-600 text-slate-200"
                          : "border-slate-300 text-slate-900"
                      }`}
                    >
                      {row.DIALER_CALLS}
                    </td>
                    <td
                      className={`border px-2 py-1.5 text-center ${
                        isDark
                          ? "border-slate-600 text-slate-200"
                          : "border-slate-300 text-slate-900"
                      }`}
                    >
                      {row.CRM_CALLS}
                    </td>
                    <td
                      className={`border px-2 py-1.5 text-center font-bold ${
                        isDark
                          ? "border-slate-600 text-slate-200"
                          : "border-slate-300 text-slate-900"
                      }`}
                    >
                      {row.TOTAL_CALLS}
                    </td>
                  </tr>
                ))}
                {/* Grand Total Row */}
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

      {!report && !loading && (
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
            Click "Filters" to select date, then apply to load report
          </p>
        </div>
      )}
    </div>
  );
};
