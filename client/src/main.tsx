import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const _code = new URLSearchParams(window.location.search).get('code');
if (_code) sessionStorage.setItem('inviteCode', _code);

createRoot(document.getElementById("root")!).render(<App />);
