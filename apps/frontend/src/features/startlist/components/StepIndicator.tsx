interface StepIndicatorProps {
  current: number;
  steps: string[];
}

const StepIndicator = ({ current, steps }: StepIndicatorProps): JSX.Element => {
  return (
    <ol className="step-indicator" aria-label="進行状況">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const state = stepNumber === current ? 'current' : stepNumber < current ? 'done' : 'upcoming';
        return (
          <li key={label} className={`step-indicator__item step-indicator__item--${state}`}>
            <span className="step-indicator__number" aria-hidden="true">
              {stepNumber}
            </span>
            <span className="step-indicator__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
};

export default StepIndicator;
