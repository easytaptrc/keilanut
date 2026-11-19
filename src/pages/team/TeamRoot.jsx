import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { getRedirectResult, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db, googleProvider } from '../../firebase';
import { useSession } from '../../lib/session';
import { Avatar, Brand, Icon, PageLoader, useToast } from '../../components/ui';
import { isIOS, isStandalone } from '../../lib/utils';
import { localNotify } from '../../lib/push';
import InstallBanner from '../../components/InstallBanner';
import TeamHome from './TeamHome';
import TeamDiet from './TeamDiet';
import TeamRoutine from './TeamRoutine';
import TeamProgress from './TeamProgress';
import TeamProfile from './TeamProfile';
import TeamBook from './TeamBook';
import TeamNotifications from './TeamNotifications';

export async function googleSignIn() {
  // En la app instalada (y en iOS) los popups fallan: usamos redirect.
  if (isStandalone() || isIOS()) return signInWithRedirect(auth, googleProvider);
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return signInWithRedirect(auth, googleProvider);
    throw e;
  }
}

const authError = (e) => ({
  'auth/invalid-credential': 'ID o contraseña incorrectos.',
  'auth/wrong-password': 'ID o contraseña incorrectos.',
  'auth/user-not-found': 'No existe un miembro con ese ID.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos o entra con Google.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google.',
  'auth/network-request-failed': 'Sin conexión a internet.',
  'auth/operation-not-allowed': 'Este método de acceso no está habilitado todavía.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado para iniciar sesión con Google.',
}[e?.code] || e?.message || 'No se pudo iniciar sesión.');

