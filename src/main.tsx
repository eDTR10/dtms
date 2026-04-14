import React from 'react'
import ReactDOM from 'react-dom/client'
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import App from './App.tsx'
import './index.css'
import { Suspense, lazy } from "react";

import NotFound from "./screens/notFound";
import Loader from './components/loader/loader.tsx';
import { AuthProvider } from './screens/Auth/AuthContext.tsx';
import { ThemeProvider } from './components/theme-provider.tsx';
import ProtectedRoute from './screens/Auth/ProtectedRoute.tsx';
import AdminRoute from './screens/Auth/AdminRoute.tsx';
import SmartRedirect from './screens/Auth/SmartRedirect.tsx';

const Page1 = lazy(() =>
  wait(1300).then(() => import("./screens/page1.tsx"))
);

const Page2 = lazy(() =>
  wait(1300).then(() => import("./screens/page2.tsx"))
);

const Login = lazy(() => import("./screens/Auth/login.tsx"));
const Register = lazy(() => import("./screens/Auth/Register.tsx"));
const ForgotPassword = lazy(() => import("./screens/Auth/ForgotPassword.tsx"));
const ResetPassword = lazy(() => import("./screens/Auth/ResetPassword.tsx"));

// ── Admin pages ───────────────────────────────────────────────────────────
const AdminDashboard  = lazy(() => import("./screens/Admin/Dashboard.tsx"));
const AdminUsers      = lazy(() => import("./screens/Admin/UserPage.tsx"));
const AdminDocuments  = lazy(() => import("./screens/Admin/DocumentPage.tsx"));
const AdminSettings   = lazy(() => import("./screens/Admin/Setting.tsx"));
const AdminProfile    = lazy(() => import("./screens/Admin/Profile.tsx"));
const AdminTemplates  = lazy(() => import("./screens/Admin/TemplatesPage.tsx"));
const AdminOffices    = lazy(() => import("./screens/Admin/OfficesPage.tsx"));

// ── User panel pages ──────────────────────────────────────────────────────
const AdminShell      = lazy(() => import("./screens/Admin/AdminShell.tsx"));
const UserShell       = lazy(() => import("./screens/User/UserShell.tsx"));
const MyDocuments     = lazy(() => import("./screens/User/MyDocuments.tsx"));
const CreateDocument     = lazy(() => import("./screens/User/CreateDocument.tsx"));
const SignDocument       = lazy(() => import("./screens/User/SignDocument.tsx"));
const SignatureSettings  = lazy(() => import("./screens/User/SignatureSettings.tsx"));
const UserProfile        = lazy(() => import("./screens/User/UserProfile.tsx"));

// Legacy route kept for old links
const LegacyDashboard = lazy(() => import("./screens/Dashboard.tsx"));

const router = createBrowserRouter([
  // ── Auth pages (no navbar) ────────────────────────────
  {
    path: "/dtms/login",
    element: (
      <Suspense fallback={<Loader />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: "/dtms/register",
    element: (
      <Suspense fallback={<Loader />}>
        <Register />
      </Suspense>
    ),
  },
  {
    path: "/dtms/forgot-password",
    element: (
      <Suspense fallback={<Loader />}>
        <ForgotPassword />
      </Suspense>
    ),
  },
  {
    path: "/dtms/reset-password/:uid/:token",
    element: (
      <Suspense fallback={<Loader />}>
        <ResetPassword />
      </Suspense>
    ),
  },

  // ── Admin panel (nested — AdminShell stays mounted across navigation) ──
  {
    path: "/dtms/admin",
    element: <AdminRoute><Suspense fallback={<Loader />}><AdminShell /></Suspense></AdminRoute>,
    children: [
      { index: true, element: <Navigate to="/dtms/admin/dashboard" replace /> },
      { path: "dashboard", element: <Suspense fallback={<Loader />}><AdminDashboard /></Suspense> },
      { path: "users",     element: <Suspense fallback={<Loader />}><AdminUsers /></Suspense> },
      { path: "documents", element: <Suspense fallback={<Loader />}><AdminDocuments /></Suspense> },
      { path: "templates", element: <Suspense fallback={<Loader />}><AdminTemplates /></Suspense> },
      { path: "offices",   element: <Suspense fallback={<Loader />}><AdminOffices /></Suspense> },
      { path: "settings",  element: <Suspense fallback={<Loader />}><AdminSettings /></Suspense> },
      { path: "profile",   element: <Suspense fallback={<Loader />}><AdminProfile /></Suspense> },
    ],
  },

  // ── User panel (nested — UserShell stays mounted across navigation) ────
  {
    path: "/dtms/user",
    element: <ProtectedRoute><Suspense fallback={<Loader />}><UserShell /></Suspense></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/dtms/user/documents" replace /> },
      { path: "documents", element: <Suspense fallback={<Loader />}><MyDocuments /></Suspense> },
      { path: "create",    element: <Suspense fallback={<Loader />}><CreateDocument /></Suspense> },
      { path: "settings",  element: <Suspense fallback={<Loader />}><SignatureSettings /></Suspense> },
      { path: "profile",   element: <Suspense fallback={<Loader />}><UserProfile /></Suspense> },

    ],
  },

  // ── Signing page (standalone via email link — also wrapped in UserShell) ──
  {
    path: "/dtms/sign",
    element: <ProtectedRoute><Suspense fallback={<Loader />}><UserShell /></Suspense></ProtectedRoute>,
    children: [
      { path: ":tracknumber", element: <Suspense fallback={<Loader />}><SignDocument /></Suspense> },
    ],
  },

  // ── Legacy dashboard redirect ────────────────────────────
  {
    path: "/dtms/dashboard",
    element: <SmartRedirect />,
  },

  // ── Legacy standalone dashboard (kept as fallback) ────
  {
    path: "/dtms/dashboard-old",
    element: <Suspense fallback={<Loader />}><LegacyDashboard /></Suspense>,
  },

  // ── Main app with navbar ──────────────────────────────
  {
    path: "/dtms/",
    element: <App />,
    children: [
      {
        path: "/dtms/",
        element: <SmartRedirect />,
      },
      {
        path: "/dtms/page1",
        element: (
          <Suspense fallback={<Loader />}>
            <Page1 />
          </Suspense>
        ),
      },
      {
        path: "/dtms/page2",
        element: (
          <Suspense fallback={<Loader />}>
            <Page2 />
          </Suspense>
        ),
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);

function wait(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
