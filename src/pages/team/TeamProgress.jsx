import { useSession } from '../../lib/session';
import ProgressPanel from '../../components/ProgressPanel';

export default function TeamProgress() {
  const { member } = useSession();
  return (
    <div className="stack">
      <div className="topbar"><h1>Mi progreso</h1></div>
      <ProgressPanel member={member} by="member" />
    </div>
  );
}
