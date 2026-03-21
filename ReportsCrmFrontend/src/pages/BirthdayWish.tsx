"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { messaging } from "../api/client";
import {
  Cake,
  Send,
  RefreshCw,
  Calendar,
  User,
  Gift,
  PartyPopper,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Search,
  Edit2,
  X,
  Users,
  CalendarDays,
} from "lucide-react";

interface BirthdayPerson {
  name: string;
  date_of_birth: string;
  isToday: boolean;
  isTomorrow: boolean;
}

interface SendResult {
  name: string;
  success: boolean;
  message: string;
}

export const BirthdayWish: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);
  const [allBirthdays, setAllBirthdays] = useState<BirthdayPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientNumber, setRecipientNumber] = useState("+91-7303068471");
  const [messageTemplate, setMessageTemplate] = useState(
    "🎂 Birthday Reminder!\n\nHello! This is a reminder that {name}'s birthday is {when}.\n\nPlease wish them a happy birthday! 🎉"
  );
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const [viewMode, setViewMode] = useState<"today" | "all">("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<BirthdayPerson | null>(null);
  const [editBirthday, setEditBirthday] = useState("");

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

  const fetchBirthdays = useCallback(async () => {
    setLoading(true);
    try {
      const response = await messaging.getBirthdays();
      setBirthdays(response.data.birthdays || []);
      setLastFetched(new Date());
    } catch (error) {
      console.error("Failed to fetch birthdays:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllBirthdays = useCallback(async () => {
    setLoading(true);
    try {
      const response = await messaging.getAllBirthdays();
      setAllBirthdays(response.data.birthdays || []);
      setLastFetched(new Date());
    } catch (error) {
      console.error("Failed to fetch all birthdays:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBirthdays();
    fetchAllBirthdays();
  }, [fetchBirthdays, fetchAllBirthdays]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const sendBirthdayWish = async (person: BirthdayPerson) => {
    const when = person.isToday ? "today" : "tomorrow";
    const message = messageTemplate
      .replace("{name}", person.name)
      .replace("{when}", when);

    try {
      await messaging.sendBroadcast({
        users: [{ phone: recipientNumber.replace(/-/g, "").replace("+", "") }],
        message,
        mediaUrl: "",
      });
      return { name: person.name, success: true, message: "Sent successfully" };
    } catch (error: any) {
      return {
        name: person.name,
        success: false,
        message: error.message || "Failed to send",
      };
    }
  };

  const handleSendAll = async () => {
    if (birthdays.length === 0) return;

    setSending(true);
    setSendResults([]);

    const results: SendResult[] = [];
    for (const person of birthdays) {
      const result = await sendBirthdayWish(person);
      results.push(result);
    }

    setSendResults(results);
    setSending(false);
  };

  const handleSendSingle = async (person: BirthdayPerson) => {
    setSending(true);
    const result = await sendBirthdayWish(person);
    setSendResults((prev) => [
      ...prev.filter((r) => r.name !== person.name),
      result,
    ]);
    setSending(false);
  };

  const handleEditClick = (person: BirthdayPerson) => {
    setEditPerson(person);
    // Format date for input (YYYY-MM-DD)
    const date = new Date(person.date_of_birth);
    const formatted = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setEditBirthday(formatted);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editPerson || !editBirthday) return;

    try {
      await messaging.updateBirthday({
        name: editPerson.name,
        birthday: editBirthday,
      });
      setEditModalOpen(false);
      setEditPerson(null);
      // Refresh data
      fetchBirthdays();
      fetchAllBirthdays();
    } catch (error) {
      console.error("Failed to update birthday:", error);
      alert("Failed to update birthday. Please try again.");
    }
  };

  const filteredAllBirthdays = allBirthdays.filter((person) => {
    const matchesSearch = person.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const date = new Date(person.date_of_birth);
    const matchesMonth =
      selectedMonth === null || date.getMonth() === selectedMonth;
    return matchesSearch && matchesMonth;
  });

  const todayBirthdays = birthdays.filter((b) => b.isToday);
  const tomorrowBirthdays = birthdays.filter((b) => b.isTomorrow);

  return (
    <div className="space-y-4 px-3 md:px-6 w-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <div>
          <h1
            className={`text-base font-bold uppercase flex items-center gap-2 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            <Cake className="w-5 h-5 text-pink-500" />
            Birthday Wish Manager
          </h1>
          <p
            className={`text-xs ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Send birthday reminders to the designated number
          </p>
          {lastFetched && (
            <p
              className={`text-xs flex items-center gap-1 mt-1 ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              <Clock className="w-3 h-3" />
              Last updated: {lastFetched.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            fetchBirthdays();
            fetchAllBirthdays();
          }}
          disabled={loading}
          className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-800 transition disabled:opacity-50 text-xs"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("today")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${
            viewMode === "today"
              ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg"
              : isDark
              ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Today & Tomorrow
        </button>
        <button
          onClick={() => setViewMode("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${
            viewMode === "all"
              ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg"
              : isDark
              ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
          }`}
        >
          <Users className="w-4 h-4" />
          All Birthdays ({allBirthdays.length})
        </button>
      </div>

      {/* Configuration Card - Only show in Today view */}
      {viewMode === "today" && (
        <div
          className={`rounded-xl border p-4 ${
            isDark
              ? "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700"
              : "bg-gradient-to-br from-white to-slate-50 border-slate-200"
          } shadow-lg`}
        >
          <h2
            className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            <Sparkles className="w-4 h-4 text-yellow-500" />
            Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-xs font-medium mb-1.5 ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Recipient Number
              </label>
              <input
                type="text"
                value={recipientNumber}
                onChange={(e) => setRecipientNumber(e.target.value)}
                placeholder="+91-7486057373"
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? "bg-slate-700 border-slate-600 text-white"
                    : "bg-white border-slate-300 text-slate-900"
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-xs font-medium mb-1.5 ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Message Template
              </label>
              <textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={3}
                placeholder="Use {name} for name and {when} for today/tomorrow"
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? "bg-slate-700 border-slate-600 text-white"
                    : "bg-white border-slate-300 text-slate-900"
                }`}
              />
              <p
                className={`text-xs mt-1 ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Use {"{name}"} for birthday person's name and {"{when}"} for
                today/tomorrow
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats - Only show in Today view */}
      {viewMode === "today" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            className={`rounded-xl border p-4 ${
              isDark
                ? "bg-gradient-to-br from-pink-900/30 to-pink-800/20 border-pink-700/50"
                : "bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200"
            } shadow-md`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-pink-500/20">
                <Cake className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <p
                  className={`text-xs ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Today
                </p>
                <p
                  className={`text-2xl font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {todayBirthdays.length}
                </p>
              </div>
            </div>
          </div>
          <div
            className={`rounded-xl border p-4 ${
              isDark
                ? "bg-gradient-to-br from-purple-900/30 to-purple-800/20 border-purple-700/50"
                : "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200"
            } shadow-md`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20">
                <Calendar className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p
                  className={`text-xs ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Tomorrow
                </p>
                <p
                  className={`text-2xl font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {tomorrowBirthdays.length}
                </p>
              </div>
            </div>
          </div>
          <div
            className={`rounded-xl border p-4 ${
              isDark
                ? "bg-gradient-to-br from-green-900/30 to-green-800/20 border-green-700/50"
                : "bg-gradient-to-br from-green-50 to-green-100 border-green-200"
            } shadow-md`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-500/20">
                <Gift className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p
                  className={`text-xs ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Total
                </p>
                <p
                  className={`text-2xl font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {birthdays.length}
                </p>
              </div>
            </div>
          </div>
          <div
            className={`rounded-xl border p-4 ${
              isDark
                ? "bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-700/50"
                : "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200"
            } shadow-md`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20">
                <Send className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p
                  className={`text-xs ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Sent
                </p>
                <p
                  className={`text-2xl font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {sendResults.filter((r) => r.success).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send All Button - Only show in Today view */}
      {viewMode === "today" && birthdays.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={handleSendAll}
            disabled={sending || !recipientNumber}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 transition disabled:opacity-50 text-sm shadow-lg hover:shadow-xl"
          >
            <PartyPopper className="w-4 h-4" />
            {sending
              ? "Sending..."
              : `Send All Birthday Wishes (${birthdays.length})`}
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw
            className={`w-8 h-8 animate-spin mb-3 ${
              isDark ? "text-pink-400" : "text-pink-500"
            }`}
          />
          <p
            className={`text-sm font-medium ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Loading birthdays...
          </p>
        </div>
      )}

      {viewMode === "all" && !loading && (
        <div className="space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm ${
                  isDark
                    ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    : "bg-white border-slate-300 text-slate-900 placeholder-slate-500"
                }`}
              />
            </div>
            <select
              value={selectedMonth === null ? "" : selectedMonth}
              onChange={(e) =>
                setSelectedMonth(
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              className={`px-4 py-2 rounded-lg border text-sm ${
                isDark
                  ? "bg-slate-700 border-slate-600 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
            >
              <option value="">All Months</option>
              {monthNames.map((month, index) => (
                <option key={index} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          {/* All Birthdays Table */}
          <div
            className={`rounded-xl border overflow-hidden ${
              isDark
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-slate-200"
            } shadow-lg`}
          >
            <div className="p-3 border-b bg-gradient-to-r from-pink-500 to-purple-600">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                All Birthdays ({filteredAllBirthdays.length})
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead
                  className={`sticky top-0 ${
                    isDark ? "bg-slate-700" : "bg-slate-100"
                  }`}
                >
                  <tr>
                    <th
                      className={`px-4 py-2 text-left font-medium ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      SR NO
                    </th>
                    <th
                      className={`px-4 py-2 text-left font-medium ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      Name
                    </th>
                    <th
                      className={`px-4 py-2 text-left font-medium ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      Birthday
                    </th>
                    <th
                      className={`px-4 py-2 text-center font-medium ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      Status
                    </th>
                    <th
                      className={`px-4 py-2 text-center font-medium ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllBirthdays.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className={`px-4 py-8 text-center ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        No birthdays found
                      </td>
                    </tr>
                  ) : (
                    filteredAllBirthdays.map((person, index) => (
                      <tr
                        key={index}
                        className={`border-b ${
                          isDark
                            ? "border-slate-700 hover:bg-slate-700/50"
                            : "border-slate-100 hover:bg-slate-50"
                        } ${
                          person.isToday
                            ? isDark
                              ? "bg-pink-900/20"
                              : "bg-pink-50"
                            : ""
                        }`}
                      >
                        <td
                          className={`px-4 py-3 ${
                            isDark ? "text-slate-300" : "text-slate-900"
                          }`}
                        >
                          {index + 1}
                        </td>
                        <td
                          className={`px-4 py-3 ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                person.isToday
                                  ? "bg-pink-500/20"
                                  : person.isTomorrow
                                  ? "bg-purple-500/20"
                                  : isDark
                                  ? "bg-slate-600"
                                  : "bg-slate-200"
                              }`}
                            >
                              <User
                                className={`w-4 h-4 ${
                                  person.isToday
                                    ? "text-pink-500"
                                    : person.isTomorrow
                                    ? "text-purple-500"
                                    : isDark
                                    ? "text-slate-400"
                                    : "text-slate-500"
                                }`}
                              />
                            </div>
                            <span className="font-medium">{person.name}</span>
                          </div>
                        </td>
                        <td
                          className={`px-4 py-3 ${
                            isDark ? "text-slate-300" : "text-slate-700"
                          }`}
                        >
                          {formatFullDate(person.date_of_birth)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {person.isToday ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-pink-500/20 text-pink-500">
                              Today
                            </span>
                          ) : person.isTomorrow ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-500">
                              Tomorrow
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                isDark
                                  ? "bg-slate-600 text-slate-300"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              Upcoming
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleEditClick(person)}
                            className={`p-2 rounded-lg transition ${
                              isDark
                                ? "hover:bg-slate-600 text-slate-400 hover:text-white"
                                : "hover:bg-slate-200 text-slate-500 hover:text-slate-900"
                            }`}
                            title="Edit Birthday"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Today & Tomorrow View */}
      {viewMode === "today" && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Today's Birthdays */}
          <div
            className={`rounded-xl border overflow-hidden ${
              isDark
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-slate-200"
            } shadow-lg`}
          >
            <div className="p-3 border-b flex items-center gap-2 bg-gradient-to-r from-pink-500 to-pink-600">
              <Cake className="w-4 h-4 text-white" />
              <h3 className="font-semibold text-white text-sm">
                Today's Birthdays ({todayBirthdays.length})
              </h3>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto">
              {todayBirthdays.length === 0 ? (
                <p
                  className={`text-center py-4 text-sm ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  No birthdays today
                </p>
              ) : (
                <div className="space-y-2">
                  {todayBirthdays.map((person, idx) => {
                    const result = sendResults.find(
                      (r) => r.name === person.name
                    );
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-xl ${
                          isDark
                            ? "bg-gradient-to-r from-slate-700 to-slate-700/50"
                            : "bg-gradient-to-r from-slate-50 to-white"
                        } border ${
                          isDark ? "border-slate-600" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center shadow-md">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p
                              className={`text-sm font-semibold ${
                                isDark ? "text-white" : "text-slate-900"
                              }`}
                            >
                              {person.name}
                            </p>
                            <p
                              className={`text-xs ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {formatDate(person.date_of_birth)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {result &&
                            (result.success ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            ))}
                          <button
                            onClick={() => handleEditClick(person)}
                            className={`p-2 rounded-lg transition ${
                              isDark
                                ? "hover:bg-slate-600 text-slate-400"
                                : "hover:bg-slate-200 text-slate-500"
                            }`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendSingle(person)}
                            disabled={sending}
                            className="p-2 rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition disabled:opacity-50 shadow-md"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tomorrow's Birthdays */}
          <div
            className={`rounded-xl border overflow-hidden ${
              isDark
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-slate-200"
            } shadow-lg`}
          >
            <div className="p-3 border-b flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600">
              <Calendar className="w-4 h-4 text-white" />
              <h3 className="font-semibold text-white text-sm">
                Tomorrow's Birthdays ({tomorrowBirthdays.length})
              </h3>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto">
              {tomorrowBirthdays.length === 0 ? (
                <p
                  className={`text-center py-4 text-sm ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  No birthdays tomorrow
                </p>
              ) : (
                <div className="space-y-2">
                  {tomorrowBirthdays.map((person, idx) => {
                    const result = sendResults.find(
                      (r) => r.name === person.name
                    );
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-xl ${
                          isDark
                            ? "bg-gradient-to-r from-slate-700 to-slate-700/50"
                            : "bg-gradient-to-r from-slate-50 to-white"
                        } border ${
                          isDark ? "border-slate-600" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-md">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p
                              className={`text-sm font-semibold ${
                                isDark ? "text-white" : "text-slate-900"
                              }`}
                            >
                              {person.name}
                            </p>
                            <p
                              className={`text-xs ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {formatDate(person.date_of_birth)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {result &&
                            (result.success ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            ))}
                          <button
                            onClick={() => handleEditClick(person)}
                            className={`p-2 rounded-lg transition ${
                              isDark
                                ? "hover:bg-slate-600 text-slate-400"
                                : "hover:bg-slate-200 text-slate-500"
                            }`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendSingle(person)}
                            disabled={sending}
                            className="p-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition disabled:opacity-50 shadow-md"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Send Results */}
      {sendResults.length > 0 && viewMode === "today" && (
        <div
          className={`rounded-xl border p-4 ${
            isDark
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200"
          } shadow-lg`}
        >
          <h3
            className={`text-sm font-semibold mb-3 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Send Results
          </h3>
          <div className="space-y-2">
            {sendResults.map((result, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  result.success
                    ? isDark
                      ? "bg-green-900/20 border border-green-800"
                      : "bg-green-50 border border-green-200"
                    : isDark
                    ? "bg-red-900/20 border border-red-800"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <span
                  className={`text-sm font-medium ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {result.name}
                </span>
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span
                    className={`text-xs ${
                      result.success ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {result.message}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editModalOpen && editPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className={`w-full max-w-md mx-4 rounded-xl p-6 ${
              isDark ? "bg-slate-800" : "bg-white"
            } shadow-2xl`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className={`text-lg font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Edit Birthday
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className={`p-2 rounded-lg ${
                  isDark ? "hover:bg-slate-700" : "hover:bg-slate-100"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label
                  className={`block text-sm font-medium mb-1.5 ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={editPerson.name}
                  disabled
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-slate-400"
                      : "bg-slate-100 border-slate-300 text-slate-500"
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-1.5 ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Birthday
                </label>
                <input
                  type="date"
                  value={editBirthday}
                  onChange={(e) => setEditBirthday(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditModalOpen(false)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
