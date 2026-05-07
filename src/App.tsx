import { Link, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { ExperimentRoute } from './routes/experiment';
import { Home } from './routes/home';
import { TopicRoute } from './routes/topic';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function App() {
  return (
    <Router basename={base}>
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-lab mx-auto px-4 py-4 flex items-center gap-6">
          <Link to="/" className="font-semibold text-navy">
            HTX Labs
          </Link>
          <nav className="flex gap-4 text-sm text-slate-600">
            <Link to="/" className="hover:text-accent">
              Forsiden
            </Link>
            <Link to="/emner" className="hover:text-accent">
              Emner
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-lab mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/emner" element={<Home />} />
          <Route path="/emner/:topic" element={<TopicRoute />} />
          <Route path="/emner/:topic/:experiment" element={<ExperimentRoute />} />
        </Routes>
      </main>
    </Router>
  );
}
