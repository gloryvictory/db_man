import { Routes, Route } from 'react-router-dom';
import Topbar from './components/Topbar';
import Browser from './pages/Browser';
import Overview from './pages/Overview';

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <Topbar />
      <div className="min-h-0 flex-1">
        <Routes>
          <Route path="/" element={<Browser />} />
          <Route path="/overview" element={<Overview />} />
        </Routes>
      </div>
    </div>
  );
}
