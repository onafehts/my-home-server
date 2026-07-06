import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useSession } from "./lib/auth-client";
import { Club } from "./pages/Club";
import { GameDetail } from "./pages/GameDetail";
import { Games } from "./pages/Games";
import { Landing } from "./pages/Landing";
import { Leaderboards } from "./pages/Leaderboards";
import { Login } from "./pages/Login";
import { MyResults } from "./pages/MyResults";
import { Notifications } from "./pages/Notifications";
import { Profile } from "./pages/Profile";
import { RoundDetail } from "./pages/RoundDetail";

function Protected({ children }: { children: JSX.Element }) {
  const { data, isPending } = useSession();
  if (isPending) return <div className="p-8 text-slate-400">Loading…</div>;
  if (!data) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/games" element={<Games />} />
        <Route path="/games/:slug" element={<GameDetail />} />
        <Route path="/rounds/:id" element={<RoundDetail />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
        <Route
          path="/results"
          element={
            <Protected>
              <MyResults />
            </Protected>
          }
        />
        <Route
          path="/notifications"
          element={
            <Protected>
              <Notifications />
            </Protected>
          }
        />
        <Route
          path="/club"
          element={
            <Protected>
              <Club />
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <Profile />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
