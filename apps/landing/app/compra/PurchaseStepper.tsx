import type { PurchaseStep, PurchaseStepId } from "./purchaseState";

type PurchaseStepperProps = {
  currentStep: PurchaseStepId;
  steps: PurchaseStep[];
  onStepSelect?: (step: PurchaseStepId) => void;
};

export function PurchaseStepper({
  currentStep,
  steps,
  onStepSelect,
}: PurchaseStepperProps) {
  return (
    <nav
      aria-label="Progreso de compra"
      className="sticky top-0 z-30 -mx-4 border-b border-white/10 bg-[#050505]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-[#0a0a0a] sm:p-4"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
        Paso {currentStep} de {steps.length}
      </p>
      <ol className="grid grid-cols-4 gap-1 sm:gap-2">
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isComplete = step.id < currentStep;
          const state = isActive
            ? "active"
            : isComplete
              ? "complete"
              : "upcoming";
          const content = (
            <>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                  isActive
                    ? "bg-white text-black"
                    : isComplete
                      ? "bg-[#e91e63] text-white"
                      : "bg-white/10 text-white/55"
                }`}
              >
                {isComplete ? "✓" : step.id}
              </span>
              <span
                className={`mt-2 block truncate text-[11px] font-semibold sm:text-xs ${
                  isActive ? "text-white" : "text-white/55"
                }`}
              >
                {step.label}
              </span>
            </>
          );

          return (
            <li key={step.id} data-state={state} className="min-w-0">
              {onStepSelect ? (
                <button
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  onClick={() => onStepSelect(step.id)}
                  className="flex w-full min-w-0 flex-col items-center rounded-xl px-1 py-1 text-center transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e91e63]"
                >
                  {content}
                </button>
              ) : (
                <div
                  aria-current={isActive ? "step" : undefined}
                  className="flex min-w-0 flex-col items-center rounded-xl px-1 py-1 text-center"
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
