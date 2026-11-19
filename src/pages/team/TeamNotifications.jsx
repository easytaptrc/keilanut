import { useEffect } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useSession } from '../../lib/session';
import { Empty, Icon } from '../../components/ui';
import { fmtDateTime } from '../../lib/utils';
import PushCard from '../../components/PushCard';

export default function TeamNotifications({ list }) {
  const { member } = useSession();
  // Al abrir, marcamos como leídas
  useEffect(() => {
    const unread = list.filter((n) => !n.read);
    if (!unread.length) return;
    const t = setTimeout(() => {
      const b = writeBatch(db);
      unread.forEach((n) => b.update(doc(db, 'members', member.id, 'notifications', n.id), { read: true }));
      b.commit().catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [list, member.id]);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar"><h1>Avisos</h1></div>
      <PushCard docPath={`members/${member.id}`} />
      {!list.length ? <Empty icon="🔔" title="Sin avisos por ahora">Aquí aparecerán los mensajes de Keila.</Empty> : (
        <div className="stack stagger">
          {list.map((n) => (
            <div key={n.id} className="card row nowrap" style={{ alignItems: 'flex-start', borderColor: n.read ? undefined : 'var(--sage)' }}>
              <span className="avatar"><Icon name={n.type === 'plan' ? 'leaf' : n.type === 'booking' ? 'calendar' : 'bell'} /></span>
              <div className="grow">
                <div className="row between"><b>{n.title}</b><span className="tiny muted">{fmtDateTime(n.createdAt)}</span></div>
                <p className="small" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
