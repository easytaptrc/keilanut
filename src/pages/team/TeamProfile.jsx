import { Fragment, useRef, useState } from 'react';
import { EmailAuthProvider, linkWithPopup, linkWithRedirect, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../../firebase';
import { useSession } from '../../lib/session';
import { Avatar, Field, Icon, useToast } from '../../components/ui';
import PushCard from '../../components/PushCard';
import { ACTIVITY, GOALS, ageFrom, bmi, fmtDate, isIOS, isStandalone, resizeImage } from '../../lib/utils';

export default function TeamProfile() {
  const { member, user, logout } = useSession();
  const toast = useToast();
  const fileRef = useRef();
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ cur: '', next: '' });
  const isPasswordUser = user?.providerData?.some((p) => p.providerId === 'password');
  const hasGoogle = user?.providerData?.some((p) => p.providerId === 'google.com');

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await resizeImage(file, 360, 0.82);
      await updateDoc(doc(db, 'members', member.id), { photo: dataUrl });
      toast('Foto actualizada', 'ok');
    } catch (err) { toast('No se pudo actualizar la foto: ' + err.message, 'err'); }
    finally { setBusy(false); e.target.value = ''; }
  };

  const linkGoogle = async () => {
    try {
      if (isStandalone() || isIOS()) return await linkWithRedirect(auth.currentUser, googleProvider);
      await linkWithPopup(auth.currentUser, googleProvider);
      await updateDoc(doc(db, 'members', member.id), { googleLinked: true });
      toast('Cuenta de Google vinculada. Ya puedes entrar con Google.', 'ok');
    } catch (e) {
      toast(e.code === 'auth/credential-already-in-use' ? 'Esa cuenta de Google ya está vinculada a otro usuario.' : e.message, 'err');
    }
  };

  const changePw = async (e) => {
    e.preventDefault();
    if (pw.next.length < 6) return toast('La nueva contraseña debe tener al menos 6 caracteres', 'err');
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, pw.cur));
      await updatePassword(auth.currentUser, pw.next);
      setPw({ cur: '', next: '' });
      toast('Contraseña actualizada', 'ok');
    } catch (e2) { toast(e2.code === 'auth/invalid-credential' ? 'La contraseña actual no es correcta' : e2.message, 'err'); }
  };

  const rows = [
    ['ID de Team', member.id], ['Correo', member.email], ['Teléfono', member.phone], ['Nacimiento', member.birthDate ? `${fmtDate(member.birthDate)} (${ageFrom(member.birthDate)} años)` : '—'],
    ['Estatura', member.heightCm ? member.heightCm + ' cm' : '—'], ['Peso inicial', member.weightKg ? member.weightKg + ' kg' : '—'], ['IMC inicial', bmi(member.weightKg, member.heightCm) ?? '—'],
    ['Objetivo', GOALS[member.goal] || '—'], ['Actividad', ACTIVITY[member.activityLevel]?.label || '—'], ['Comidas al día', member.mealsPerDay || '—'],
    ['Alergias', member.allergies || 'Ninguna'],
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar"><h1>Mi perfil</h1></div>
      <div className="card center fade-in" style={{ paddingTop: 32 }}>
        <div style={{ position: 'relative', width: 128, margin: '0 auto' }}>
          <Avatar person={member} size="xl" />
          <button className="icon-btn" style={{ position: 'absolute', right: 0, bottom: 0, background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }} onClick={() => fileRef.current.click()} disabled={busy} aria-label="Cambiar foto">
            <Icon name="camera" size={18} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
        </div>
        <h2 className="mt">{member.firstName} {member.lastName}</h2>
        <div className="muted small">Miembro del Team desde {fmtDate(member.createdAt)}</div>
      </div>

      <PushCard docPath={`members/${member.id}`} compact />

      <div className="grid g2">
        <div className="card">
          <h4>Mis datos</h4>
          <dl className="kv">{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v || '—'}</dd></Fragment>)}</dl>
          <p className="tiny muted mt">Para corregir tus datos clínicos, coméntalo con Keila en tu próxima cita.</p>
        </div>
        <div className="stack">
          <div className="card">
            <h4>Acceso con Google</h4>
            {hasGoogle ? <div className="success-box small">✓ Tu cuenta de Google está vinculada.</div> : (
              <>
                <p className="small muted">Vincula tu cuenta de Google para entrar sin tu ID y contraseña.</p>
                <button className="btn google-btn" onClick={linkGoogle}><Icon name="google" /> Vincular Google</button>
              </>
            )}
          </div>
          {isPasswordUser && (
            <form className="card stack" onSubmit={changePw}>
              <h4 style={{ margin: 0 }}>Cambiar contraseña</h4>
              <Field label="Contraseña actual"><input className="input" type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} autoComplete="current-password" /></Field>
              <Field label="Nueva contraseña"><input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></Field>
              <button className="btn">Actualizar</button>
            </form>
          )}
          <button className="btn ghost" onClick={logout}><Icon name="logout" size={18} /> Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}
