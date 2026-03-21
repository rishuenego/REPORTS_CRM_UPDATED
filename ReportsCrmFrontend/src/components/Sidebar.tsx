"use client";

import type React from "react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  BarChart3,
  LayoutDashboard,
  FileText,
  LogOut,
  Menu,
  Clock,
  Archive,
  MessageSquare,
  GitBranch,
  Users,
  UserCircle,
  Sun,
  Moon,
  ChevronRight,
  CreditCard,
  User,
  Cake,
} from "lucide-react";

interface SidebarProps {
  onExpandChange?: (expanded: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onExpandChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [isExpanded, setIsExpanded] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleExpandChange = (expanded: boolean) => {
    setIsExpanded(expanded);
    onExpandChange?.(expanded);
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: FileText, label: "Login Report", path: "/login-report" },
    { icon: Clock, label: "Talktime Report", path: "/talktime-report" },
    { icon: UserCircle, label: "Agent Report", path: "/agent-report" },
    { icon: Archive, label: "Dispo Report", path: "/dispo-report" },
    { icon: GitBranch, label: "Pipeline Report", path: "/pipeline-report" },
    { icon: CreditCard, label: "Payment Links", path: "/payment-links" },
  ];

  if (user?.role === "admin" || user?.role === "super-admin") {
    menuItems.splice(5, 0, {
      icon: MessageSquare,
      label: "Msg Broadcasting",
      path: "/message-broadcasting",
    });
  }

