"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";
import {
  RefreshCw,
  Download,
  Calendar,
  Check,
  CreditCard,
  IndianRupee,
  CheckCircle,
  Clock,
  FileText,
  BarChart3,
} from "lucide-react";
import { FilterSidebar, FilterButton } from "../components/FilterSidebar";

interface PaymentData {
  employee_name: string;
  amount: number;
  date: string;
  status: "received" | "pending";
}

interface ReportState {
  data: PaymentData[];
  summary: {
    totalReceived: number;
    totalPending: number;
    totalAmount: number;
    count: number;
  };
}

interface MonthlyPaymentStatusData {
  branch: string;
  total_link_generated: number;
  rec_amount: number;
  pending: number;
}

interface MonthlyPaymentStatusReport {
  data: MonthlyPaymentStatusData[];
  totals: {
    total_link_generated: number;
    rec_amount: number;
    pending: number;
  };
  month: number;
  year: number;
}

interface DailyPaymentStatusData {
  branch: string;
  total_link_generated: number;
  rec_amount: number;
  pending: number;
}

interface DailyPaymentStatusReport {
  data: DailyPaymentStatusData[];
  totals: {
    total_link_generated: number;
    rec_amount: number;
    pending: number;
  };
  date: string;
}

interface PaymentStatusData {
  date: string;
  ahm_link_generated: number;
  ahm_rec_amount: number;
  chennai_link_generated: number;
  chennai_rec_amount: number;
  noida_link_generated: number;
  noida_rec_amount: number;
  total_link_generated: number;
  total_rec_amount: number;
  pending: number;
}

interface PaymentStatusReport {
  data: PaymentStatusData[];
  grandTotals: {
    ahm_link_generated: number;
    ahm_rec_amount: number;
    chennai_link_generated: number;
    chennai_rec_amount: number;
    noida_link_generated: number;
    noida_rec_amount: number;
    total_link_generated: number;
    total_rec_amount: number;
    pending: number;
  };
}

