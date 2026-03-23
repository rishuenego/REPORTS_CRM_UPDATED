"use client";

import type React from "react";
import { useState } from "react";
import { Sidebar, SidebarToggle, MobileSidebar } from "./Sidebar";
import { useTheme } from "../context/ThemeContext";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen ${isDark ? "bg-slate-900" : "bg-slate-100"}`}>
      <div className="hidden lg:block">
        <Sidebar onExpandChange={setSidebarExpanded} />
      </div>

      <MobileSidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="lg:hidden">
        <SidebarToggle onClick={() => setMobileSidebarOpen(true)} />
      </div>

      <main
        className={`min-h-screen transition-all duration-300 ${
          sidebarExpanded ? "lg:ml-44 xl:ml-52" : "lg:ml-11 xl:ml-12"
        }`}
      >
        <div className="p-3 pt-12 lg:pt-3 lg:p-4 w-full max-w-full overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};
