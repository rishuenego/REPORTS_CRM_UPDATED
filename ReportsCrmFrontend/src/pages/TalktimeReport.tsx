"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { talktime, downloads } from "../api/client";
import { RefreshCw, Download, Calendar, X, Clock, Check } from "lucide-react";
import { FilterSidebar, FilterButton } from "../components/FilterSidebar";
import { reportCache } from "../utils/reportCache";

interface ReportData {
  NAME: string;
  ANS_CALLS: number;
  MISSED_CALLS: number;
  TOTAL_CALLS: number;
  TALK_TIME: string;
  PROSPECT: number;
  CRM_CALLS?: number;
  CRM_PROSPECT?: number;
}

interface ReportState {
  branch: string;
  data: ReportData[];
  grandTotals: {
    ansCalls: number;
    missedCalls: number;
    totalCalls: number;
    talkTime: string;
    prospect: number;
    crmCalls?: number;
    crmProspect?: number;
    grandProspect?: number;
    grandCalls?: number;
  };
  lastUpdated?: number;
}

export const TalktimeReport: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [selectedBranches, setSelectedBranches] = useState<string[]>(["NOIDA"]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reportType, setReportType] = useState<"DIALER" | "CRM" | "MASTER">(
    "DIALER"
  );
  const [report, setReport] = useState<ReportState | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [tempBranches, setTempBranches] = useState<string[]>(selectedBranches);
  const [tempDate, setTempDate] = useState(selectedDate);
  const [tempReportType, setTempReportType] = useState<
    "DIALER" | "CRM" | "MASTER"
  >(reportType);

  const [showThresholdDialog, setShowThresholdDialog] = useState(false);
  const [thresholdHours, setThresholdHours] = useState("0");
  const [thresholdMinutes, setThresholdMinutes] = useState("30");
  const [thresholdSeconds, setThresholdSeconds] = useState("0");

  const branches = ["AHM", "NOIDA", "CHENNAI"];

  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const getCacheKey = (filters: any) => {
    return `talktime_${reportType}_${filters.branch}_${filters.date}`;
  };

  useEffect(() => {
    const cacheKey = getCacheKey({
      branch: selectedBranches,
      date: selectedDate,
    });
    const cachedReport = reportCache.getWithExpiry(cacheKey);

    if (cachedReport) {
      setReport(cachedReport.data);
      setLastUpdated(cachedReport.timestamp);
      setLoading(false);
    }
  }, []);

  const handleBranchToggle = (branch: string) => {
    setTempBranches((prev) => {
      if (prev.includes(branch)) {
        // Don't allow deselecting if it's the last one
        if (prev.length === 1) return prev;
        return prev.filter((b) => b !== branch);
      }
      return [...prev, branch];
    });
  };

  const loadReport = async (
    branchesParam?: string[],
    date?: string,
    type?: "DIALER" | "CRM" | "MASTER",
    fromCache = false
  ) => {
    const branchesToFetch = branchesParam || selectedBranches;
    const dateToFetch = date || selectedDate;
    const typeToFetch = type || reportType;
    if (!fromCache) {
      setLoading(true);
    }

    try {
      // Fetch reports for all selected branches
      const responses = await Promise.all(
        branchesToFetch.map((branch) =>
          talktime.getReport(branch, dateToFetch, typeToFetch)
        )
      );

      // Merge all data
      const mergedData: ReportData[] = [];
      let totalAnsCalls = 0;
      let totalMissedCalls = 0;
      let totalCalls = 0;
      let totalProspect = 0;
      let totalCrmCalls = 0;
      let totalCrmProspect = 0;
      let totalDuration = 0;

      responses.forEach((response) => {
        const reportData = response.data;

        reportData.data.forEach((row: ReportData) => {
          mergedData.push(row);
        });

        totalAnsCalls += reportData.grandTotals.ansCalls || 0;
        totalMissedCalls += reportData.grandTotals.missedCalls || 0;
        totalCalls += reportData.grandTotals.totalCalls || 0;
        totalProspect += reportData.grandTotals.prospect || 0;
        totalCrmCalls += reportData.grandTotals.crmCalls || 0;
        totalCrmProspect += reportData.grandTotals.crmProspect || 0;

        // Parse talktime
        if (reportData.grandTotals.talkTime) {
          const timeParts = reportData.grandTotals.talkTime.split(":");
          if (timeParts.length === 3) {
            totalDuration +=
              Number.parseInt(timeParts[0]) * 3600 +
              Number.parseInt(timeParts[1]) * 60 +
              Number.parseInt(timeParts[2]);
          }
        }
      });

      // Format merged talktime
      const hours = Math.floor(totalDuration / 3600);
      const minutes = Math.floor((totalDuration % 3600) / 60);
      const seconds = totalDuration % 60;
      const mergedTalkTime = `${hours}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(seconds).padStart(2, "0")}`;

      // Sort by talktime descending for DIALER, by total calls for others
      mergedData.sort((a, b) => {
        if (typeToFetch === "DIALER") {
          const aTime =
            a.TALK_TIME?.split(":").reduce(
              (acc, t, i) => acc + Number.parseInt(t) * [3600, 60, 1][i],
              0
            ) || 0;
          const bTime =
            b.TALK_TIME?.split(":").reduce(
              (acc, t, i) => acc + Number.parseInt(t) * [3600, 60, 1][i],
              0
            ) || 0;
          return bTime - aTime;
        }
        return (b.TOTAL_CALLS || 0) - (a.TOTAL_CALLS || 0);
      });

      const reportData = {
        branch: branchesToFetch.join(" + "),
        data: mergedData,
        grandTotals: {
          ansCalls: totalAnsCalls,
          missedCalls: totalMissedCalls,
          totalCalls: totalCalls,
          talkTime: mergedTalkTime,
          prospect: totalProspect,
          crmCalls: totalCrmCalls,
          crmProspect: totalCrmProspect,
          grandProspect: totalProspect + totalCrmProspect,
          grandCalls: totalCalls + totalCrmCalls,
        },
        lastUpdated: Date.now(),
      };

      setReport(reportData);

      const cacheKey = getCacheKey({
        branch: branchesToFetch,
        date: dateToFetch,
      });
      reportCache.set(cacheKey, reportData, {
        branch: branchesToFetch,
        date: dateToFetch,
      });

      setLastUpdated(Date.now());
    } catch (error) {
      console.error("Failed to load report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setSelectedBranches(tempBranches);
    setSelectedDate(tempDate);
    setReportType(tempReportType);
    loadReport(tempBranches, tempDate, tempReportType);
  };

  const handleResetFilters = () => {
    const today = new Date().toISOString().split("T")[0];
    setTempBranches(["NOIDA"]);
    setTempDate(today);
    setTempReportType("DIALER");
  };

  const handleDownloadClick = () => {
    if (reportType === "DIALER") {
      setShowThresholdDialog(true);
    } else {
      handleDownload();
    }
  };

  const handleDownload = async (threshold?: string) => {
    if (!report) return;

    setDownloading(true);
    setShowThresholdDialog(false);

    const thresholdValue = reportType === "DIALER" ? threshold : undefined;

    try {
      const response = await downloads.downloadTalktimeExcel(
        report.data,
        report.branch,
        user?.id || "",
        report.grandTotals,
        thresholdValue,
        reportType
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const dateStr = selectedDate.replace(/-/g, "");
      link.setAttribute(
        "download",
        `${report.branch.replace(
          / \+ /g,
          "_"
        )}_${reportType}_Report_${dateStr}.xlsx`
      );
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

  const handleThresholdSubmit = () => {
    const h = Number.parseInt(thresholdHours) || 0;
    const m = Number.parseInt(thresholdMinutes) || 0;
    const s = Number.parseInt(thresholdSeconds) || 0;
    const threshold = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(
      2,
      "0"
    )}`;
    handleDownload(threshold);
  };

  const getRowColorByIndex = (index: number, total: number) => {
    const position = (index / total) * 100;
    return position < 50
      ? isDark
        ? "bg-green-900/30"
        : "bg-green-100"
      : isDark
      ? "bg-red-900/30"
      : "bg-red-100";
  };

  const hasActiveFilters =
    selectedBranches.length !== 1 ||
    selectedBranches[0] !== "NOIDA" ||
    selectedDate !== new Date().toISOString().split("T")[0] ||
    reportType !== "DIALER";

  const getReportTitle = () => {
    const dateFormatted = new Date(selectedDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const branchLabel = selectedBranches.join(" + ");
    switch (reportType) {
      case "CRM":
        return `${branchLabel} CRM CALL REPORT OF ${dateFormatted}`;
      case "MASTER":
        return `${branchLabel} MASTER CALL REPORT OF ${dateFormatted}`;
      default:
        return `${branchLabel} DIALER TALK TIME REPORT OF ${dateFormatted}`;
    }
  };

  const formatDateForTitle = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleRefresh = () => {
    const cacheKey = getCacheKey({
      branch: selectedBranches,
      date: selectedDate,
    });
    reportCache.clear(cacheKey);
    loadReport(selectedBranches, selectedDate);
  };

  return (
    <div className="space-y-4 px-3 md:px-6 w-full">
      {/* Threshold Dialog */}
      {showThresholdDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`${
              isDark ? "bg-slate-800" : "bg-white"
            } rounded-xl p-6 max-w-md w-full shadow-2xl`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3
                className={`text-lg font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                <Clock className="inline w-5 h-5 mr-2 text-yellow-500" />
                Set Talktime Threshold
              </h3>
              <button
                onClick={() => setShowThresholdDialog(false)}
                className={`p-1 rounded hover:bg-slate-200 ${
                  isDark ? "hover:bg-slate-700" : ""
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p
              className={`text-sm mb-4 ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              Enter the minimum talktime threshold. Agents will be color-coded
              in the Excel:
            </p>

            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-green-500"></span>
                <span
                  className={`text-sm ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Above threshold
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-red-500"></span>
                <span
                  className={`text-sm ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Below threshold
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  Hours
                </label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={thresholdHours}
                  onChange={(e) => setThresholdHours(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-center font-mono text-lg ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  Minutes
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={thresholdMinutes}
                  onChange={(e) => setThresholdMinutes(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-center font-mono text-lg ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  Seconds
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={thresholdSeconds}
                  onChange={(e) => setThresholdSeconds(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-center font-mono text-lg ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowThresholdDialog(false)}
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  isDark
                    ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                    : "border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleThresholdSubmit}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
              >
                Download Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1
            className={`text-xl sm:text-2xl font-bold uppercase ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {getReportTitle()}
          </h1>
          <p
            className={`text-sm ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Report Type: {reportType} | Date:{" "}
            {new Date(selectedDate).toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
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
        <div className="flex items-center gap-3">
          <FilterButton
            onClick={() => {
              setTempBranches(selectedBranches);
              setTempDate(selectedDate);
              setTempReportType(reportType);
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
              className={`block text-sm font-medium mb-2 ${
                isDark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              Report Type
            </label>
            <select
              value={tempReportType}
              onChange={(e) =>
                setTempReportType(e.target.value as "DIALER" | "CRM" | "MASTER")
              }
              className={`w-full px-4 py-2 rounded-lg border ${
                isDark
                  ? "bg-slate-700 border-slate-600 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
            >
              <option value="DIALER">DIALER REPORT</option>
              <option value="CRM">CRM REPORT</option>
              <option value="MASTER">MASTER REPORT</option>
            </select>
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                isDark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              Branch (Select at least one)
            </label>
            <div className="space-y-2">
              {branches.map((branch) => (
                <label
                  key={branch}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                    tempBranches.includes(branch)
                      ? "bg-yellow-400/20 border border-yellow-400"
                      : isDark
                      ? "bg-slate-700 border border-slate-600 hover:bg-slate-600"
                      : "bg-white border border-slate-300 hover:bg-slate-50"
                  }`}
                  onClick={() => handleBranchToggle(branch)} // Added onClick here
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center ${
                      tempBranches.includes(branch)
                        ? "bg-yellow-400"
                        : isDark
                        ? "bg-slate-600"
                        : "bg-slate-200"
                    }`}
                  >
                    {tempBranches.includes(branch) && (
                      <Check className="w-3 h-3 text-slate-900" />
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {branch}
                  </span>
                </label>
              ))}
            </div>
            {tempBranches.length > 1 && (
              <p
                className={`text-xs mt-2 ${
                  isDark ? "text-yellow-400" : "text-yellow-600"
                }`}
              >
                Reports will be merged from {tempBranches.join(" + ")}
              </p>
            )}
          </div>

          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                isDark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-1" />
              Report Date
            </label>
            <input
              type="date"
              value={tempDate}
              onChange={(e) => setTempDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className={`w-full px-4 py-2 rounded-lg border ${
                isDark
                  ? "bg-slate-700 border-slate-600 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
            />
          </div>
        </div>
      </FilterSidebar>

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

      {report && !loading && (
        <div className="space-y-3">
          <div className="overflow-x-auto border rounded-md shadow-md border-[#002060]">
            <table className="w-full table-auto border-collapse text-xs">
              <thead>
                {reportType === "MASTER" ? (
                  <>
                    <tr className="bg-[#002060]">
                      <th
                        rowSpan={2}
                        className="border border-slate-500 px-2 py-2 text-center text-xs font-bold text-white w-12"
                      >
                        SR NO
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-500 px-2 py-2 text-center text-xs font-bold text-white"
                      >
                        NAME
                      </th>
                      <th
                        colSpan={5}
                        className="border border-slate-500 px-2 py-2 text-center text-xs font-bold text-white bg-yellow-500"
                      >
                        DIALER
                      </th>
                      <th
                        colSpan={2}
                        className="border border-slate-500 px-2 py-2 text-center text-xs font-bold text-white bg-green-600"
                      >
                        CRM
                      </th>
                      <th
                        colSpan={2}
                        className="border border-slate-500 px-2 py-2 text-center text-xs font-bold text-white bg-blue-600"
                      >
                        GRAND TOTAL
                      </th>
                    </tr>
                    <tr className="bg-[#002060]">
                      <th className="border border-slate-500 px-1 py-1 text-center text-xs font-bold text-white">
                        ANS
                      </th>
                      <th className="border border-slate-500 px-1 py-1 text-center text-xs font-bold text-white">
                        MISSED
                      </th>
                      <th className="border border-slate-500 px-1 py-1 text-center text-xs font-bold text-white">
                        PROSPECT
                      </th>
                      <th className="border border-slate-500 px-1 py-1 text-center text-xs font-bold text-white">
                        TALKTIME
                      </th>
                      <th className="border border-slate-500 px-1 py-1 text-center text-xs font-bold text-white">
                        TOTAL
                      </th>
                      <th className="border border-slate-500 px-1 py-1 text-center text-xs font-bold text-white">
                        CALLS
                      </th>
                      <th className="border border-slate-500 px-1 py-1 text-center text-xs font-bold text-white">
                        PROSPECT
                      </th>
                      <th className="border border-slate-500 px-1 py-1 text-center text-xs font-bold text-white">
                        PROSPECT
                      </th>
                      <th className="border border-slate-500 px-1 py-1 text-center text-xs font-bold text-white">
                        CALLS
                      </th>
                    </tr>
                  </>
                ) : reportType === "CRM" ? (
                  <tr className="bg-yellow-400">
                    <th className="border border-yellow-500 px-2 py-2 text-left text-sm font-bold text-slate-900 w-12">
                      SR NO.
                    </th>
                    <th className="border border-yellow-500 px-2 py-2 text-left text-sm font-bold text-slate-900">
                      NAME
                    </th>
                    <th className="border border-yellow-500 px-2 py-2 text-center text-sm font-bold text-slate-900">
                      CRM CALLS
                    </th>
                    <th className="border border-yellow-500 px-2 py-2 text-center text-sm font-bold text-slate-900">
                      PROSPECT
                    </th>
                    <th className="border border-yellow-500 px-2 py-2 text-center text-sm font-bold text-slate-900">
                      TOTAL
                    </th>
                  </tr>
                ) : (
                  <tr className="bg-yellow-400">
                    <th className="border border-yellow-500 px-2 py-2 text-left text-sm font-bold text-slate-900 w-12">
                      SR NO.
                    </th>
                    <th className="border border-yellow-500 px-2 py-2 text-left text-sm font-bold text-slate-900">
                      NAME
                    </th>
                    <th className="border border-yellow-500 px-2 py-2 text-center text-sm font-bold text-slate-900">
                      ANS CALLS
                    </th>
                    <th className="border border-yellow-500 px-2 py-2 text-center text-sm font-bold text-slate-900">
                      MISSED CALLS
                    </th>
                    <th className="border border-yellow-500 px-2 py-2 text-center text-sm font-bold text-slate-900">
                      TOTAL CALLS
                    </th>
                    <th className="border border-yellow-500 px-2 py-2 text-center text-sm font-bold text-slate-900">
                      PROSPECT
                    </th>
                    <th className="border border-yellow-500 px-2 py-2 text-center text-sm font-bold text-slate-900">
                      TALK TIME
                    </th>
                  </tr>
                )}
              </thead>
              <tbody>
                {report.data.map((row, index) => (
                  <tr
                    key={index}
                    className={getRowColorByIndex(index, report.data.length)}
                  >
                    {reportType === "MASTER" ? (
                      <>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {index + 1}
                        </td>
                        <td
                          className={`border px-2 py-1 text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.NAME}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.ANS_CALLS}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.MISSED_CALLS}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.PROSPECT || 0}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.TALK_TIME || "0:00:00"}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.TOTAL_CALLS}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.CRM_CALLS || 0}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.CRM_PROSPECT || 0}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm font-bold ${
                            isDark
                              ? "border-slate-600 text-blue-400"
                              : "border-slate-300 text-blue-600"
                          }`}
                        >
                          {(row.PROSPECT || 0) + (row.CRM_PROSPECT || 0)}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm font-bold ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.TOTAL_CALLS + (row.CRM_CALLS || 0)}
                        </td>
                      </>
                    ) : reportType === "CRM" ? (
                      <>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {index + 1}
                        </td>
                        <td
                          className={`border px-2 py-1 text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.NAME}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.CRM_CALLS || row.ANS_CALLS || 0}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm font-bold ${
                            isDark
                              ? "border-slate-600 text-blue-400"
                              : "border-slate-300 text-blue-600"
                          }`}
                        >
                          {row.CRM_PROSPECT || row.PROSPECT || 0}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm font-bold ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.CRM_CALLS || row.TOTAL_CALLS || 0}
                        </td>
                      </>
                    ) : (
                      <>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {index + 1}
                        </td>
                        <td
                          className={`border px-2 py-1 text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.NAME}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.ANS_CALLS}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.MISSED_CALLS}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.TOTAL_CALLS}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm font-bold ${
                            isDark
                              ? "border-slate-600 text-blue-400"
                              : "border-slate-300 text-blue-600"
                          }`}
                        >
                          {row.PROSPECT || 0}
                        </td>
                        <td
                          className={`border px-2 py-1 text-center text-sm font-bold ${
                            isDark
                              ? "border-slate-600 text-slate-200"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          {row.TALK_TIME}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr className="bg-yellow-400 font-bold">
                  {reportType === "MASTER" ? (
                    <>
                      <td
                        colSpan={2}
                        className="border border-yellow-500 px-2 py-2 text-slate-900"
                      >
                        GRAND TOTAL
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.ansCalls}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.missedCalls}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.prospect}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.talkTime || "0:00:00"}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.totalCalls}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.crmCalls || 0}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.crmProspect || 0}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.grandProspect || 0}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.grandCalls || 0}
                      </td>
                    </>
                  ) : reportType === "CRM" ? (
                    <>
                      <td
                        colSpan={2}
                        className="border border-yellow-500 px-2 py-2 text-slate-900"
                      >
                        GRAND TOTAL
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.crmCalls ||
                          report.grandTotals.ansCalls}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.crmProspect ||
                          report.grandTotals.prospect}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.crmCalls ||
                          report.grandTotals.totalCalls}
                      </td>
                    </>
                  ) : (
                    <>
                      <td
                        colSpan={2}
                        className="border border-yellow-500 px-2 py-2 text-slate-900"
                      >
                        GRAND TOTAL
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.ansCalls}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.missedCalls}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.totalCalls}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.prospect || 0}
                      </td>
                      <td className="border border-yellow-500 px-2 py-2 text-center text-slate-900">
                        {report.grandTotals.talkTime}
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-start gap-4 pt-4">
            <button
              onClick={handleDownloadClick}
              disabled={downloading}
              className="flex items-center gap-2 bg-green-600 text-white px-4 sm:px-6 py-3 font-semibold hover:bg-green-700 transition disabled:opacity-50 rounded-lg"
            >
              <Download className="w-5 h-5" />
              {downloading ? "Downloading..." : "Download Excel"}
            </button>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Calendar
            className={`w-16 h-16 mb-4 ${
              isDark ? "text-slate-600" : "text-slate-300"
            }`}
          />
          <p
            className={`text-lg text-center ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Click "Filters" to select branch and date, then apply to load report
          </p>
        </div>
      )}
    </div>
  );
};
