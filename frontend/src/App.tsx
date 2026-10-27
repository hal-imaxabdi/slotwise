import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth.tsx';
import { AppLayout } from './components/AppLayout.tsx';
import { BookingPage } from './pages/BookingPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { ServicesPage } from './pages/ServicesPage.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/services" replace />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="services/:serviceId/book" element={<BookingPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
