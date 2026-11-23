import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { cx, initials } from '../lib/utils';
import { exerciseImg } from '../data/exercises';

/* ---------------- Iconos (línea fina) ---------------- */
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  leaf: 'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l8-8',
  apple: 'M12 7c-1-2-3-3-5-2-3 1-3 6-1 10 1.5 3 3.5 5 6 4 2.5 1 4.5-1 6-4 2-4 2-9-1-10-2-1-4 0-5 2zM12 7c0-2 1-4 3-4',
  dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  chart: 'M4 19V5M4 19h16M8 15l3-4 3 2 5-6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.6',
  file: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 14H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  money: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v.01M18 15v.01',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  arrowL: 'M19 12H5M11 6l-6 6 6 6',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  video: 'M3 7h12v10H3zM15 10l6-3v10l-6-3',
  pin: 'M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  google: '',
  whatsapp: 'M4 20l1.3-3.9A8 8 0 1 1 8 19zM9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2L9 9z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  fork: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 7 0 2 1 3 3 3',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v7h14v-7',
};

export function Icon({ name, size = 20, stroke = 1.6, className, style }) {
  if (name === 'google') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" className={className} style={style} aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
      <path d={P[name] || P.leaf} />
    </svg>
  );
}

/* ---------------- Marca ---------------- */
export function Brand({ to = '/', small }) {
  return (
    <Link to={to} className="brand" aria-label="Keila Guerrero Nutrición">
      <img src="/monogram.png" alt="GK" style={small ? { height: 34 } : undefined} />
      <span className="t"><b>KEILA GUERRERO</b><small>Lic. Nutrición</small></span>
    </Link>
  );
}

export function PageLoader() {
  return <div className="page-loader"><img src="/monogram.png" alt="Cargando" /></div>;
}

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, type = '') => {
    const id = Math.random();
    const it = typeof msg === 'string' ? { body: msg } : msg;
    setItems((x) => [...x, { id, type, ...it }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), it.duration || 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx('toast', t.type)}>{t.title && <b>{t.title}</b>}{t.body}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------- Modal ---------------- */
export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cx('modal', wide && 'wide')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Campos ---------------- */
export function Field({ label, required, hint, children, className }) {
  return (
    <label className={cx('field', className)}>
      {label && <span>{label}{required && <em> *</em>}</span>}
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

export function Choice({ options, value, onChange, multi }) {
  const vals = multi ? value || [] : value;
  const toggle = (k) => {
    if (!multi) return onChange(k);
    onChange(vals.includes(k) ? vals.filter((x) => x !== k) : [...vals, k]);
  };
  return (
    <div className="checks">
      {Object.entries(options).map(([k, l]) => (
        <button type="button" key={k} className={cx('opt', (multi ? vals.includes(k) : vals === k) && 'on')} onClick={() => toggle(k)}>
          {typeof l === 'string' ? l : l.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ person, size }) {
  return (
    <div className={cx('avatar', size)}>
      {person?.photo ? <img src={person.photo} alt="" /> : <span>{initials(person)}</span>}
    </div>
  );
}

export function Badge({ tone, children, plain }) {
  return <span className={cx('badge', tone, plain && 'plain')}>{children}</span>;
}

export function Empty({ icon = '🌿', title, children }) {
  return (
    <div className="empty fade-in">
      <div className="ico">{icon}</div>
      {title && <h3>{title}</h3>}
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function Spinner() { return <span className="spinner" aria-label="Cargando" />; }

/* ---------------- Animación de ejercicio (tipo GIF) ---------------- */
export function ExerciseAnim({ id, smooth, tag = true }) {
  if (!id) return <div className="ex-anim" style={{ display: 'grid', placeItems: 'center' }}><Icon name="dumbbell" size={36} /></div>;
  return (
    <div className={cx('ex-anim', smooth && 'smooth')}>
      <img src={exerciseImg(id, 0)} alt="" loading="lazy" />
      <img className="f1" src={exerciseImg(id, 1)} alt="" loading="lazy" />
      {tag && <span className="gif-tag">GIF</span>}
    </div>
  );
}

/* ---------------- Gráfica de línea ---------------- */
export function LineChart({ data, unit = 'kg', height = 220 }) {
  const pts = data.filter((d) => d.y != null && !isNaN(d.y));
  if (pts.length < 2) return <Empty icon="📈">Registra al menos dos mediciones para ver tu gráfica.</Empty>;
  const W = 600, H = height, pad = { l: 40, r: 16, t: 16, b: 28 };
  const ys = pts.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (max - min < 2) { min -= 1; max += 1; }
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (pts.length - 1);
  const y = (v) => pad.t + ((max - v) * (H - pad.t - pad.b)) / (max - min);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const ticks = [min, (min + max) / 2, max];
  const every = Math.ceil(pts.length / 6);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gráfica de ${unit}`}>
      <defs>
        <linearGradient id="gradSage" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ce8690" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ce8690" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line className="grid-l" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{t.toFixed(1)}</text>
        </g>
      ))}
      <path className="area" d={area} />
      <path className="line" d={line} pathLength={1000} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.y)} r={4}><title>{`${p.label}: ${p.y} ${unit}`}</title></circle>
          {i % every === 0 && <text x={x(i)} y={H - 8} textAnchor="middle">{p.short || p.label}</text>}
        </g>
      ))}
    </svg>
  );
}

export function Ring({ value, max, label, sub, color = '#6e2236' }) {
  const r = 52, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="ring">
      <svg width="100%" height="100%" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} stroke="#ece7dd" strokeWidth="9" fill="none" />
        <circle cx="60" cy="60" r={r} stroke={color} strokeWidth="9" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div className="c"><div><div className="serif" style={{ fontSize: '1.7rem' }}>{label}</div><div className="tiny muted">{sub}</div></div></div>
    </div>
  );
}

/* ---------------- Revelar al hacer scroll ---------------- */
export function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

export function ConfirmButton({ children, confirm = '¿Seguro?', onConfirm, className = 'btn ghost sm' }) {
  return (
    <button type="button" className={className} onClick={() => window.confirm(confirm) && onConfirm()}>
      {children}
    </button>
  );
}
