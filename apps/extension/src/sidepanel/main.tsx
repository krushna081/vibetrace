import { createRoot } from "react-dom/client";
import "@vibetrace/design-system/styles.css";
import "../styles.css";
import { Sidepanel } from "./Sidepanel.js";

createRoot(document.getElementById("root")!).render(<Sidepanel />);
