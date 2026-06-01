import { setBaseUrl } from "../../../lib/api-client-react/src/index";

setBaseUrl("https://gralix-backend.onrender.com");

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n/config";

createRoot(document.getElementById("root")!).render(<App />);
