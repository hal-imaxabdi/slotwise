import { Navigate, Route, Routes } from 'react-router';
import type { Role } from './api/types.ts';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { RequireRole } from './auth/RequireRole.tsx';
import { AppLayout } from './components/AppLayout.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { AppointmentsPage } from './pages/AppointmentsPage.tsx';
import { BookingPage } from './pages/BookingPage.tsx';
import { BusinessHoursPage } from './pages/BusinessHoursPage.tsx';
import { ClosuresPage } from './pages/ClosuresPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { ServicesPage } from './pages/ServicesPage.tsx';
import { StaffPage } from './pages/StaffPage.tsx';

const STAFF_ROLES: readonly Role[] = ['staff', 'admin'];
const ADMIN_ROLES: readonly Role[] = ['admin'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/services" replace />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="services/:serviceId/book" element={<BookingPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route element={<RequireRole allow={STAFF_ROLES} />}>
            <Route path="staff" element={<StaffPage />} />
            <Route path="staff/unavailable-periods" element={<ClosuresPage />} />
          </Route>
          <Route element={<RequireRole allow={ADMIN_ROLES} />}>
            <Route path="admin" element={<AdminPage />} />
            <Route path="admin/business-hours" element={<BusinessHoursPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
