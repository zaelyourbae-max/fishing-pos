"use client";

import { useEffect } from "react";

type AutoPrintInvoiceProps = {
  enabled: boolean;
};

export default function AutoPrintInvoice({ enabled }: AutoPrintInvoiceProps) {
  useEffect(() => {
    if (enabled) {
      window.print();
    }
  }, [enabled]);

  return null;
}
