import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { AIChat } from "./AIChat";

export function AIChatFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
      <AIChat open={open} onOpenChange={setOpen} />
    </>
  );
}