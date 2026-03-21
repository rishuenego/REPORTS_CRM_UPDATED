"use client";

import type React from "react";
import { useState, useEffect, useMemo } from "react";
import { useTheme } from "../context/ThemeContext";
import { messaging } from "../api/client";
import {
  Send,
  RefreshCw,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  X,
  CheckSquare,
  Square,
  Users,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface UserData {
  id: number;
  name: string;
  phone: string;
  branch: string;
  designation?: string;
}

interface BroadcastResult {
  success: { user: UserData; formattedNumber: string }[];
  failed: { user: UserData; error: string }[];
}

export const MessageBroadcasting: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Users state
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [selectedDesignation, setSelectedDesignation] = useState("ALL");

  // Selection state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(
    new Set()
  );
  const [excludedUserIds, setExcludedUserIds] = useState<Set<number>>(
    new Set()
  );

  // Message state
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcastResult, setBroadcastResult] =
    useState<BroadcastResult | null>(null);

  // Add/Edit user dialog state
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [userForm, setUserForm] = useState({
    name: "",
    phone: "",
    branch: "NOIDA",
  });
  const [formError, setFormError] = useState("");

  // Delete confirmation dialog
  const [deleteConfirm, setDeleteConfirm] = useState<UserData | null>(null);

  const branches = ["ALL", "AHMEDABAD", "NOIDA", "CHENNAI"];
  const designations = [
    "ALL",
    "ACCOUNTS",
    "ADMIN",
    "DATA",
    "HR",
    "IT",
    "NGO",
    "Operations",
    "sales",
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await messaging.getAllUsers();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter users by branch and search query
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesBranch =
        selectedBranch === "ALL" ||
        user.branch?.toUpperCase() === selectedBranch;
      const matchesDesignation =
        selectedDesignation === "ALL" ||
        user.designation === selectedDesignation;
      const matchesSearch =
        searchQuery === "" ||
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phone?.includes(searchQuery);
      return matchesBranch && matchesDesignation && matchesSearch;
    });
  }, [users, selectedBranch, selectedDesignation, searchQuery]);

  // This allows selecting users from any branch/designation to receive message
  const usersToMessage = useMemo(() => {
    return users.filter(
      (user) => selectedUserIds.has(user.id) && !excludedUserIds.has(user.id)
    );
  }, [users, selectedUserIds, excludedUserIds]);

  // Selection handlers
  const toggleUserSelection = (userId: number) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const toggleUserExclusion = (userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExcluded = new Set(excludedUserIds);
    if (newExcluded.has(userId)) {
      newExcluded.delete(userId);
    } else {
      newExcluded.add(userId);
    }
    setExcludedUserIds(newExcluded);
  };

  const selectAllFiltered = () => {
    const newSelected = new Set(selectedUserIds);
    filteredUsers.forEach((user) => newSelected.add(user.id));
    setSelectedUserIds(newSelected);
  };

  const deselectAllFiltered = () => {
    const newSelected = new Set(selectedUserIds);
    filteredUsers.forEach((user) => newSelected.delete(user.id));
    setSelectedUserIds(newSelected);
  };

  const clearAllSelections = () => {
    setSelectedUserIds(new Set());
    setExcludedUserIds(new Set());
  };

  // User CRUD handlers
  const handleAddUser = () => {
    setEditingUser(null);
    setUserForm({ name: "", phone: "", branch: "NOIDA" });
    setFormError("");
    setShowUserDialog(true);
  };

  const handleEditUser = (user: UserData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingUser(user);
    setUserForm({ name: user.name, phone: user.phone, branch: user.branch });
    setFormError("");
    setShowUserDialog(true);
  };

  const handleDeleteUser = (user: UserData, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm(user);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await messaging.deleteUser(deleteConfirm.id);
      setUsers(users.filter((u) => u.id !== deleteConfirm.id));
      selectedUserIds.delete(deleteConfirm.id);
      excludedUserIds.delete(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to delete user");
    }
  };

  const handleSaveUser = async () => {
    if (!userForm.name.trim() || !userForm.phone.trim()) {
      setFormError("Name and phone are required");
      return;
    }

    try {
      if (editingUser) {
        const response = await messaging.updateUser(editingUser.id, userForm);
        setUsers(
          users.map((u) => (u.id === editingUser.id ? response.data.user : u))
        );
      } else {
        const response = await messaging.addUser(userForm);
        setUsers([...users, response.data.user]);
      }
      setShowUserDialog(false);
    } catch (error: any) {
      setFormError(error.response?.data?.error || "Failed to save user");
    }
  };

  // Send broadcast message
  const handleSendBroadcast = async () => {
    if (!message.trim()) {
      alert("Please enter a message");
      return;
    }

    if (usersToMessage.length === 0) {
      alert("Please select at least one user to send the message");
      return;
    }

    setSending(true);
    setBroadcastResult(null);

    try {
      const response = await messaging.sendBroadcast({
        message: message.trim(),
        users: usersToMessage,
        excludedIds: Array.from(excludedUserIds),
      });

      setBroadcastResult(response.data.results);
      if (response.data.results.success.length > 0) {
        setMessage("");
        clearAllSelections();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  // Get branch counts
  const branchCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: users.length };
    users.forEach((user) => {
      const branch = user.branch?.toUpperCase() || "OTHER";
      counts[branch] = (counts[branch] || 0) + 1;
    });
    return counts;
  }, [users]);

  const designationCounts = useMemo(() => {
    // First filter users by selected branch
    const branchFilteredUsers =
      selectedBranch === "ALL"
        ? users
        : users.filter((user) => user.branch?.toUpperCase() === selectedBranch);

    const counts: Record<string, number> = { ALL: branchFilteredUsers.length };
    branchFilteredUsers.forEach((user) => {
      const designation = user.designation || "OTHER";
      counts[designation] = (counts[designation] || 0) + 1;
    });
    return counts;
  }, [users, selectedBranch]);

  return (
    <div className="space-y-6 px-4 md:px-8 w-full">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1
            className={`text-2xl font-bold uppercase ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            <MessageSquare className="inline w-7 h-7 mr-2 text-yellow-500" />
            Message Broadcasting
          </h1>
          <p
            className={`text-sm mt-1 ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Send WhatsApp messages to multiple users at once
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAddUser}
            className="flex items-center gap-2 bg-yellow-500 text-slate-900 px-4 py-2 rounded-lg font-semibold hover:bg-yellow-400 transition"
          >
            <UserPlus className="w-5 h-5" />
            Add User
          </button>
          <button
            onClick={loadUsers}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              isDark
                ? "bg-slate-700 text-white hover:bg-slate-600"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Branch Tabs */}
      <div className="flex flex-wrap gap-2">
        {branches.map((branch) => (
          <button
            key={branch}
            onClick={() => setSelectedBranch(branch)}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              selectedBranch === branch
                ? "bg-yellow-500 text-slate-900"
                : isDark
                ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            {branch}
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                selectedBranch === branch
                  ? "bg-slate-900 text-white"
                  : isDark
                  ? "bg-slate-600 text-slate-300"
                  : "bg-slate-300 text-slate-700"
              }`}
            >
              {branchCounts[branch] || 0}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-sm font-medium ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          Designation:
        </span>
        {designations.map((designation) => (
          <button
            key={designation}
            onClick={() => setSelectedDesignation(designation)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              selectedDesignation === designation
                ? "bg-blue-500 text-white"
                : isDark
                ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            {designation.replace("_", " ")}
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                selectedDesignation === designation
                  ? "bg-blue-700 text-white"
                  : isDark
                  ? "bg-slate-600 text-slate-300"
                  : "bg-slate-300 text-slate-700"
              }`}
            >
              {designationCounts[designation] || 0}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users List Panel */}
        <div
          className={`lg:col-span-2 rounded-xl border ${
            isDark
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200"
          } shadow-lg`}
        >
          {/* Search and Selection Controls */}
          <div
            className={`p-4 border-b ${
              isDark ? "border-slate-700" : "border-slate-200"
            }`}
          >
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px] relative">
                <Search
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or phone..."
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                      : "bg-white border-slate-300 text-slate-900 placeholder-slate-500"
                  }`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={selectAllFiltered}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isDark
                      ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  <CheckSquare className="inline w-4 h-4 mr-1" />
                  Select All
                </button>
                <button
                  onClick={deselectAllFiltered}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  <Square className="inline w-4 h-4 mr-1" />
                  Deselect
                </button>
                <button
                  onClick={clearAllSelections}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isDark
                      ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                      : "bg-red-100 text-red-700 hover:bg-red-200"
                  }`}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Selection Summary */}
            <div
              className={`mt-3 flex flex-wrap gap-4 text-sm ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              <span>
                <Users className="inline w-4 h-4 mr-1" />
                {filteredUsers.length} users shown
              </span>
              <span className="text-green-500">
                <CheckSquare className="inline w-4 h-4 mr-1" />
                {selectedUserIds.size} selected
              </span>
              {excludedUserIds.size > 0 && (
                <span className="text-orange-500">
                  <XCircle className="inline w-4 h-4 mr-1" />
                  {excludedUserIds.size} excluded
                </span>
              )}
              <span className="text-blue-500 font-medium">
                <Send className="inline w-4 h-4 mr-1" />
                {usersToMessage.length} selected users will receive message
              </span>
            </div>
          </div>

          {/* Users Table */}
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw
                  className={`w-8 h-8 animate-spin ${
                    isDark ? "text-yellow-400" : "text-yellow-500"
                  }`}
                />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div
                className={`text-center py-12 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No users found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead
                  className={`sticky top-0 ${
                    isDark ? "bg-slate-700" : "bg-slate-100"
                  }`}
                >
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-12">
                      Select
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      Designation
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Exclude
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredUsers.map((user) => {
                    const isSelected = selectedUserIds.has(user.id);
                    const isExcluded = excludedUserIds.has(user.id);
                    return (
                      <tr
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`cursor-pointer transition ${
                          isExcluded
                            ? isDark
                              ? "bg-red-900/20 hover:bg-red-900/30"
                              : "bg-red-50 hover:bg-red-100"
                            : isSelected
                            ? isDark
                              ? "bg-green-900/20 hover:bg-green-900/30"
                              : "bg-green-50 hover:bg-green-100"
                            : isDark
                            ? "hover:bg-slate-700"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? "bg-green-500 border-green-500"
                                : isDark
                                ? "border-slate-500"
                                : "border-slate-300"
                            }`}
                          >
                            {isSelected && (
                              <CheckSquare className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </td>
                        <td
                          className={`px-4 py-3 font-medium ${
                            isDark ? "text-slate-200" : "text-slate-900"
                          }`}
                        >
                          {user.name}
                        </td>
                        <td
                          className={`px-4 py-3 ${
                            isDark ? "text-slate-400" : "text-slate-600"
                          }`}
                        >
                          {user.phone}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              user.branch === "AHMEDABAD"
                                ? "bg-blue-100 text-blue-700"
                                : user.branch === "NOIDA"
                                ? "bg-green-100 text-green-700"
                                : user.branch === "CHENNAI"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {user.branch}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              user.designation === "ACCOUNTS"
                                ? "bg-orange-100 text-orange-700"
                                : user.designation === "ADMIN"
                                ? "bg-red-100 text-red-700"
                                : user.designation === "DATA"
                                ? "bg-yellow-100 text-yellow-700"
                                : user.designation === "HR"
                                ? "bg-teal-100 text-teal-700"
                                : user.designation === "IT"
                                ? "bg-indigo-100 text-indigo-700"
                                : user.designation === "NGO"
                                ? "bg-blue-100 text-blue-700"
                                : user.designation === "Operations"
                                ? "bg-green-100 text-green-700"
                                : user.designation === "sales"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {user.designation?.replace("_", " ") || "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => toggleUserExclusion(user.id, e)}
                            className={`p-1 rounded transition ${
                              isExcluded
                                ? "bg-red-500 text-white"
                                : isDark
                                ? "bg-slate-600 text-slate-400 hover:bg-red-900/50 hover:text-red-400"
                                : "bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-600"
                            }`}
                            title={isExcluded ? "Include user" : "Exclude user"}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => handleEditUser(user, e)}
                              className={`p-1.5 rounded transition ${
                                isDark
                                  ? "hover:bg-blue-900/50 text-blue-400"
                                  : "hover:bg-blue-100 text-blue-600"
                              }`}
                              title="Edit user"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteUser(user, e)}
                              className={`p-1.5 rounded transition ${
                                isDark
                                  ? "hover:bg-red-900/50 text-red-400"
                                  : "hover:bg-red-100 text-red-600"
                              }`}
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Message Panel */}
        <div
          className={`rounded-xl border ${
            isDark
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200"
          } shadow-lg`}
        >
          <div
            className={`p-4 border-b ${
              isDark ? "border-slate-700" : "border-slate-200"
            }`}
          >
            <h2
              className={`text-lg font-bold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              <Send className="inline w-5 h-5 mr-2 text-yellow-500" />
              Compose Message
            </h2>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Message Content
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={8}
                className={`w-full px-4 py-3 rounded-lg border resize-none ${
                  isDark
                    ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    : "bg-white border-slate-300 text-slate-900 placeholder-slate-500"
                }`}
              />
              <p
                className={`text-xs mt-1 ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                {message.length} characters
              </p>
            </div>

            <div
              className={`p-3 rounded-lg ${
                isDark ? "bg-slate-700" : "bg-slate-100"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Recipients: {usersToMessage.length} user(s)
              </p>
              {usersToMessage.length > 0 && (
                <p
                  className={`text-xs mt-1 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {usersToMessage
                    .slice(0, 3)
                    .map((u) => u.name)
                    .join(", ")}
                  {usersToMessage.length > 3 &&
                    ` and ${usersToMessage.length - 3} more`}
                </p>
              )}
            </div>

            <button
              onClick={handleSendBroadcast}
              disabled={
                sending || usersToMessage.length === 0 || !message.trim()
              }
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition ${
                sending || usersToMessage.length === 0 || !message.trim()
                  ? "bg-slate-400 text-slate-600 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {sending ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Broadcast
                </>
              )}
            </button>
          </div>

          {/* Broadcast Results */}
          {broadcastResult && (
            <div
              className={`p-4 border-t ${
                isDark ? "border-slate-700" : "border-slate-200"
              }`}
            >
              <h3
                className={`text-sm font-semibold mb-3 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Broadcast Results
              </h3>

              {broadcastResult.success.length > 0 && (
                <div
                  className={`mb-3 p-3 rounded-lg ${
                    isDark ? "bg-green-900/30" : "bg-green-50"
                  }`}
                >
                  <p className="text-green-600 font-medium text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {broadcastResult.success.length} sent successfully
                  </p>
                </div>
              )}

              {broadcastResult.failed.length > 0 && (
                <div
                  className={`p-3 rounded-lg ${
                    isDark ? "bg-red-900/30" : "bg-red-50"
                  }`}
                >
                  <p className="text-red-600 font-medium text-sm flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    {broadcastResult.failed.length} failed
                  </p>
                  <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                    {broadcastResult.failed.map((f, i) => (
                      <p
                        key={i}
                        className={isDark ? "text-red-400" : "text-red-600"}
                      >
                        {f.user.name}: {f.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit User Dialog */}
      {showUserDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={`${
              isDark ? "bg-slate-800" : "bg-white"
            } rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3
                className={`text-lg font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {editingUser ? "Edit User" : "Add New User"}
              </h3>
              <button
                onClick={() => setShowUserDialog(false)}
                className={`p-1 rounded hover:bg-slate-200 ${
                  isDark ? "hover:bg-slate-700" : ""
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) =>
                    setUserForm({ ...userForm, name: e.target.value })
                  }
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                  placeholder="Enter name"
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Phone Number
                </label>
                <input
                  type="text"
                  value={userForm.phone}
                  onChange={(e) =>
                    setUserForm({ ...userForm, phone: e.target.value })
                  }
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Branch
                </label>
                <select
                  value={userForm.branch}
                  onChange={(e) =>
                    setUserForm({ ...userForm, branch: e.target.value })
                  }
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                >
                  <option value="AHMEDABAD">AHM</option>
                  <option value="NOIDA">NOIDA</option>
                  <option value="CHENNAI">CHENNAI</option>
                </select>
              </div>

              {/* Added Designation input */}
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Designation
                </label>
                <select
                  value={userForm.designation || ""}
                  onChange={(e) =>
                    setUserForm({ ...userForm, designation: e.target.value })
                  }
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                >
                  <option value="">Select Designation</option>
                  {designations.map((d) => (
                    <option key={d} value={d}>
                      {d.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowUserDialog(false)}
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  isDark
                    ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                    : "border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                className="flex-1 px-4 py-2 rounded-lg bg-yellow-500 text-slate-900 font-semibold hover:bg-yellow-400"
              >
                {editingUser ? "Update" : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={`${
              isDark ? "bg-slate-800" : "bg-white"
            } rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl`}
          >
            <div className="text-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  isDark ? "bg-red-900/50" : "bg-red-100"
                }`}
              >
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3
                className={`text-lg font-bold mb-2 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Delete User?
              </h3>
              <p
                className={`text-sm mb-6 ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              >
                Are you sure you want to delete{" "}
                <strong>{deleteConfirm.name}</strong>? This action cannot be
                undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className={`flex-1 px-4 py-2 rounded-lg border ${
                    isDark
                      ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                      : "border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
