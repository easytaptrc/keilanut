import { useSession } from '../../lib/session';
import ProgressPanel from '../../components/ProgressPanel';
import ProgressPhotos from '../../components/ProgressPhotos';
import { usePublicSettings } from '../../lib/config';

export default function TeamProgress() {
  const { member } = useSession();
  const cfg = usePublicSettings();
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar"><h1>Mi progreso</h1></div>
      {cfg?.team?.modules?.fotos !== false && <ProgressPhotos member={member} by="member" />}
      <ProgressPanel member={member} by="member" />
    </div>
  );
}
