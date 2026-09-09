export function SimplePage({ title, description }: { title: string; description: string }) {
  return (
    <div className="login">
      <section className="login-card">
        <h1 className="page-title">{title}</h1>
        <p className="muted">{description}</p>
      </section>
    </div>
  );
}