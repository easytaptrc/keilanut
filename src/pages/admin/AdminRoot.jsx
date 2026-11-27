import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, writeBatch, where } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useSession } from '../../lib/session';
import { useCol } from '../../lib/hooks';
import { Brand, Field, Icon, PageLoader, useToast } from '../../components/ui';
import { DEFAULT_SCHEDULE } from '../../components/BookingForm';
import { localNotify } from '../../lib/push';
import InstallBanner from '../../components/InstallBanner';
import AdminDashboard from './AdminDashboard';
import AdminBookings from './AdminBookings';
import AdminMembers from './AdminMembers';
import AdminMember from './AdminMember';
import AdminTemplates from './AdminTemplates';
import AdminNotify from './AdminNotify';
import AdminSettings from './AdminSettings';

const ReceptionApp = lazy(() => import('../reception/ReceptionApp'));

function AdminAuth() {
  const { user, isAdmin, staff, logout } = useSession();
  const toast = useToast();
  const [boot, setBoot] = useState(null); // null cargando, true existe admin, false no existe
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    getDoc(doc(db, 'meta', 'bootstrap')).then((d) => setBoot(d.exists())).catch(() => setBoot(true));
  }, []);

  const login = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await signInWithEmailAndPassword(auth, f.email.trim(), f.password); }
    catch (e2) { setErr(e2.code === 'auth/invalid-credential' ? 'Correo o contraseña incorrectos.' : e2.message); }
    finally { setBusy(false); }
  };

  const setup = async (e) => {
    e.preventDefault(); setErr('');
    if (f.password.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres.');
    if (f.password !== f.confirm) return setErr('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
      const uid = cred.user.uid;
      const b = writeBatch(db);
      b.set(doc(db, 'admins', uid), { name: f.name.trim() || 'Keila Guerrero', email: f.email.trim().toLowerCase(), fcmTokens: [], createdAt: serverTimestamp() });
      b.set(doc(db, 'meta', 'bootstrap'), { adminUid: uid, createdAt: serverTimestamp() });
      await b.commit();
      // Valores iniciales
      await setDoc(doc(db, 'settings', 'public'), { schedule: DEFAULT_SCHEDULE, whatsapp: '', instagram: '', address: '' }, { merge: true });
      await setDoc(doc(db, 'settings', 'admin'), { prices: { online: 500, presencial: 500 }, model: 'claude-opus-5-5' }, { merge: true });
      toast('Cuenta de administradora creada', 'ok');
      window.location.reload();
    } catch (e2) {
      setErr(e2.code === 'auth/email-already-in-use' ? 'Ese correo ya tiene cuenta. Inicia sesión.' : e2.code === 'permission-denied' ? 'Ya existe una administradora registrada.' : e2.message);
    } finally { setBusy(false); }
  };

  const reset = async () => {
    if (!f.email) return setErr('Escribe tu correo para enviarte el enlace.');
    try { await sendPasswordResetEmail(auth, f.email.trim()); toast('Te enviamos un correo para restablecer tu contraseña', 'ok'); }
    catch (e2) { setErr(e2.message); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-art"><div className="center"><img src="/logo.png" alt="Keila Guerrero" style={{ margin: '0 auto' }} /><div className="eyebrow mt hide-sm">Panel de administración</div></div></div>
      <div className="auth-form">
        <div className="box fade-in">
          <Link to="/" className="btn link small" style={{ paddingLeft: 0 }}><Icon name="arrowL" size={16} /> Inicio</Link>
          {user && !isAdmin ? (
            <div className="stack mt">
              <h2>Sin acceso</h2>
              <div className="error">{staff && staff.active === false ? `La cuenta de recepción ${user.email || ''} está desactivada. Pide a Keila que la active.` : `La cuenta ${user.email || ''} no es administradora.`}</div>
              <button className="btn ghost" onClick={logout}>Cerrar sesión</button>
            </div>
          ) : boot === null ? <PageLoader /> : boot ? (
            <form className="stack mt" onSubmit={login}>
              <h2>Bienvenida</h2>
              <p className="small muted" style={{ margin: 0 }}>Panel de Keila y acceso de recepción.</p>
              <Field label="Correo"><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="username" required /></Field>
              <Field label="Contraseña"><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="current-password" required /></Field>
              {err && <div className="error">{err}</div>}
              <button className="btn block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
              <button type="button" className="btn link small" onClick={reset}>Olvidé mi contraseña</button>
            </form>
          ) : (
            <form className="stack mt" onSubmit={setup}>
              <h2>Crea tu cuenta de administradora</h2>
              <p className="muted small">Este paso se hace una sola vez. Después solo tú podrás entrar al panel con este correo y contraseña.</p>
              <Field label="Nombre"><input className="input" value={f.name} onChange={set('name')} placeholder="Keila Guerrero" /></Field>
              <Field label="Correo"><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="username" required /></Field>
              <Field label="Contraseña (mín. 8)"><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" required /></Field>
              <Field label="Confirmar contraseña"><input className="input" type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" required /></Field>
              {err && <div className="error">{err}</div>}
              <button className="btn sage block" disabled={busy}>{busy ? 'Creando…' : 'Crear cuenta'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const NAV = [
  ['', 'home', 'Inicio'],
  ['reservaciones', 'calendar', 'Reservaciones'],
  ['team', 'users', 'Team'],
  ['plantillas', 'sparkle', 'Planes y plantillas'],
  ['avisos', 'bell', 'Notificaciones'],
  ['ajustes', 'settings', 'Ajustes'],
];

function AdminShell() {
  const { logout } = useSession();
  const toast = useToast();
  const { list: pending, loading } = useCol('bookings', () => [where('status', '==', 'pendiente')], 'pending');
  const [seen, setSeen] = useState(null);

  // Aviso cuando llega una reservación nueva mientras el panel está abierto
  useEffect(() => {
    if (loading) return;
    if (seen === null) { setSeen(new Set(pending.map((p) => p.id))); return; }
    const fresh = pending.filter((p) => !seen.has(p.id));
    if (fresh.length) {
      fresh.forEach((p) => {
        toast({ title: 'Nueva reservación', body: `${p.firstName} ${p.lastName} · ${p.date} ${p.time}` }, 'ok');
        if (document.hidden) localNotify('Nueva reservación', `${p.firstName} ${p.lastName} · ${p.date} ${p.time}`, '/admin/reservaciones');
      });
      setSeen(new Set(pending.map((p) => p.id)));
    }
  }, [pending, loading, seen, toast]);

  const link = ([to, ic, l], mobile) => (
    <NavLink key={to} to={`/admin${to ? '/' + to : ''}`} end={!to} className={({ isActive }) => (mobile ? (isActive ? 'active' : '') : `side-link ${isActive ? 'active' : ''}`)}>
      <Icon name={ic} size={mobile ? 22 : 20} />{mobile ? l.split(' ')[0] : l}
      {to === 'reservaciones' && pending.length > 0 && <span className="count">{pending.length}</span>}
    </NavLink>
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand to="/admin" />
        {NAV.map((n) => link(n))}
        <div className="side-foot">
          <a className="side-link" href="/" target="_blank" rel="noreferrer"><Icon name="eye" />Ver sitio</a>
          <button className="side-link" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={logout}><Icon name="logout" />Cerrar sesión</button>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="mobile-top">
          <Brand to="/admin" small />
          <div className="row nowrap" style={{ gap: 8 }}>
            <NavLink to="/admin/ajustes" className="icon-btn" aria-label="Ajustes"><Icon name="settings" /></NavLink>
            <button className="icon-btn" onClick={logout} aria-label="Cerrar sesión"><Icon name="logout" /></button>
          </div>
        </div>
        <main className="main">
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="reservaciones" element={<AdminBookings />} />
            <Route path="team" element={<AdminMembers />} />
            <Route path="team/:id" element={<AdminMember />} />
            <Route path="plantillas" element={<AdminTemplates />} />
            <Route path="avisos" element={<AdminNotify />} />
            <Route path="ajustes" element={<AdminSettings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
      <nav className="bottom-nav">{NAV.slice(0, 5).map((n) => link(n, true))}</nav>
      <InstallBanner />
    </div>
  );
}

export default function AdminRoot() {
  const { ready, isAdmin, staff } = useSession();
  if (!ready) return <PageLoader />;
  if (isAdmin) return <AdminShell />;
  if (staff?.active) return <Suspense fallback={<PageLoader />}><ReceptionApp /></Suspense>;
  return <AdminAuth />;
}
