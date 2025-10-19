import { useLocation, useNavigate } from 'react-router-dom';

type Step = {
  label: string;
  path: string;
  isEnabled: boolean;
};

interface StepIndicatorProps {
  steps: Step[];
  basePath: string;
}

const StepIndicator = ({ steps, basePath }: StepIndicatorProps): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

  const currentIndex = steps.findIndex((step) =>
    location.pathname.startsWith(`${normalizedBase}/${step.path.replace(/^\/+/, '')}`),
  );
  const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <ol className="step-indicator" aria-label="進行状況">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const state =
          index === safeCurrentIndex ? 'current' : index < safeCurrentIndex ? 'done' : 'upcoming';
        const handleClick = () => {
          if (!step.isEnabled) {
            return;
          }
          navigate(`${normalizedBase}/${step.path.replace(/^\/+/, '')}`);
        };
        return (
          <li key={step.path} className={`step-indicator__item step-indicator__item--${state}`}>
            <button
              type="button"
              onClick={handleClick}
              className="unstyled-button step-indicator__button"
              disabled={!step.isEnabled}
            >
              <span className="step-indicator__number" aria-hidden="true">
                {stepNumber}
              </span>
              <span className="step-indicator__label">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
};

export default StepIndicator;
