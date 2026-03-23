"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../api/client";
import {
  Users,
  Trash2,
  X,
  Shield,
  User,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Plus,
  Pencil,
  ShieldCheck,
} from "lucide-react";

interface UserData {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

interface UserManagementUser {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

interface FormDataType {
  username: string;
  password: string;
  role: string;
}

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [users, setUsers] = useState<UserManagementUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserManagementUser | null>(
    null
  );
  const [formData, setFormData] = useState<FormDataType>({
    username: "",
    password: "",
    role: "user",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<UserManagementUser | null>(
    null
  );
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === "super-admin";

  const fetchUsers = useCallback(async () => {
    if (!isSuperAdmin) {
      setError("Super Admin access required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await auth.getUsers();
      const usersData = response.data?.users || response.data || [];
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to load users";
      setError(errorMsg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const filteredUsers = Array.isArray(users)
    ? users.filter((u) => {
        const matchesSearch = u.username
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === "all" || u.role === filterRole;
        return matchesSearch && matchesRole;
      })
    : [];

  const openModal = (user?: UserManagementUser) => {
    if (user) {
      const userToEdit = Array.isArray(users)
        ? users.find((u) => u.id === user.id)
        : null;
      if (!userToEdit) return;
      setEditingUser(userToEdit);
      setFormData({
        username: userToEdit.username,
        password: "",
        role: userToEdit.role,
      });
    } else {
      setEditingUser(null);
      setFormData({ username: "", password: "", role: "user" });
    }
    setShowPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({ username: "", password: "", role: "user" });
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (editingUser) {
        const updateData: any = {
          username: formData.username,
          role: formData.role,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await auth.updateUser(editingUser.id, updateData);
        setSuccess(`User "${formData.username}" updated successfully`);
      } else {
        if (!formData.password) {
          setError("Password is required for new users");
          setFormLoading(false);
          return;
        }
        await auth.createUser(formData);
        setSuccess(`User "${formData.username}" created successfully`);
      }
      closeModal();
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save user");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setDeleteLoading(true);
    try {
      await auth.deleteUser(deleteConfirm.id);
      setSuccess(`User "${deleteConfirm.username}" deleted successfully`);
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete user");
    } finally {
      setDeleteLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super-admin":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <ShieldCheck className="w-3 h-3" />
            Super Admin
          </span>
        );
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <Shield className="w-3 h-3" />
            Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <User className="w-3 h-3" />
            User
          </span>
        );
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h2
          className={`text-xl font-bold mb-2 ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          Access Denied
        </h2>
        <p
          className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}
        >
          Only Super Admin can access this page
        </p>
      </div>
    );
  }

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
            <Users className="w-5 h-5" />
            User Management
          </h1>
          <p
            className={`text-xs ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Manage system users and their roles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-700 text-white px-3 py-1.5 rounded-md hover:bg-slate-600 transition disabled:opacity-50 text-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add User
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-xs">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-300 rounded-lg text-green-800 text-xs">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Filters */}
      <div
        className={`flex flex-wrap gap-3 p-3 rounded-lg border ${
          isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
        }`}
      >
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`flex-1 min-w-[200px] px-3 py-1.5 rounded-md border text-xs ${
            isDark
              ? "bg-slate-700 border-slate-600 text-white"
              : "bg-white border-slate-300 text-slate-900"
          }`}
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className={`px-3 py-1.5 rounded-md border text-xs ${
            isDark
              ? "bg-slate-700 border-slate-600 text-white"
              : "bg-white border-slate-300 text-slate-900"
          }`}
        >
          <option value="all">All Roles</option>
          <option value="super-admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

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
            Loading users...
          </p>
        </div>
      )}

      {/* Users Table */}
      {!loading && (
        <div
          className={`overflow-x-auto border rounded-lg ${
            isDark
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-slate-200"
          }`}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? "bg-slate-700" : "bg-slate-100"}>
                <th
                  className={`px-3 py-2 text-left font-semibold ${
                    isDark ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  Username
                </th>
                <th
                  className={`px-3 py-2 text-left font-semibold ${
                    isDark ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  Role
                </th>
                <th
                  className={`px-3 py-2 text-left font-semibold ${
                    isDark ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  Created At
                </th>
                <th
                  className={`px-3 py-2 text-center font-semibold ${
                    isDark ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center">
                    <p className={isDark ? "text-slate-400" : "text-slate-500"}>
                      No users found
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-t ${
                      isDark
                        ? "border-slate-700 hover:bg-slate-700/50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <td
                      className={`px-3 py-2 ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {u.username}
                    </td>
                    <td className="px-3 py-2">{getRoleBadge(u.role)}</td>
                    <td
                      className={`px-3 py-2 ${
                        isDark ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openModal(u)}
                          className="p-1.5 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(u)}
                          className="p-1.5 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition"
                          disabled={u.username === currentUser?.username}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`w-full max-w-md rounded-lg shadow-xl ${
              isDark ? "bg-slate-800" : "bg-white"
            }`}
          >
            <div
              className={`flex items-center justify-between p-4 border-b ${
                isDark ? "border-slate-700" : "border-slate-200"
              }`}
            >
              <h3
                className={`text-sm font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {editingUser ? "Edit User" : "Add New User"}
              </h3>
              <button
                onClick={closeModal}
                className={`p-1 rounded-md ${
                  isDark ? "hover:bg-slate-700" : "hover:bg-slate-100"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label
                  className={`block text-xs font-medium mb-1.5 ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                  className={`w-full px-3 py-2 rounded-md border text-sm ${
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
                  Password {editingUser && "(leave blank to keep current)"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required={!editingUser}
                    className={`w-full px-3 py-2 pr-10 rounded-md border text-sm ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-white border-slate-300 text-slate-900"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  className={`block text-xs font-medium mb-1.5 ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Role
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, role: "super-admin" })
                    }
                    className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition ${
                      formData.role === "super-admin"
                        ? "bg-purple-600 text-white"
                        : isDark
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                    Super Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: "admin" })}
                    className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition ${
                      formData.role === "admin"
                        ? "bg-red-600 text-white"
                        : isDark
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 inline mr-1" />
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: "user" })}
                    className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition ${
                      formData.role === "user"
                        ? "bg-blue-600 text-white"
                        : isDark
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <User className="w-3.5 h-3.5 inline mr-1" />
                    User
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className={`flex-1 py-2 px-4 rounded-md text-xs font-medium ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2 px-4 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {formLoading
                    ? "Saving..."
                    : editingUser
                    ? "Update User"
                    : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`w-full max-w-sm rounded-lg shadow-xl ${
              isDark ? "bg-slate-800" : "bg-white"
            }`}
          >
            <div className="p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3
                className={`text-sm font-semibold mb-2 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Delete User
              </h3>
              <p
                className={`text-xs mb-4 ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              >
                Are you sure you want to delete "{deleteConfirm.username}"? This
                action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className={`flex-1 py-2 px-4 rounded-md text-xs font-medium ${
                    isDark
                      ? "bg-slate-700 text-slate-300"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="flex-1 py-2 px-4 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
