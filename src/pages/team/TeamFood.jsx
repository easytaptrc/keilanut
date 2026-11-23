import { useSession } from '../../lib/session';
import { usePlan } from '../../lib/hooks';
import FoodLog from '../../components/FoodLog';

export default function TeamFood() {
  const { member } = useSession();
  const diet = usePlan(member.id, 'diet').data?.data;
  const m = diet?.macros || {};
  const targets = diet?.calories ? { kcal: Number(diet.calories), p: Number(m.protein) || 0, c: Number(m.carbs) || 0, f: Number(m.fat) || 0 } : null;
  return (
    <div className="stack">
      <div className="topbar"><div><h1>Mis comidas</h1><p className="small muted" style={{ margin: 0 }}>¿Cambiaste algo de tu plan? Registra lo que comiste y ve tus calorías y macros.</p></div></div>
      <FoodLog member={member} targets={targets} />
    </div>
  );
}
