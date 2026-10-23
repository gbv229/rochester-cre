import { Suspense } from "react";
import Screener from "./Screener";

export const metadata = { title: "Property screener" };

export default function Page() {
  return (
    <Suspense>
      <Screener />
    </Suspense>
  );
}
