import type { Metadata } from "next";
import ServiceListPage from "./ServiceDetailsPage";


export const metadata: Metadata = {
  title: "Private service ",
  description:
    "Simple NHS prescription nomination with free tracked delivery, friendly pharmacist support and secure repeat ordering.",
};

export default function NhsServicesPage() {
  return <ServiceListPage />;
}
