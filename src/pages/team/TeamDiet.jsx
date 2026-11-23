import { useState } from 'react';
import { useSession } from '../../lib/session';
import { usePlan } from '../../lib/hooks';
import { DietView } from '../../components/PlanViews';
import { Icon, Spinner, useToast } from '../../components/ui';
import { useContact } from '../Home';
const pdfLib = () => import('../../lib/pdf');

export default function TeamDiet() {
  const { member } = useSession();
  const { data, loading } = usePlan(member.id, 'diet');
  const toast = useToast();
  const contact = useContact();
  const [pdfBusy, setPdfBusy] = useState(false);
  const diet = data ? { ...data.data, file: data.file } : null;
  return (
    <div className="stack">
      <div className="topbar">
        <h1>Mi dieta</h1>
        {(data?.data?.days?.length > 0 || data?.data?.meals?.length > 0) && (
          <button className="btn light sm" disabled={pdfBusy} onClick={() => { setPdfBusy(true); pdfLib().then((m) => m.dietPdf(data.data, member, { contact })).catch((e) => toast(e.message, 'err')).finally(() => setPdfBusy(false)); }}>{pdfBusy ? <Spinner /> : <Icon name="download" size={16} />} PDF</button>
        )}
      </div>
      {loading ? <div className="skeleton" style={{ height: 260 }} /> : <DietView diet={diet} updatedAt={data?.updatedAt} />}
    </div>
  );
}
