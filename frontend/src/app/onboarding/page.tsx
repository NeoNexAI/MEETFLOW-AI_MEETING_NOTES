"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { StepWelcome } from "@/components/onboarding/step-welcome";
import { StepModel } from "@/components/onboarding/step-model";
import { StepAiProvider } from "@/components/onboarding/step-ai-provider";

const TOTAL_STEPS = 3;

/**
 * Onboarding shell: progress indicator + step transitions. Step contents live
 * in `@/components/onboarding/*`, each owning its state and IPC calls.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { setOnboardingComplete } = useAppStore();
  const [step, setStep] = useState(1);

  const handleComplete = () => {
    setOnboardingComplete(true);
    router.push("/record");
  };

  const steps = [
    <StepWelcome key="welcome" onNext={() => setStep(2)} />,
    <StepModel key="model" onNext={() => setStep(3)} onBack={() => setStep(1)} />,
    <StepAiProvider key="ai" onNext={handleComplete} onBack={() => setStep(2)} />,
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-base)] px-6 py-10">
      {/* Progress indicator */}
      {step > 1 && (
        <div className="flex items-center gap-1.5 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i + 1 <= step ? "bg-[var(--accent)] w-6" : "bg-[var(--border-strong)] w-3"
              )}
            />
          ))}
        </div>
      )}

      {/* Step content */}
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {steps[step - 1]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
