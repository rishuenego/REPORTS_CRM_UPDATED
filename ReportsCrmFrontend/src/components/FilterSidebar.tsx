"use client";

import type React from "react";
import { X, Filter } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onApply: () => void;
  onReset: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  isOpen,
  onClose,
  title,
  children,
  onApply,
  onReset,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity z-40 ${
          isOpen ? "opacity-50" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar - reduced width */}
      <div
        className={`fixed right-0 top-0 h-[97%] w-64 shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } ${isDark ? "bg-slate-800" : "bg-white"}`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-3 border-b ${
            isDark ? "border-slate-700" : "border-slate-200"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Filter
              className={`w-4 h-4 ${
                isDark ? "text-yellow-400" : "text-yellow-500"
              }`}
            />
            <h2
              className={`text-sm font-bold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-md transition ${
              isDark
                ? "hover:bg-slate-700 text-slate-400"
                : "hover:bg-slate-100 text-slate-500"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3 overflow-y-auto h-[calc(100%-120px)]">
          {children}
        </div>

        <div
          className={`absolute bottom-0 left-0 right-0 p-3 border-t ${
            isDark
              ? "border-slate-700 bg-slate-800"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex gap-2">
            <button
              onClick={onReset}
              className={`flex-1 px-3 py-2 rounded-md font-medium transition text-xs ${
                isDark
                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Reset
            </button>
            <button
              onClick={() => {
                onApply();
                onClose();
              }}
              className="flex-1 px-3 py-2 bg-yellow-400 text-slate-900 rounded-md font-bold hover:bg-yellow-500 transition text-xs"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export const FilterButton: React.FC<{
  onClick: () => void;
  hasFilters?: boolean;
}> = ({ onClick, hasFilters }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition relative text-xs ${
        isDark
          ? "bg-slate-700 text-white hover:bg-slate-600"
          : "bg-slate-200 text-slate-900 hover:bg-slate-300"
      }`}
    >
      <Filter className="w-3.5 h-3.5" />
      <span>Filters</span>
      {hasFilters && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full" />
      )}
    </button>
  );
};
