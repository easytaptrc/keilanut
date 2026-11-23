import { useSession } from '../../lib/session';
import ProgressPanel from '../../components/ProgressPanel';
import ProgressPhotos from '../../components/ProgressPhotos';

export default function TeamProgress() {
  const { member } = useSession();
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar"><h1>Mi progreso</h1></div>
      <ProgressPhotos member={member} by="member" />
      <ProgressPanel member={member} by="member" />
    </div>
  );
}
