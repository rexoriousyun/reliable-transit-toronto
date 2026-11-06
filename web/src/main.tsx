import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { applyTheme, storedTheme } from "./theme.js";
import "./styles.css";

// Before first paint, so the sheet never renders light and then flips (D-42).
applyTheme(storedTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