  if (user?.role === "super-admin") {
    menuItems.push({
      icon: Users,
      label: "User Management",
      path: "/user-management",
    });
    menuItems.push({
      icon: Cake,
      label: "Birthday Wish",
      path: "/birthday-wish",
    });
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <aside
        onMouseEnter={() => handleExpandChange(true)}
        onMouseLeave={() => {
          handleExpandChange(false);
          setShowProfileMenu(false);
        }}
        className={`fixed left-0 top-0 h-screen ${
          isDark ? "bg-slate-900" : "bg-slate-800"
        } text-white shadow-lg z-50 transition-all duration-300 ${
          isExpanded ? "w-44 xl:w-52" : "w-11 xl:w-12"
        }`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`aside::-webkit-scrollbar { display: none; }`}</style>

        <div
          className={`p-2 xl:p-3 border-b ${
            isDark ? "border-slate-700" : "border-slate-600"
          } flex items-center ${
            isExpanded ? "justify-start gap-1.5 xl:gap-2" : "justify-center"
          }`}
        >
          <div className="bg-yellow-400 p-1 xl:p-1.5 rounded flex-shrink-0">
            <BarChart3 className="w-3 h-3 xl:w-4 xl:h-4 text-slate-900" />
          </div>
          {isExpanded && (
            <h1 className="text-sm xl:text-base font-bold whitespace-nowrap">
              CRM Reports
            </h1>
          )}
        </div>

        <nav
          className="p-1.5 space-y-0.5 overflow-y-auto h-[calc(100vh-140px)]"
          style={{ scrollbarWidth: "none" }}
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={!isExpanded ? item.label : undefined}
                className={`w-full flex items-center ${
                  isExpanded
                    ? "gap-1.5 xl:gap-2 px-1.5 xl:px-2"
                    : "justify-center"
                } py-2 xl:py-2.5 rounded-md transition ${
                  active
                    ? "bg-yellow-400 text-slate-900"
                    : "text-slate-300 hover:bg-slate-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5 xl:w-4 xl:h-4 flex-shrink-0" />
                {isExpanded && (
                  <span className="font-medium whitespace-nowrap text-xs xl:text-sm">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div
          className={`absolute bottom-0 left-0 right-0 p-1.5 border-t ${
            isDark ? "border-slate-700" : "border-slate-600"
          }`}
        >
          <button
            onClick={toggleTheme}
            title={
              !isExpanded ? (isDark ? "Light Mode" : "Dark Mode") : undefined
            }
            className={`w-full flex items-center ${
              isExpanded ? "gap-1.5 xl:gap-2 px-1.5 xl:px-2" : "justify-center"
            } py-1.5 rounded-md text-slate-300 hover:bg-slate-700 transition mb-1.5`}
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 xl:w-4 xl:h-4 flex-shrink-0" />
            ) : (
              <Moon className="w-3.5 h-3.5 xl:w-4 xl:h-4 flex-shrink-0" />
            )}
            {isExpanded && (
              <span className="font-medium text-xs xl:text-sm">
                {isDark ? "Light Mode" : "Dark Mode"}
              </span>
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              title={!isExpanded ? user?.username : undefined}
              className={`w-full flex items-center ${
                isExpanded
                  ? "gap-1.5 xl:gap-2 px-1.5 xl:px-2"
                  : "justify-center"
              } py-1.5 rounded-md text-slate-300 hover:bg-slate-700 transition`}
            >
              <div className="w-5 h-5 xl:w-6 xl:h-6 rounded-full bg-yellow-400 flex items-center justify-center flex-shrink-0">
                <User className="w-2.5 h-2.5 xl:w-3 xl:h-3 text-slate-900" />
              </div>
              {isExpanded && (
                <>
                  <div className="flex-1 text-left">
                    <p className="text-[10px] xl:text-xs font-medium truncate">
                      {user?.username}
                    </p>
                    <p className="text-[8px] xl:text-[10px] text-yellow-400 capitalize">
                      {user?.role}
                    </p>
                  </div>
                  <ChevronRight
                    className={`w-3 h-3 xl:w-3.5 xl:h-3.5 transition-transform ${
                      showProfileMenu ? "rotate-90" : ""
                    }`}
                  />
                </>
              )}
            </button>

            {showProfileMenu && isExpanded && (
              <div
                className={`absolute bottom-full left-0 right-0 mb-1.5 rounded-md shadow-xl ${
                  isDark ? "bg-slate-800" : "bg-slate-700"
                } overflow-hidden`}
              >
                <button
                  onClick={() => {
                    navigate("/profile");
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-1.5 xl:gap-2 px-2 xl:px-3 py-2 xl:py-2.5 text-slate-300 hover:bg-slate-600 transition text-xs xl:text-sm"
                >
                  <UserCircle className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
                  <span>My Profile</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-1.5 xl:gap-2 px-2 xl:px-3 py-2 xl:py-2.5 text-red-400 hover:bg-slate-600 transition text-xs xl:text-sm"
                >
                  <LogOut className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export const SidebarToggle: React.FC<{ onClick: () => void }> = ({
  onClick,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={onClick}
      className={`lg:hidden fixed top-3 left-3 z-40 p-1.5 rounded-md ${
        isDark ? "bg-slate-800 text-white" : "bg-slate-900 text-white"
      }`}
    >
      <Menu className="w-4 h-4" />
    </button>
  );
};

export const MobileSidebar: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: FileText, label: "Login Report", path: "/login-report" },
    { icon: Clock, label: "Talktime Report", path: "/talktime-report" },
    { icon: UserCircle, label: "Agent Report", path: "/agent-report" },
    { icon: Archive, label: "Dispo Report", path: "/dispo-report" },
    { icon: GitBranch, label: "Pipeline Report", path: "/pipeline-report" },
    { icon: CreditCard, label: "Payment Links", path: "/payment-links" },
  ];

  if (user?.role === "admin" || user?.role === "super-admin") {
    menuItems.splice(5, 0, {
      icon: MessageSquare,
      label: "Msg Broadcasting",
      path: "/message-broadcasting",
    });
  }

  if (user?.role === "super-admin") {
    menuItems.push({
      icon: Users,
      label: "User Management",
      path: "/user-management",
    });
    menuItems.push({
      icon: Cake,
      label: "Birthday Wish",
      path: "/birthday-wish",
    });
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed left-0 top-0 h-screen w-52 ${
          isDark ? "bg-slate-900" : "bg-slate-800"
        } text-white shadow-lg z-50 transform transition-transform lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-400 p-1.5 rounded">
              <BarChart3 className="w-4 h-4 text-slate-900" />
            </div>
            <h1 className="text-base font-bold">CRM Reports</h1>
          </div>
        </div>

        <nav className="p-1.5 space-y-0.5 overflow-y-auto h-[calc(100vh-160px)]">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  onClose();
                }}
                className={`w-full flex items-center gap-2 px-2 py-2.5 rounded-md transition ${
                  active
                    ? "bg-yellow-400 text-slate-900"
                    : "text-slate-300 hover:bg-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-700 space-y-1.5">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-slate-300 hover:bg-slate-700 transition"
          >
            {isDark ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
            <span className="text-sm">
              {isDark ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          <button
            onClick={() => {
              navigate("/profile");
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-slate-300 hover:bg-slate-700 transition"
          >
            <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center">
              <User className="w-3 h-3 text-slate-900" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-medium">{user?.username}</p>
              <p className="text-[10px] text-yellow-400 capitalize">
                {user?.role}
              </p>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-red-400 hover:bg-slate-700 transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