export const PaymentLinks: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === "dark";

  const [reportType, setReportType] = useState<
    "payment_links" | "payment_status" | "monthly_status" | "daily_status"
  >("payment_links");
  const [tempReportType, setTempReportType] = useState<
    "payment_links" | "payment_status" | "monthly_status" | "daily_status"
  >("payment_links");

  const [selectedBranches, setSelectedBranches] = useState<string[]>(["NOIDA"]);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showPaid, setShowPaid] = useState(true);
  const [showPending, setShowPending] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState(selectedMonth);
  const [tempYear, setTempYear] = useState(selectedYear);

  const [selectedDay, setSelectedDay] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [tempDay, setTempDay] = useState(selectedDay);

  const [report, setReport] = useState<ReportState | null>(null);
  const [statusReport, setStatusReport] = useState<PaymentStatusReport | null>(
    null
  );
  const [monthlyReport, setMonthlyReport] =
    useState<MonthlyPaymentStatusReport | null>(null);
  const [dailyReport, setDailyReport] =
    useState<DailyPaymentStatusReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tempBranches, setTempBranches] = useState<string[]>(selectedBranches);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const [tempShowPaid, setTempShowPaid] = useState(showPaid);
  const [tempShowPending, setTempShowPending] = useState(showPending);

  const branches = ["AHM", "NOIDA", "CHENNAI"];

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  useEffect(() => {
    loadReport();
  }, []);

  const handleBranchToggle = (branch: string) => {
    setTempBranches((prev) => {
      if (prev.includes(branch)) {
        if (prev.length === 1) return prev;
        return prev.filter((b) => b !== branch);
      }
      return [...prev, branch];
    });
  };

  const loadReport = async (
    branchesParam?: string[],
    start?: string,
    end?: string,
    paid?: boolean,
    pending?: boolean,
    type?:
      | "payment_links"
      | "payment_status"
      | "monthly_status"
      | "daily_status",
    month?: number,
    year?: number,
    day?: string
  ) => {
    const branchesToFetch = branchesParam || selectedBranches;
    const startToFetch = start || startDate;
    const endToFetch = end || endDate;
    const paidFilter = paid !== undefined ? paid : showPaid;
    const pendingFilter = pending !== undefined ? pending : showPending;
    const currentType = type || reportType;
    const monthToFetch = month || selectedMonth;
    const yearToFetch = year || selectedYear;
    const dayToFetch = day || selectedDay;

    setLoading(true);
    setError(null);

    try {
      if (currentType === "monthly_status") {
        const response = await apiClient.get("/payment-links/monthly-status", {
          params: {
            month: monthToFetch,
            year: yearToFetch,
          },
        });

        if (response.data) {
          setMonthlyReport(response.data);
          setReport(null);
          setStatusReport(null);
          setDailyReport(null);
        }
      } else if (currentType === "daily_status") {
        const response = await apiClient.get("/payment-links/daily-status", {
          params: {
            date: dayToFetch,
          },
        });

        if (response.data) {
          setDailyReport(response.data);
          setReport(null);
          setStatusReport(null);
          setMonthlyReport(null);
        }
      } else if (currentType === "payment_status") {
        const response = await apiClient.get("/payment-links/status-report", {
          params: {
            startDate: startToFetch,
            endDate: endToFetch,
          },
        });

        if (response.data && response.data.data) {
          setStatusReport(response.data);
          setReport(null);
          setMonthlyReport(null);
          setDailyReport(null);
        } else {
          throw new Error("Invalid response format");
        }
      } else {
        const response = await apiClient.get("/payment-links/report", {
          params: {
            branches: branchesToFetch.join(","),
            startDate: startToFetch,
            endDate: endToFetch,
            showPaid: paidFilter,
            showPending: pendingFilter,
          },
        });
        setReport(response.data);
        setStatusReport(null);
        setMonthlyReport(null);
        setDailyReport(null);
      }
    } catch (err: any) {
      console.error("Failed to load report:", err);
      setError(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setSelectedBranches(tempBranches);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setShowPaid(tempShowPaid);
    setShowPending(tempShowPending);
    setReportType(tempReportType);
    setSelectedMonth(tempMonth);
    setSelectedYear(tempYear);
    setSelectedDay(tempDay);
    setFilterOpen(false);
    loadReport(
      tempBranches,
      tempStartDate,
      tempEndDate,
      tempShowPaid,
      tempShowPending,
      tempReportType,
      tempMonth,
      tempYear,
      tempDay
    );
  };

  const handleResetFilters = () => {
    const firstDay = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    )
      .toISOString()
      .split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    setTempBranches(["NOIDA"]);
    setTempStartDate(firstDay);
    setTempEndDate(today);
    setTempShowPaid(true);
    setTempShowPending(true);
    setTempReportType("payment_links");
    setTempMonth(new Date().getMonth() + 1);
    setTempYear(new Date().getFullYear());
    setTempDay(today);
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);

    try {
      if (reportType === "monthly_status" && monthlyReport) {
        const response = await apiClient.post(
          "/payment-links/download-monthly-status",
          {
            data: monthlyReport.data,
            totals: monthlyReport.totals,
            month: selectedMonth,
            year: selectedYear,
            user_id: user?.id || "",
          },
          {
            responseType: "blob",
            headers: {
              Accept:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          }
        );

        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `Payment_Link_Report_${
            monthNames[selectedMonth - 1]
          }_${selectedYear}.xlsx`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (reportType === "daily_status" && dailyReport) {
        const response = await apiClient.post(
          "/payment-links/download-daily-status",
          {
            data: dailyReport.data,
            totals: dailyReport.totals,
            date: selectedDay,
            user_id: user?.id || "",
          },
          {
            responseType: "blob",
            headers: {
              Accept:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          }
        );

        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const dateFormatted = new Date(selectedDay)
          .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
          .replace(" ", "-");
        link.setAttribute(
          "download",
          `Payment_Link_Report_${dateFormatted}.xlsx`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (reportType === "payment_status") {
        if (!statusReport || statusReport.data.length === 0) {
          throw new Error("No data available to download");
        }

        const response = await apiClient.post(
          "/payment-links/download-status",
          {
            data: statusReport.data,
            grandTotals: statusReport.grandTotals,
            startDate,
            endDate,
            user_id: user?.id || "",
          },
          {
            responseType: "blob",
            headers: {
              Accept:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          }
        );

        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `Payment_Status_Report_${startDate}_to_${endDate}.xlsx`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        if (!report || report.data.length === 0) {
          throw new Error("No data available to download");
        }

        const response = await apiClient.post(
          "/payment-links/download",
          {
            data: report.data,
            summary: report.summary,
            branches: selectedBranches.join(" + "),
            startDate,
            endDate,
            user_id: user?.id || "",
          },
          {
            responseType: "blob",
            headers: {
              Accept:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          }
        );

        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `Payment_Links_Report_${startDate}_to_${endDate}.xlsx`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error("Failed to download:", err);
      setError(err.message || "Failed to download report");
      alert(err.message || "Failed to download report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const formatIndianCurrency = (amount: number) => {
    if (amount === 0) return "";
    const formatted = amount.toLocaleString("en-IN");
    return `₹ ${formatted}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return `${date.getDate()}-${date.toLocaleString("en-US", {
      month: "short",
    })}`;
  };

  const hasActiveFilters =
    selectedBranches.length !== 1 ||
    selectedBranches[0] !== "NOIDA" ||
    !showPaid ||
    !showPending ||
    reportType !== "payment_links";

  const getReportTitle = () => {
    switch (reportType) {
      case "monthly_status":
        return `PAYMENT LINK GENERATE REPORT ${monthNames[
          selectedMonth - 1
        ].toUpperCase()}-${selectedYear}`;
      case "daily_status":
        const date = new Date(selectedDay);
        return `PAYMENT LINK GENERATE REPORT ${date
          .getDate()
          .toString()
          .padStart(2, "0")}-${monthNames[date.getMonth()]
          .toUpperCase()
          .slice(0, 3)}`;
      case "payment_status":
        return "Payment Status Report";
      default:
        return "Payment Links Generated";
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1
            className={`text-base sm:text-lg font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {reportType === "payment_status" ? (
              <>
                <BarChart3 className="inline w-4 h-4 mr-1.5 text-blue-500" />
                Payment Status Report
              </>
            ) : reportType === "monthly_status" ||
              reportType === "daily_status" ? (
              <>
                <CreditCard className="inline w-4 h-4 mr-1.5 text-green-600" />
                Payment Link Generated
              </>
            ) : (
              <>
                <CreditCard className="inline w-4 h-4 mr-1.5 text-yellow-500" />
                Payment Links Generated
              </>
            )}
          </h1>
          <p
            className={`text-xs ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {reportType === "payment_status"
              ? `All Branches | ${formatDate(startDate)} - ${formatDate(
                  endDate
                )}`
              : reportType === "monthly_status"
              ? `Monthly Report | ${
                  monthNames[selectedMonth - 1]
                } ${selectedYear}`
              : reportType === "daily_status"
              ? `Daily Report | ${formatDate(selectedDay)}`
              : `${selectedBranches.join(" + ")} | ${formatDate(
                  startDate
                )} - ${formatDate(endDate)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterButton
            onClick={() => {
              setTempBranches(selectedBranches);
              setTempStartDate(startDate);
              setTempEndDate(endDate);
              setTempShowPaid(showPaid);
              setTempShowPending(showPending);
              setTempReportType(reportType);
              setTempMonth(selectedMonth);
              setTempYear(selectedYear);
              setTempDay(selectedDay);
              setFilterOpen(true);
            }}
            hasFilters={hasActiveFilters}
          />
          <button
            onClick={() => loadReport()}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-800 transition disabled:opacity-50 text-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-xs">
          {error}
        </div>
      )}

      {/* Stats Cards - Only for Payment Links Report */}
      {reportType === "payment_links" && report && !loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            className={`p-3 rounded-lg ${
              isDark ? "bg-slate-800" : "bg-white"
            } shadow-md`}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-blue-500/20 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div>
                <p
                  className={`text-[10px] ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Total Links
                </p>
                <p
                  className={`text-base font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {report.summary.count}
                </p>
              </div>
            </div>
          </div>
          <div
            className={`p-3 rounded-lg ${
              isDark ? "bg-slate-800" : "bg-white"
            } shadow-md`}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              </div>
              <div>
                <p
                  className={`text-[10px] ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Received
                </p>
                <p
                  className={`text-base font-bold ${
                    isDark ? "text-green-400" : "text-green-600"
                  }`}
                >
                  {formatCurrency(report.summary.totalReceived)}
                </p>
              </div>
            </div>
          </div>
          <div
            className={`p-3 rounded-lg ${
              isDark ? "bg-slate-800" : "bg-white"
            } shadow-md`}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-yellow-500" />
              </div>
              <div>
                <p
                  className={`text-[10px] ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Pending
                </p>
                <p
                  className={`text-base font-bold ${
                    isDark ? "text-yellow-400" : "text-yellow-600"
                  }`}
                >
                  {formatCurrency(report.summary.totalPending)}
                </p>
              </div>
            </div>
          </div>
          <div
            className={`p-3 rounded-lg ${
              isDark ? "bg-slate-800" : "bg-white"
            } shadow-md`}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-purple-500/20 flex items-center justify-center">
                <IndianRupee className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div>
                <p
                  className={`text-[10px] ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Total Amount
                </p>
                <p
                  className={`text-base font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {formatCurrency(report.summary.totalAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              Report Type
            </label>
            <div className="space-y-1.5">
              <label
                onClick={() => setTempReportType("payment_links")}
                className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition text-xs ${
                  tempReportType === "payment_links"
                    ? "bg-yellow-400/20 border border-yellow-400"
                    : isDark
                    ? "bg-slate-700 border border-slate-600 hover:bg-slate-600"
                    : "bg-white border border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    tempReportType === "payment_links"
                      ? "bg-yellow-400"
                      : isDark
                      ? "bg-slate-600"
                      : "bg-slate-200"
                  }`}
                >
                  {tempReportType === "payment_links" && (
                    <Check className="w-2.5 h-2.5 text-slate-900" />
                  )}
                </div>
                <span
                  className={`font-medium ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Payment Links
                </span>
              </label>
              <label
                onClick={() => setTempReportType("payment_status")}
                className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition text-xs ${
                  tempReportType === "payment_status"
                    ? "bg-blue-400/20 border border-blue-400"
                    : isDark
                    ? "bg-slate-700 border border-slate-600 hover:bg-slate-600"
                    : "bg-white border border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    tempReportType === "payment_status"
                      ? "bg-blue-400"
                      : isDark
                      ? "bg-slate-600"
                      : "bg-slate-200"
                  }`}
                >
                  {tempReportType === "payment_status" && (
                    <Check className="w-2.5 h-2.5 text-white" />
                  )}
                </div>
                <span
                  className={`font-medium ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Payment Status (Daily Breakdown)
                </span>
              </label>
              <label
                onClick={() => setTempReportType("monthly_status")}
                className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition text-xs ${
                  tempReportType === "monthly_status"
                    ? "bg-green-400/20 border border-green-400"
                    : isDark
                    ? "bg-slate-700 border border-slate-600 hover:bg-slate-600"
                    : "bg-white border border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    tempReportType === "monthly_status"
                      ? "bg-green-500"
                      : isDark
                      ? "bg-slate-600"
                      : "bg-slate-200"
                  }`}
                >
                  {tempReportType === "monthly_status" && (
                    <Check className="w-2.5 h-2.5 text-white" />
                  )}
                </div>
                <span
                  className={`font-medium ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Monthly Report (Branch Summary)
                </span>
              </label>
              <label
                onClick={() => setTempReportType("daily_status")}
                className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition text-xs ${
                  tempReportType === "daily_status"
                    ? "bg-green-400/20 border border-green-400"
                    : isDark
                    ? "bg-slate-700 border border-slate-600 hover:bg-slate-600"
                    : "bg-white border border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    tempReportType === "daily_status"
                      ? "bg-green-500"
                      : isDark
                      ? "bg-slate-600"
                      : "bg-slate-200"
                  }`}
                >
                  {tempReportType === "daily_status" && (
                    <Check className="w-2.5 h-2.5 text-white" />
                  )}
                </div>
                <span
                  className={`font-medium ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Daily Report (Branch Summary)
                </span>
              </label>
            </div>
          </div>

          {tempReportType === "monthly_status" && (
            <div>
              <label
                className={`block text-xs font-medium mb-1.5 ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Select Month & Year
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={tempMonth}
                  onChange={(e) => setTempMonth(Number(e.target.value))}
                  className={`w-full px-2 py-1.5 rounded-md border text-xs ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                >
                  {monthNames.map((month, index) => (
                    <option key={index} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
                <select
                  value={tempYear}
                  onChange={(e) => setTempYear(Number(e.target.value))}
                  className={`w-full px-2 py-1.5 rounded-md border text-xs ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                >
                  {[2024, 2025, 2026].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tempReportType === "daily_status" && (
            <div>
              <label
                className={`block text-xs font-medium mb-1.5 ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Select Date
              </label>
              <input
                type="date"
                value={tempDay}
                onChange={(e) => setTempDay(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className={`w-full px-2 py-1.5 rounded-md border text-xs ${
                  isDark
                    ? "bg-slate-700 border-slate-600 text-white"
                    : "bg-white border-slate-300 text-slate-900"
                }`}
              />
            </div>
          )}

          {/* Branch Checkboxes - Only show for Payment Links */}
          {tempReportType === "payment_links" && (
            <div>
              <label
                className={`block text-xs font-medium mb-1.5 ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Branch (Select at least one)
              </label>
              <div className="space-y-1.5">
                {branches.map((branch) => (
                  <label
                    key={branch}
                    onClick={() => handleBranchToggle(branch)}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition text-xs ${
                      tempBranches.includes(branch)
                        ? "bg-yellow-400/20 border border-yellow-400"
                        : isDark
                        ? "bg-slate-700 border border-slate-600 hover:bg-slate-600"
                        : "bg-white border border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center ${
                        tempBranches.includes(branch)
                          ? "bg-yellow-400"
                          : isDark
                          ? "bg-slate-600"
                          : "bg-slate-200"
                      }`}
                    >
                      {tempBranches.includes(branch) && (
                        <Check className="w-2.5 h-2.5 text-slate-900" />
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
            </div>
          )}

          {/* Date Range - Only for payment_links and payment_status */}
          {(tempReportType === "payment_links" ||
            tempReportType === "payment_status") && (
            <div>
              <label
                className={`block text-xs font-medium mb-1.5 ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label
                    className={`text-[10px] ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    From
                  </label>
                  <input
                    type="date"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    className={`w-full px-2 py-1.5 rounded-md border text-xs ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-white border-slate-300 text-slate-900"
                    }`}
                  />
                </div>
                <div>
                  <label
                    className={`text-[10px] ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    To
                  </label>
                  <input
                    type="date"
                    value={tempEndDate}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    className={`w-full px-2 py-1.5 rounded-md border text-xs ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-white border-slate-300 text-slate-900"
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Status Checkboxes - Only show for Payment Links */}
          {tempReportType === "payment_links" && (
            <div>
              <label
                className={`block text-xs font-medium mb-1.5 ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Payment Status
              </label>
              <div className="space-y-1.5">
                <label
                  onClick={() => setTempShowPaid(!tempShowPaid)}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition text-xs ${
                    tempShowPaid
                      ? "bg-green-500/20 border border-green-500"
                      : isDark
                      ? "bg-slate-700 border border-slate-600"
                      : "bg-white border border-slate-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center ${
                      tempShowPaid
                        ? "bg-green-500"
                        : isDark
                        ? "bg-slate-600"
                        : "bg-slate-200"
                    }`}
                  >
                    {tempShowPaid && (
                      <Check className="w-2.5 h-2.5 text-white" />
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Received / Paid
                  </span>
                </label>
                <label
                  onClick={() => setTempShowPending(!tempShowPending)}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition text-xs ${
                    tempShowPending
                      ? "bg-yellow-500/20 border border-yellow-500"
                      : isDark
                      ? "bg-slate-700 border border-slate-600"
                      : "bg-white border border-slate-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center ${
                      tempShowPending
                        ? "bg-yellow-500"
                        : isDark
                        ? "bg-slate-600"
                        : "bg-slate-200"
                    }`}
                  >
                    {tempShowPending && (
                      <Check className="w-2.5 h-2.5 text-white" />
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Pending
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      </FilterSidebar>

      {/* Loading */}
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

      {reportType === "monthly_status" && monthlyReport && !loading && (
        <div className="space-y-3">
          <div className="overflow-x-auto border-2 border-black rounded-md shadow-md">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#92D050]">
                  <th
                    colSpan={5}
                    className="border-2 border-black px-3 py-2 text-center text-black font-bold text-base"
                  >
                    {getReportTitle()}
                  </th>
                </tr>
                <tr className="bg-[#92D050]">
                  <th className="border-2 border-black px-3 py-2 text-center font-bold text-black w-16">
                    SR NO
                  </th>
                  <th className="border-2 border-black px-3 py-2 text-center font-bold text-black w-32">
                    BRANCH
                  </th>
                  <th className="border-2 border-black px-3 py-2 text-center font-bold text-black">
                    TOTAL LINK GENRATED
                  </th>
                  <th className="border-2 border-black px-3 py-2 text-center font-bold text-black">
                    REC AMOUNT
                  </th>
                  <th className="border-2 border-black px-3 py-2 text-center font-bold text-black">
                    PENDING
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthlyReport.data.map((row, index) => (
                  <tr key={index} className="bg-white">
                    <td className="border-2 border-black px-3 py-2 text-center text-black">
                      {index + 1}
                    </td>
                    <td className="border-2 border-black px-3 py-2 text-center font-bold text-black">
                      {row.branch}
                    </td>
                    <td className="border-2 border-black px-3 py-2 text-center text-black">
                      {formatIndianCurrency(row.total_link_generated)}
                    </td>
                    <td className="border-2 border-black px-3 py-2 text-center text-black">
                      {formatIndianCurrency(row.rec_amount)}
                    </td>
                    <td className="border-2 border-black px-3 py-2 text-center text-black">
                      {formatIndianCurrency(row.pending)}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-[#92D050] font-bold">
                  <td className="border-2 border-black px-3 py-2 text-center text-black"></td>
                  <td className="border-2 border-black px-3 py-2 text-center text-black">
                    TOTAL
                  </td>
                  <td className="border-2 border-black px-3 py-2 text-center text-black">
                    {formatIndianCurrency(
                      monthlyReport.totals.total_link_generated
                    )}
                  </td>
                  <td className="border-2 border-black px-3 py-2 text-center text-black">
                    {formatIndianCurrency(monthlyReport.totals.rec_amount)}
                  </td>
                  <td className="border-2 border-black px-3 py-2 text-center text-black">
                    {formatIndianCurrency(monthlyReport.totals.pending)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-start gap-3 pt-2">
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

      {reportType === "daily_status" && dailyReport && !loading && (
        <div className="space-y-3">
          <div className="overflow-x-auto border-2 border-black rounded-md shadow-md">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#92D050]">
                  <th
                    colSpan={5}
                    className="border-2 border-black px-3 py-2 text-center text-black font-bold text-base"
                  >
                    {getReportTitle()}
                  </th>
                </tr>
                <tr className="bg-[#92D050]">
                  <th className="border-2 border-black px-3 py-2 text-center font-bold text-black w-16">
                    SR NO
                  </th>
                  <th className="border-2 border-black px-3 py-2 text-center font-bold text-black w-32">
                    BRANCH
                  </th>
                  <th className="border-2 border-black px-3 py-2 text-center font-bold text-black">
                    TOTAL LINK GENRATED
                  </th>
                  <th className="border-2 border-black px-3 py-2 text-center font-bold text-black">
                    REC AMOUNT
                  </th>
                  <th className="border-2 border-black px-3 py-2 text-center font-bold text-black">
                    PENDING
                  </th>
                </tr>
              </thead>
              <tbody>
                {dailyReport.data.map((row, index) => (
                  <tr key={index} className="bg-white">
                    <td className="border-2 border-black px-3 py-2 text-center text-black">
                      {index + 1}
                    </td>
                    <td className="border-2 border-black px-3 py-2 text-center font-bold text-black">
                      {row.branch}
                    </td>
                    <td className="border-2 border-black px-3 py-2 text-center text-black">
                      {formatIndianCurrency(row.total_link_generated)}
                    </td>
                    <td className="border-2 border-black px-3 py-2 text-center text-black">
                      {formatIndianCurrency(row.rec_amount)}
                    </td>
                    <td className="border-2 border-black px-3 py-2 text-center text-black">
                      {formatIndianCurrency(row.pending)}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-[#92D050] font-bold">
                  <td className="border-2 border-black px-3 py-2 text-center text-black"></td>
                  <td className="border-2 border-black px-3 py-2 text-center text-black">
                    TOTAL
                  </td>
                  <td className="border-2 border-black px-3 py-2 text-center text-black">
                    {formatIndianCurrency(
                      dailyReport.totals.total_link_generated
                    )}
                  </td>
                  <td className="border-2 border-black px-3 py-2 text-center text-black">
                    {formatIndianCurrency(dailyReport.totals.rec_amount)}
                  </td>
                  <td className="border-2 border-black px-3 py-2 text-center text-black">
                    {formatIndianCurrency(dailyReport.totals.pending)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-start gap-3 pt-2">
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

      {/* Payment Status Report Table (Date-wise breakdown) */}
      {reportType === "payment_status" && statusReport && !loading && (
        <div className="space-y-3">
          <div
            className={`overflow-x-auto border rounded-md shadow-md ${
              isDark ? "border-green-500/50" : "border-green-500"
            }`}
          >
            <table className="w-full table-auto min-w-[900px] text-xs">
              <thead>
                {/* Main Header */}
                <tr className="bg-[#92D050]">
                  <th
                    colSpan={11}
                    className="border border-slate-400 px-2 py-1.5 text-center text-sm font-bold text-black"
                  >
                    PAYMENT STATUS
                  </th>
                </tr>
                {/* Location Headers */}
                <tr>
                  <th
                    className="border border-slate-400 px-2 py-1.5 text-center font-bold text-black bg-[#92D050]"
                    rowSpan={2}
                  >
                    SR NO.
                  </th>
                  <th
                    className="border border-slate-400 px-2 py-1.5 text-center font-bold text-black bg-[#92D050]"
                    rowSpan={2}
                  >
                    DATE
                  </th>
                  <th
                    colSpan={2}
                    className="border border-slate-400 px-2 py-1 text-center font-bold text-black bg-[#FFFF00]"
                  >
                    AHMEDABAD
                  </th>
                  <th
                    colSpan={2}
                    className="border border-slate-400 px-2 py-1 text-center font-bold text-black bg-[#FFFF00]"
                  >
                    CHENNAI
                  </th>
                  <th
                    colSpan={2}
                    className="border border-slate-400 px-2 py-1 text-center font-bold text-black bg-[#FFFF00]"
                  >
                    NOIDA
                  </th>
                  <th
                    colSpan={3}
                    className="border border-slate-400 px-2 py-1 text-center font-bold text-black bg-[#FFFF00]"
                  >
                    TOTAL
                  </th>
                </tr>
                {/* Sub Headers */}
                <tr className="bg-[#92D050]">
                  <th className="border border-slate-400 px-1.5 py-1 text-center text-[10px] font-bold text-black">
                    LINK GENRATED
                  </th>
                  <th className="border border-slate-400 px-1.5 py-1 text-center text-[10px] font-bold text-black">
                    REC AMOUNT
                  </th>
                  <th className="border border-slate-400 px-1.5 py-1 text-center text-[10px] font-bold text-black">
                    LINK GENRATED
                  </th>
                  <th className="border border-slate-400 px-1.5 py-1 text-center text-[10px] font-bold text-black">
                    REC AMOUNT
                  </th>
                  <th className="border border-slate-400 px-1.5 py-1 text-center text-[10px] font-bold text-black">
                    LINK GENRATED
                  </th>
                  <th className="border border-slate-400 px-1.5 py-1 text-center text-[10px] font-bold text-black">
                    REC AMOUNT
                  </th>
                  <th className="border border-slate-400 px-1.5 py-1 text-center text-[10px] font-bold text-black">
                    LINK GENRATED
                  </th>
                  <th className="border border-slate-400 px-1.5 py-1 text-center text-[10px] font-bold text-black">
                    REC AMOUNT
                  </th>
                  <th className="border border-slate-400 px-1.5 py-1 text-center text-[10px] font-bold text-black">
                    PENDING
                  </th>
                </tr>
              </thead>
              <tbody>
                {statusReport.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className={`border px-2 py-6 text-center ${
                        isDark
                          ? "border-slate-600 text-slate-400"
                          : "border-slate-300 text-slate-500"
                      }`}
                    >
                      No data found for the selected date range
                    </td>
                  </tr>
                ) : (
                  statusReport.data.map((row, index) => (
                    <tr
                      key={index}
                      className={
                        index % 2 === 0
                          ? isDark
                            ? "bg-slate-800"
                            : "bg-white"
                          : isDark
                          ? "bg-slate-700/50"
                          : "bg-slate-50"
                      }
                    >
                      <td
                        className={`border px-1.5 py-1.5 text-center ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {index + 1}
                      </td>
                      <td
                        className={`border px-1.5 py-1.5 text-center ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {formatShortDate(row.date)}
                      </td>
                      <td
                        className={`border px-1.5 py-1.5 text-center ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {row.ahm_link_generated > 0
                          ? formatCurrency(row.ahm_link_generated)
                          : ""}
                      </td>
                      <td
                        className={`border px-1.5 py-1.5 text-center ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {row.ahm_rec_amount > 0
                          ? formatCurrency(row.ahm_rec_amount)
                          : ""}
                      </td>
                      <td
                        className={`border px-1.5 py-1.5 text-center ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {row.chennai_link_generated > 0
                          ? formatCurrency(row.chennai_link_generated)
                          : ""}
                      </td>
                      <td
                        className={`border px-1.5 py-1.5 text-center ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {row.chennai_rec_amount > 0
                          ? formatCurrency(row.chennai_rec_amount)
                          : ""}
                      </td>
                      <td
                        className={`border px-1.5 py-1.5 text-center ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {row.noida_link_generated > 0
                          ? formatCurrency(row.noida_link_generated)
                          : ""}
                      </td>
                      <td
                        className={`border px-1.5 py-1.5 text-center ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {row.noida_rec_amount > 0
                          ? formatCurrency(row.noida_rec_amount)
                          : ""}
                      </td>
                      <td
                        className={`border px-1.5 py-1.5 text-center font-bold ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {formatCurrency(row.total_link_generated)}
                      </td>
                      <td
                        className={`border px-1.5 py-1.5 text-center font-bold ${
                          isDark
                            ? "border-slate-600 text-green-400"
                            : "border-slate-300 text-green-600"
                        }`}
                      >
                        {row.total_rec_amount > 0
                          ? formatCurrency(row.total_rec_amount)
                          : ""}
                      </td>
                      <td
                        className={`border px-1.5 py-1.5 text-center font-bold ${
                          isDark
                            ? "border-slate-600 text-red-400"
                            : "border-slate-300 text-red-600"
                        }`}
                      >
                        {formatCurrency(row.pending)}
                      </td>
                    </tr>
                  ))
                )}
                {/* Grand Total Row */}
                {statusReport.data.length > 0 && (
                  <tr className="bg-[#00B0F0] font-bold text-white">
                    <td
                      colSpan={2}
                      className="border border-slate-400 px-1.5 py-1.5 text-center"
                    >
                      GRAND TOTAL
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1.5 text-center">
                      {formatCurrency(
                        statusReport.grandTotals.ahm_link_generated
                      )}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1.5 text-center">
                      {statusReport.grandTotals.ahm_rec_amount > 0
                        ? formatCurrency(
                            statusReport.grandTotals.ahm_rec_amount
                          )
                        : ""}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1.5 text-center">
                      {formatCurrency(
                        statusReport.grandTotals.chennai_link_generated
                      )}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1.5 text-center">
                      {statusReport.grandTotals.chennai_rec_amount > 0
                        ? formatCurrency(
                            statusReport.grandTotals.chennai_rec_amount
                          )
                        : ""}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1.5 text-center">
                      {formatCurrency(
                        statusReport.grandTotals.noida_link_generated
                      )}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1.5 text-center">
                      {statusReport.grandTotals.noida_rec_amount > 0
                        ? formatCurrency(
                            statusReport.grandTotals.noida_rec_amount
                          )
                        : ""}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1.5 text-center">
                      {formatCurrency(
                        statusReport.grandTotals.total_link_generated
                      )}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1.5 text-center">
                      {formatCurrency(
                        statusReport.grandTotals.total_rec_amount
                      )}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1.5 text-center">
                      {formatCurrency(statusReport.grandTotals.pending)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-start gap-3 pt-2">
            <button
              onClick={handleDownload}
              disabled={
                downloading || !statusReport || statusReport.data.length === 0
              }
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 font-semibold hover:bg-green-700 transition disabled:opacity-50 rounded-md text-xs"
            >
              <Download className="w-4 h-4" />
              {downloading ? "Downloading..." : "Download Excel"}
            </button>
          </div>
        </div>
      )}

      {/* Payment Links Report Table */}
      {reportType === "payment_links" && report && !loading && (
        <div className="space-y-3">
          <div
            className={`overflow-x-auto border rounded-md shadow-md ${
              isDark ? "border-yellow-500/50" : "border-yellow-500"
            }`}
          >
            <table className="w-full table-auto text-xs">
              <thead>
                <tr className="bg-[#FACC15]">
                  <th className="border border-slate-400 px-2 py-1.5 text-center font-bold text-black">
                    SR NO.
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-center font-bold text-black">
                    EMPLOYEE NAME
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-center font-bold text-black">
                    AMOUNT
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-center font-bold text-black">
                    DATE
                  </th>
                  <th className="border border-slate-400 px-2 py-1.5 text-center font-bold text-black">
                    STATUS
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className={`border px-2 py-6 text-center ${
                        isDark
                          ? "border-slate-600 text-slate-400"
                          : "border-slate-300 text-slate-500"
                      }`}
                    >
                      No data found for the selected filters
                    </td>
                  </tr>
                ) : (
                  report.data.map((row, index) => (
                    <tr
                      key={index}
                      className={
                        index % 2 === 0
                          ? isDark
                            ? "bg-slate-800"
                            : "bg-white"
                          : isDark
                          ? "bg-slate-700/50"
                          : "bg-slate-50"
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
                        className={`border px-2 py-1.5 ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {row.employee_name || "Unknown"}
                      </td>
                      <td
                        className={`border px-2 py-1.5 text-center font-medium ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {formatCurrency(row.amount)}
                      </td>
                      <td
                        className={`border px-2 py-1.5 text-center ${
                          isDark
                            ? "border-slate-600 text-slate-200"
                            : "border-slate-300 text-slate-900"
                        }`}
                      >
                        {formatDate(row.date)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            row.status === "received"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {row.status === "received" ? "Received" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
                {/* Grand Total Row */}
                {report.data.length > 0 && (
                  <tr className="bg-[#FACC15] font-bold text-black">
                    <td
                      colSpan={2}
                      className="border border-slate-400 px-2 py-1.5 text-center"
                    >
                      GRAND TOTAL
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center">
                      {formatCurrency(report.summary.totalAmount)}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center">
                      {report.data.length} Records
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center">
                      -
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-start gap-3 pt-2">
            <button
              onClick={handleDownload}
              disabled={downloading || !report || report.data.length === 0}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 font-semibold hover:bg-green-700 transition disabled:opacity-50 rounded-md text-xs"
            >
              <Download className="w-4 h-4" />
              {downloading ? "Downloading..." : "Download Excel"}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!report &&
        !statusReport &&
        !monthlyReport &&
        !dailyReport &&
        !loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <CreditCard
              className={`w-12 h-12 mb-3 ${
                isDark ? "text-slate-600" : "text-slate-300"
              }`}
            />
            <p
              className={`text-sm ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              Click "Filters" to select report type and options, then apply to
              load report
            </p>
          </div>
        )}
    </div>
  );
};
