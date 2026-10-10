// pdf.js calls Math.sumPrecise, missing in some browsers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(Math as any).sumPrecise) (Math as any).sumPrecise = (xs: Iterable<number>) => { let t = 0; for (const x of xs) t += x; return t; };
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
