import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GovtJobQuiz from "./GovtJobQuiz.jsx";

// Standalone, serverless quiz page.
// Intentionally mounts ONLY the quiz — no AuthProvider, no Supabase, no
// react-router, no splash screen — so it loads instantly and can be shared
// and played without opening the full app.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GovtJobQuiz />
  </StrictMode>
);
