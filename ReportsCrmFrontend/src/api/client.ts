import axios from "axios";

const API_URL = "https://reportscrm-2.onrender.com/api";

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const user = localStorage.getItem("user");
  if (user) {
    const userData = JSON.parse(user);
    if (userData.token) {
      config.headers.Authorization = `Bearer ${userData.token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Just pass through the error - don't auto-logout
    return Promise.reject(error);
  },
);

export const auth = {
  login: (username: string, password: string) =>
    apiClient.post("/auth/login", { username, password }),
  logout: (userId: string) =>
    apiClient.post("/auth/logout", { user_id: userId }),
  createUser: (username: string, password: string, role: string) =>
    apiClient.post("/auth/create-user", { username, password, role }),
  validateSession: (userId: string) =>
    apiClient.post("/auth/validate-session", { user_id: userId }),
  getUsers: () => apiClient.get("/auth/users"),
  updateUser: (
    userId: string,
    data: { username?: string; password?: string; role?: string },
  ) => apiClient.put(`/auth/users/${userId}`, data),
  deleteUser: (userId: string) => apiClient.delete(`/auth/users/${userId}`),
};

export const dashboard = {
  getUserActivity: () => apiClient.get("/dashboard/user-activity"),
};

export const dispo = {
  getReport: (branch: string, date: string) =>
    apiClient.get(`/dispo/report/${branch}`, { params: { date } }),
  getMergedReport: (date: string) =>
    apiClient.get(`/dispo/merged-report`, { params: { date } }),
};

export const downloads = {
  downloadTalktimeExcel: (
    data: any,
    branch: string,
    userId: string,
    grandTotals: any,
    talktimeThreshold?: string, // Changed from number to string for HH:MM:SS format
    reportType?: string,
  ) =>
    apiClient.post(
      "/downloads/talktime-excel",
      {
        data,
        branch,
        user_id: userId,
        grandTotals,
        talktimeThreshold,
        reportType,
      },
      { responseType: "blob" },
    ),

  downloadPipelineExcel: (
    data: any,
    branch: string,
    userId: string,
    summary: any,
    grandTotals: any,
    month?: number,
    year?: number,
  ) =>
    apiClient.post(
      "/downloads/pipeline-excel",
      { data, branch, user_id: userId, summary, grandTotals, month, year },
      { responseType: "blob" },
    ),
  downloadAgentExcel: (
    data: any,
    agentName: string,
    userId: string,
    grandTotals: any,
    startDate: string,
    endDate: string,
    talktimeThreshold?: number,
  ) =>
    apiClient.post(
      "/downloads/agent-excel",
      {
        data,
        agentName,
        user_id: userId,
        grandTotals,
        startDate,
        endDate,
        talktimeThreshold,
      },
      { responseType: "blob" },
    ),
  downloadAgentDispoExcel: (
    data: any,
    agentName: string,
    userId: string,
    summary: any,
    startDate: string,
    endDate: string,
  ) =>
    apiClient.post(
      "/downloads/agent-dispo-excel",
      { data, agentName, user_id: userId, summary, startDate, endDate },
      { responseType: "blob" },
    ),
  downloadDispoExcel: (
    data: any,
    branch: string,
    userId: string,
    summary: any,
    date: string,
  ) =>
    apiClient.post(
      "/downloads/dispo-excel",
      { data, branch, user_id: userId, summary, date },
      { responseType: "blob" },
    ),
  downloadMergedDispoExcel: (
    data: any,
    userId: string,
    summary: any,
    date: string,
  ) =>
    apiClient.post(
      "/downloads/merged-dispo-excel",
      { data, user_id: userId, summary, date },
      { responseType: "blob" },
    ),
  getDownloadLogs: () => apiClient.get("/downloads/logs"),
};

export const messaging = {
  // New endpoints for Users_details table
  getAllUsers: () => apiClient.get("/messaging/users"),
  getUsersByBranch: (branch: string) =>
    apiClient.get(`/messaging/users/${branch}`),
  addUser: (data: { name: string; phone: string; branch: string }) =>
    apiClient.post("/messaging/users", data),
  updateUser: (
    id: number,
    data: { name: string; phone: string; branch: string },
  ) => apiClient.put(`/messaging/users/${id}`, data),
  deleteUser: (id: number) => apiClient.delete(`/messaging/users/${id}`),
  deleteUsersBulk: (ids: number[]) =>
    apiClient.post("/messaging/users/delete-bulk", { ids }),
  searchUsers: (query: string) =>
    apiClient.get(`/messaging/users/search/${query}`),

  // New broadcast endpoint
  sendBroadcast: (payload: {
    message: string;
    mediaUrl?: string;
    users: any[];
    excludedIds?: number[];
  }) => apiClient.post("/messaging/send-broadcast", payload),

  getBirthdays: () => apiClient.get("/messaging/birthdays"),
  getAllBirthdays: () => apiClient.get("/messaging/birthdays/all"),
  sendToGroup: (payload: { message: string; name: string; when: string }) =>
    apiClient.post("/messaging/send-to-group", payload),
  updateBirthday: (payload: { name: string; birthday: string }) =>
    apiClient.put("/messaging/birthdays/update", payload),

  // Legacy endpoints for backward compatibility
  getContacts: (branch: string) =>
    apiClient.get(`/messaging/contacts/${branch}`),
  sendMessage: (payload: {
    fromNumber: string;
    message: string;
    contacts: any[];
  }) => apiClient.post("/messaging/send", payload),
};

export const pipeline = {
  getReport: (branch: string, month?: number, year?: number) =>
    apiClient.get(`/pipeline/report/${branch}`, { params: { month, year } }),
};

export const agent = {
  getAgentList: (branch: string) => apiClient.get(`/agent/list/${branch}`),
  getReport: (
    agentName: string,
    branch: string,
    startDate: string,
    endDate: string,
  ) =>
    apiClient.get(`/agent/report`, {
      params: { agentName, branch, startDate, endDate },
    }),
  getDispoReport: (agentName: string, startDate: string, endDate: string) =>
    apiClient.get(`/agent/dispo-report`, {
      params: { agentName, startDate, endDate },
    }),
};

export const paymentLinks = {
  getReport: (startDate: string, endDate: string) =>
    apiClient.get("/payment-links/report", { params: { startDate, endDate } }),
  getStatusReport: (startDate: string, endDate: string) =>
    apiClient.get("/payment-links/status-report", {
      params: { startDate, endDate },
    }),
  download: (data: any, startDate: string, endDate: string) =>
    apiClient.post(
      "/payment-links/download",
      { data, startDate, endDate },
      { responseType: "blob" },
    ),
  downloadStatus: (
    data: any,
    grandTotals: any,
    startDate: string,
    endDate: string,
  ) =>
    apiClient.post(
      "/payment-links/download-status",
      { data, grandTotals, startDate, endDate },
      { responseType: "blob" },
    ),
};

export const talktime = {
  getReport: (
    branch: string,
    date: string,
    reportType?: string,
    talktimeThreshold?: string,
  ) =>
    apiClient.get(`/talktime/report/${branch}`, {
      params: { date, reportType, talktimeThreshold },
    }),
  getEmployees: (branchId: number) =>
    apiClient.get(`/talktime/employees/${branchId}`),
};
