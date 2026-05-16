import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const inviteCode = new URLSearchParams(window.location.search).get('code');
if (inviteCode) sessionStorage.setItem('inviteCode', inviteCode);

createRoot(document.getElementById("root")!).render(<App />);
