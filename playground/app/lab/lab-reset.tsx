"use client";

import { useEffect } from "react";

// Drops the classic edition tokens if the <html> element still carries them.
export function LabReset() {
  useEffect(() => {
    document.documentElement.removeAttribute("data-edition");
  }, []);
  return null;
}
