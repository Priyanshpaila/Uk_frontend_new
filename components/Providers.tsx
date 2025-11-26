"use client";

import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#020817",
            color: "white",
            border: "1px solid #06b6d4"
          }
        }}
      />
    </>
  );
}
