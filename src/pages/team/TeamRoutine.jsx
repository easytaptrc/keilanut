import { useState } from 'react';
import { useSession } from '../../lib/session';
import { usePlan } from '../../lib/hooks';
import { ExerciseLibrary, RoutineView } from '../../components/PlanViews';
import { Icon, Spinner, useToast } from '../../components/ui';
import { useContact } from '../Home';
const pdfLib = () => import('../../lib/pdf');
import { cx } from '../../lib/utils';

export default function TeamRoutine() {
  const { member } = useSession();
  const { data, loading } = usePlan(member.id, 'routine');
  const toast = useToast();
  const contact = useContact();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [tab, setTab] = useState('mia');
  const routine = data ? { ...data.data, file: data.file } : null;
  return (
    <div className="stack">
      <div className="topbar">
        <h1>Mi rutina</h1>
        {tab === 'mia' && data?.data?.days?.length > 0 && (
          <button className="btn light sm" disabled={pdfBusy} onClick={() => { setPdfBusy(true); pdfLib().then((m) => m.routinePdf(data.data, member, { contact })).catch((e) => toast(e.message, 'err')).finally(() => setPdfBusy(false)); }}>{pdfBusy ? <Spinner /> : <Icon name="download" size={16} />} PDF</button>
        )}
      </div>
      <div className="tabs">
        <button className={cx('tab', tab === 'mia' && 'on')} onClick={() => setTab('mia')}>Mi plan</button>
        <button className={cx('tab', tab === 'bib' && 'on')} onClick={() => setTab('bib')}>Biblioteca de ejercicios</button>
      </div>
      {tab === 'mia'
        ? (loading ? <div className="skeleton" style={{ height: 260 }} /> : <RoutineView routine={routine} updatedAt={data?.updatedAt} />)
        : <ExerciseLibrary />}
    </div>
  );
}
