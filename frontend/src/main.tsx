import ReactDOM from "react-dom/client";
import { App } from "@/app/App";
import { AppProviders } from "@/app/AppProviders";
import "@/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <App />
  </AppProviders>
);