function TeamLogin() {
  const { user, isAdmin, logout } = useSession();
  const [id, setId] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getRedirectResult(auth).catch((e) => setErr(authError(e))); }, []);

  const login = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const key = id.trim().toUpperCase();
      const l = await getDoc(doc(db, 'logins', key));
      if (!l.exists()) throw { code: 'auth/user-not-found' };
      await signInWithEmailAndPassword(auth, l.data().email, pwd);
    }
    catch (e2) { setErr(authError(e2)); }
    finally { setBusy(false); }
  };
  const google = async () => {
    setErr(''); setBusy(true);
    try { await googleSignIn(); } catch (e2) { setErr(authError(e2)); } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-art">
        <div className="center">
          <img src="/monogram.png" alt="GK" style={{ margin: '0 auto' }} />
          <div className="eyebrow mt hide-sm">Keila Guerrero · Team</div>
          <p className="serif hide-sm" style={{ fontSize: '1.6rem', maxWidth: 360, margin: '14px auto 0', fontStyle: 'italic' }}>Tu plan, tu progreso y tu rutina en un solo lugar.</p>
        </div>
      </div>
      <div className="auth-form">
        <div className="box fade-in">
          <Link to="/" className="btn link small" style={{ paddingLeft: 0 }}><Icon name="arrowL" size={16} /> Inicio</Link>
          <h2 className="mt">Entrar a Team</h2>
          {user && !isAdmin ? (
            <div className="stack">
              <div className="error">
                La cuenta <b>{user.email}</b> no está vinculada a ningún miembro del Team. Si ya eres parte, entra con tu ID y contraseña, o pide a Keila que registre este correo en tu expediente.
              </div>
              <button className="btn ghost" onClick={logout}>Usar otra cuenta</button>
            </div>
          ) : user && isAdmin ? (
            <div className="stack">
              <div className="notice">Iniciaste sesión como administradora.</div>
              <Link to="/admin" className="btn">Ir al panel de administración</Link>
              <button className="btn ghost" onClick={logout}>Cerrar sesión</button>
            </div>
          ) : (
            <>
              <p className="muted">Usa el ID y la contraseña que te dio Keila al aceptarte.</p>
              <form className="stack" onSubmit={login}>
                <label className="field"><span>Tu ID de Team</span><input className="input" value={id} onChange={(e) => setId(e.target.value.toUpperCase())} placeholder="KG-0001" autoCapitalize="characters" autoComplete="username" required /></label>
                <label className="field"><span>Contraseña</span><input className="input" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="current-password" required /></label>
                {err && <div className="error">{err}</div>}
                <button className="btn block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
              </form>
              <div className="divider">o</div>
              <button className="btn google-btn block" onClick={google} disabled={busy}><Icon name="google" /> Continuar con Google</button>
              <p className="tiny muted mt">¿Olvidaste tu ID o contraseña? Entra con la cuenta de Google del correo que registraste al reservar.</p>
              <div className="divider">¿Aún no eres parte?</div>
              <Link to="/reservar" className="btn ghost block">Reservar mi primera cita</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const NAV = [
  ['', 'home', 'Inicio'],
  ['dieta', 'apple', 'Dieta'],
  ['rutina', 'dumbbell', 'Rutina'],
  ['progreso', 'chart', 'Progreso'],
  ['perfil', 'user', 'Perfil'],
];

function TeamShell() {
  const { member, logout } = useSession();
  const toast = useToast();
  const nav = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const first = useRef(true);

  useEffect(() => {
    const q = query(collection(db, 'members', member.id, 'notifications'), orderBy('createdAt', 'desc'), limit(40));
    return onSnapshot(q, (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!first.current) {
        s.docChanges().filter((c) => c.type === 'added' && !c.doc.metadata.hasPendingWrites).forEach((c) => {
          const n = c.doc.data();
          toast({ title: n.title, body: n.body, duration: 6000 }, 'ok');
          if (document.hidden) localNotify(n.title, n.body, '/team/avisos');
        });
      }
      first.current = false;
      setNotifs(list);
    }, (e) => console.warn(e));
  }, [member.id, toast]);

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand to="/team" />
        {NAV.map(([to, ic, l]) => (
          <NavLink key={to} to={`/team${to ? '/' + to : ''}`} end={!to} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Icon name={ic} />{l}</NavLink>
        ))}
        <NavLink to="/team/reservar" className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Icon name="calendar" />Reservar cita</NavLink>
        <NavLink to="/team/avisos" className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Icon name="bell" />Avisos {unread > 0 && <span className="count">{unread}</span>}</NavLink>
        <div className="side-foot">
          <div className="row nowrap card flat" style={{ padding: 10 }}>
            <Avatar person={member} />
            <div className="grow"><b className="small">{member.firstName}</b><div className="tiny muted">ID {member.id}</div></div>
          </div>
          <button className="side-link" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={logout}><Icon name="logout" />Cerrar sesión</button>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="mobile-top">
          <Brand to="/team" small />
          <div className="row nowrap" style={{ gap: 8 }}>
            <button className="icon-btn" onClick={() => nav('/team/avisos')} aria-label="Avisos"><Icon name="bell" />{unread > 0 && <span className="dot">{unread}</span>}</button>
            <button className="icon-btn" onClick={() => nav('/team/perfil')} aria-label="Perfil" style={{ padding: 0, overflow: 'hidden' }}><Avatar person={member} /></button>
          </div>
        </div>
        <main className="main">
          <Routes>
            <Route index element={<TeamHome unread={unread} />} />
            <Route path="dieta" element={<TeamDiet />} />
            <Route path="rutina" element={<TeamRoutine />} />
            <Route path="progreso" element={<TeamProgress />} />
            <Route path="perfil" element={<TeamProfile />} />
            <Route path="reservar" element={<TeamBook />} />
            <Route path="avisos" element={<TeamNotifications list={notifs} />} />
            <Route path="*" element={<Navigate to="/team" replace />} />
          </Routes>
        </main>
      </div>
      <nav className="bottom-nav">
        {NAV.map(([to, ic, l]) => (
          <NavLink key={to} to={`/team${to ? '/' + to : ''}`} end={!to} className={({ isActive }) => (isActive ? 'active' : '')}><Icon name={ic} size={22} />{l}</NavLink>
        ))}
      </nav>
      <InstallBanner />
    </div>
  );
}

export default function TeamRoot() {
  const { ready, member } = useSession();
  if (!ready) return <PageLoader />;
  if (!member) return <TeamLogin />;
  if (member.active === false) return <InactiveNotice />;
  return <TeamShell />;
}

function InactiveNotice() {
  const { logout } = useSession();
  return (
    <div className="page-loader">
      <div className="card center" style={{ maxWidth: 420, margin: 16 }}>
        <img src="/monogram.png" alt="" style={{ width: 80, margin: '0 auto 12px' }} />
        <h3>Tu acceso está en pausa</h3>
        <p className="muted small">Contacta a Keila para reactivar tu cuenta del Team o agenda una nueva cita.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/reservar" className="btn sage sm">Reservar</Link>
          <button className="btn ghost sm" onClick={logout}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}

