// app/nhs-services/page.tsx
import type { Metadata } from "next";
import NhsServicesClient from "./NhsServicesClient";


export const metadata: Metadata = {
  title: "NHS prescription service | Pharmacy Express",
  description:
    "Simple NHS prescription nomination with free tracked delivery, friendly pharmacist support and secure repeat ordering.",
};

export default function NhsServicesPage() {
  return <NhsServicesClient />;
}
