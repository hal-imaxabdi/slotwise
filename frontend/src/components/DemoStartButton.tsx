import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth.ts';
import { useDemoLogin } from '../hooks/useDemoLogin.ts';
import { DEMO_ACCOUNTS } from '../lib/demoAccounts.ts';
import type { DemoAccount } from '../lib/demoAccounts.ts';
import { WAKING_MESSAGE } from './LoadingScreen.tsx';

/**
 * "Try the live demo" that goes straight in: signs in with the shared demo login and opens
 * that role's start page. Shows progress, the cold-start hint and any error in place.
 */
export function DemoStartButton({
  className,
  children,
  account = DEMO_ACCOUNTS[0],
}: {
  className?: string;
  children: ReactNode;
  account?: DemoAccount;
}) {
  const demo = useDemoLogin();
  const { status } = useAuth();
  const navigate = useNavigate();
  const pending = demo.state.kind === 'pending';

  useEffect(() => {
    if (status === 'authenticated' && demo.target !== null) {
      void navigate(demo.target, { replace: true });
    }
  }, [status, demo.target, navigate]);

  return (
    <span className="demo-start">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          void demo.start(account);
        }}
      >
        {pending ? 'Opening the demo...' : children}
      </button>
      {pending && demo.slow && (
        <span role="status" className="demo-start__note">
          {WAKING_MESSAGE}
        </span>
      )}
      {demo.state.kind === 'error' && (
        <span role="alert" className="demo-start__note demo-start__note--error">
          {demo.state.message}
        </span>
      )}
    </span>
  );
}
