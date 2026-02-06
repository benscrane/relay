import { useEffect, useRef } from 'react';

const WELCOME_DISMISSED_KEY = 'mockd_welcome_dismissed';

export function hasSeenWelcome(): boolean {
  return localStorage.getItem(WELCOME_DISMISSED_KEY) === 'true';
}

export function markWelcomeSeen(): void {
  localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
}

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGetStarted: () => void;
}

const STEPS = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
    title: 'Create an endpoint',
    description: 'Define a URL path and the JSON response it should return.',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Send a request',
    description: 'Hit your mock URL with curl, Postman, or your app code.',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    title: 'See it live',
    description: 'Watch requests stream in real time and inspect every detail.',
  },
];

export function WelcomeModal({ isOpen, onClose, onGetStarted }: WelcomeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleClose = () => {
    markWelcomeSeen();
    onClose();
  };

  const handleGetStarted = () => {
    markWelcomeSeen();
    onGetStarted();
  };

  return (
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={handleClose}>
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-xl text-center mb-2">Welcome to mockd</h3>
        <p className="text-center text-base-content/70 text-sm mb-6">
          Create mock API endpoints in seconds. No server setup required.
        </p>

        <div className="space-y-4 mb-6">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary shrink-0">
                {step.icon}
              </div>
              <div>
                <h4 className="font-medium text-sm text-base-content">{step.title}</h4>
                <p className="text-xs text-base-content/60">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={handleGetStarted} className="btn btn-primary w-full">
            Get Started with a Template
          </button>
          <button onClick={handleClose} className="btn btn-ghost btn-sm w-full">
            Skip, I'll explore on my own
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  );
}
