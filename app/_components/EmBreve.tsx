import { Hammer } from 'lucide-react';

export default function EmBreve({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="page">
      <h1 className="page-title">{title}</h1>
      <p className="muted">{desc}</p>

      <div className="ax-empty">
        <span className="ax-empty-ico" aria-hidden="true">
          <Hammer size={22} strokeWidth={2} />
        </span>
        <p className="ax-empty-title">Em construção</p>
        <p className="ax-empty-sub">
          Esta área faz parte do PrintOS e será liberada em breve.
        </p>
      </div>
    </div>
  );
}
