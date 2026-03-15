import { ThemeToggle } from "./components/ThemeToggle";
import { SummaryTable } from "./components/SummaryTable";
import { PointsTable } from "./components/PointsTable";

export default function DashboardPage() {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="dashboard-title">PI Garden Dashboard</h1>
        <ThemeToggle />
      </header>
      <main className="dashboard-main">
        <section className="dashboard-section">
          <h2 className="section-title">mqtt_summary</h2>
          <div className="card surface-container">
            <SummaryTable />
          </div>
        </section>
        <section className="dashboard-section">
          <h2 className="section-title">mqtt_points</h2>
          <div className="card surface-container">
            <PointsTable />
          </div>
        </section>
      </main>
    </div>
  );
}
