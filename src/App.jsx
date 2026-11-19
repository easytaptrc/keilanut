import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { PageLoader } from './components/ui';
import Home from './pages/Home';
import Reservar from './pages/Reservar';

const TeamRoot = lazy(() => import('./pages/team/TeamRoot'));
const AdminRoot = lazy(() => import('./pages/admin/AdminRoot'));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reservar" element={<Reservar />} />
          <Route path="/team/*" element={<TeamRoot />} />
          <Route path="/admin/*" element={<AdminRoot />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </>
  );
}
