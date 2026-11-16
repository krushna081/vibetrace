import { createRoot } from "react-dom/client";
import "@vibetrace/design-system/styles.css";
import "../styles.css";
import { Popup } from "./Popup.js";

createRoot(document.getElementById("root")!).render(<Popup />);
