import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Board from "./pages/Board";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/b/:boardId" element={<Board />} />
    </Routes>
  );
}
