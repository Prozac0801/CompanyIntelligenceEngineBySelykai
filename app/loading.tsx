export default function Loading() {
  return (
    <main className="loading-state" aria-busy="true" aria-label="Chargement de l'analyse">
      <div className="loading-bar" />
      <div className="loading-title" />
      <div className="loading-copy" />
      <div className="loading-panel" />
    </main>
  );
}
