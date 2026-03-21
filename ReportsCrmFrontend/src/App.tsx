"use client";

import type React from "react";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { TalktimeReport } from "./pages/TalktimeReport";
import { LoginReport } from "./pages/LoginReport";
import { DispoReport } from "./pages/DispoReport";
import { MessageBroadcasting } from "./pages/MessageBroadcasting";
import { PipelineReport } from "./pages/PipelineReport";
import UserManagement from "./pages/UserManagement";
import { AgentReport } from "./pages/AgentReport";
import { Profile } from "./pages/Profile";
import { PaymentLinks } from "./pages/PaymentLinks";
import { BirthdayWish } from "./pages/BirthdayWish"; // Added BirthdayWish import

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (user?.role !== "admin" && user?.role !== "super-admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (user?.role !== "super-admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const AppContent = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <Layout>
            <Dashboard />
          </Layout>
        }
      />
      <Route
        path="/talktime-report"
        element={
          <Layout>
            <TalktimeReport />
          </Layout>
        }
      />
      <Route
        path="/agent-report"
        element={
          <Layout>
            <AgentReport />
          </Layout>
        }
      />
      <Route
        path="/login-report"
        element={
          <Layout>
            <LoginReport />
          </Layout>
        }
      />
      <Route
        path="/dispo-report"
        element={
          <Layout>
            <DispoReport />
          </Layout>
        }
      />
      <Route
        path="/message-broadcasting"
        element={
          <Layout>
            <AdminRoute>
              <MessageBroadcasting />
            </AdminRoute>
          </Layout>
        }
      />
      <Route
        path="/pipeline-report"
        element={
          <Layout>
            <PipelineReport />
          </Layout>
        }
      />
      <Route
        path="/payment-links"
        element={
          <Layout>
            <PaymentLinks />
          </Layout>
        }
      />
      <Route
        path="/user-management"
        element={
          <Layout>
            <SuperAdminRoute>
              <UserManagement />
            </SuperAdminRoute>
          </Layout>
        }
      />
      <Route
        path="/birthday-wish"
        element={
          <Layout>
            <SuperAdminRoute>
              <BirthdayWish />
            </SuperAdminRoute>
          </Layout>
        }
      />
      <Route
        path="/profile"
        element={
          <Layout>
            <Profile />
          </Layout>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
