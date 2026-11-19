import { useSession } from '../../lib/session';
import { usePlan } from '../../lib/hooks';
import { DietView } from '../../components/PlanViews';
import { Icon, useToast } from '../../components/ui';
const pdfLib = () => import('../../lib/pdf');

export default function TeamDiet() {
  const { member } = useSession();
  const { data, loading } = usePlan(member.id, 'diet');
  const toast = useToast();
  const diet = data ? { ...data.data, file: data.file } : null;
  return (
    <div className="stack">
      <div className="topbar">
        <h1>Mi dieta</h1>
        {data?.data?.meals?.length > 0 && (
          <button className="btn light sm" onClick={() => pdfLib().then((m) => m.dietPdf(data.data, member)).catch((e) => toast(e.message, 'err'))}><Icon name="download" size={16} /> PDF</button>
        )}
      </div>
      {loading ? <div className="skeleton" style={{ height: 260 }} /> : <DietView diet={diet} updatedAt={data?.updatedAt} />}
    </div>
  );
}
