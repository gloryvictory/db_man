import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Topbar from './components/Topbar';
import Browser from './pages/Browser';
import Overview from './pages/Overview';
import LoginScreen from './components/LoginScreen';
import { Loader } from './components/ui';
import { useAuth } from './store/authStore';

export default function App() {
  const auth = useAuth();

  useEffect(() => {
    auth.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (auth.loading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader size={28} />
      </div>
    );
  }

  if (!auth.user) {
    return <LoginScreen />;
  }

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
