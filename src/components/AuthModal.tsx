import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { CheckCircle2, RefreshCw, ShieldCheck, LogOut, X } from 'lucide-react';
import { createRecaptchaChallenge, validateRecaptchaAnswer } from '../utils/physicsEngine';
import { appleSignIn, googleSignIn, logout, microsoftSignIn } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  hasWorkspaceToken: boolean;
  onSignedIn: (user: User, provider: 'google.com' | 'apple.com' | 'microsoft.com', accessToken?: string) => void;
}

const ShapeGlyph: React.FC<{ shape: 'gear' | 'torus' | 'airfoil' | 'truss' }> = ({ shape }) => {
  if (shape === 'gear') {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 stroke-sky-300 fill-none" strokeWidth="2">
        <circle cx="20" cy="20" r="9" />
        <circle cx="20" cy="20" r="3" />
        <path d="M20 4v4M20 32v4M4 20h4M32 20h4M9 9l3 3M28 28l3 3M31 9l-3 3M12 28l-3 3" />
      </svg>
    );
  }
  if (shape === 'torus') {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 stroke-sky-300 fill-none" strokeWidth="2">
        <ellipse cx="20" cy="20" rx="14" ry="8" />
        <ellipse cx="20" cy="20" rx="6" ry="3" />
        <path d="M12 13c2 4 2 10 0 14M28 13c-2 4-2 10 0 14" />
      </svg>
    );
  }
  if (shape === 'airfoil') {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8 stroke-sky-300 fill-none" strokeWidth="2">
        <path d="M6 23c6-10 18-11 28-3-10 2-20 4-28 3z" />
        <path d="M5 13h28M5 29h24" strokeOpacity="0.45" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" className="w-8 h-8 stroke-sky-300 fill-none" strokeWidth="2">
      <path d="M5 28h30M9 14h22M5 28L9 14l6 14 5-14 5 14 6-14 4 14" />
    </svg>
  );
};

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  hasWorkspaceToken,
  onSignedIn,
}) => {
  const [seed, setSeed] = useState<number>(() => Date.now());
  const challenge = useMemo(() => createRecaptchaChallenge(seed), [seed]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [recaptchaVerified, setRecaptchaVerified] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [includeChat, setIncludeChat] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerifyRecaptcha = async (optionId: string) => {
    setSelectedId(optionId);
    setErrorMessage(null);
    if (!validateRecaptchaAnswer(challenge, optionId)) {
      setRecaptchaVerified(false);
      setRecaptchaToken(null);
      setErrorMessage('Incorrect geometry selected. Try again or refresh challenge.');
      return;
    }
    try {
      const res = await fetch('/api/recaptcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.id,
          selectedId: optionId,
          expectedId: challenge.expectedId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        throw new Error(data.error || 'reCAPTCHA check failed');
      }
      setRecaptchaVerified(true);
      setRecaptchaToken(data.token);
      setStatusMessage('reCAPTCHA verified. Official OAuth providers unlocked.');
    } catch (err) {
      setRecaptchaVerified(false);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to verify reCAPTCHA');
    }
  };

  const refreshChallenge = () => {
    setSeed((s) => s + 1);
    setSelectedId('');
    setRecaptchaVerified(false);
    setRecaptchaToken(null);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleGoogleLogin = async () => {
    if (!recaptchaVerified) {
      setErrorMessage('Complete the reCAPTCHA verification step before signing in.');
      return;
    }
    setBusyProvider('google');
    setErrorMessage(null);
    try {
      const { user: signedUser, accessToken } = await googleSignIn(includeChat);
      onSignedIn(signedUser, 'google.com', accessToken);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Google Sign-In failed or was cancelled.');
    } finally {
      setBusyProvider(null);
    }
  };

  const handleAppleLogin = async () => {
    if (!recaptchaVerified) {
      setErrorMessage('Complete the reCAPTCHA verification step before signing in.');
      return;
    }
    setBusyProvider('apple');
    setErrorMessage(null);
    try {
      const { user: signedUser } = await appleSignIn();
      onSignedIn(signedUser, 'apple.com');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Apple Sign-In failed.';
      setErrorMessage(
        `${msg} (Note: Apple OAuth requires Apple Services ID configuration in Firebase Console; Google Sign-In is fully provisioned.)`
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleMicrosoftLogin = async () => {
    if (!recaptchaVerified) {
      setErrorMessage('Complete the reCAPTCHA verification step before signing in.');
      return;
    }
    setBusyProvider('microsoft');
    setErrorMessage(null);
    try {
      const { user: signedUser } = await microsoftSignIn();
      onSignedIn(signedUser, 'microsoft.com');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microsoft Sign-In failed.';
      setErrorMessage(
        `${msg} (Note: Microsoft Entra OAuth requires tenant client configuration in Firebase Console; Google Sign-In is fully provisioned.)`
      );
    } finally {
      setBusyProvider(null);
    }
  };

  const handleSignOut = async () => {
    await logout();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-heading"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#111827] border border-slate-700/80 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h2 id="auth-modal-heading" className="font-display text-lg font-semibold text-slate-100">
              Account & Workspace Authentication
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md cursor-pointer"
            aria-label="Close authentication modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {user && (
            <div className="rounded-xl bg-[#0D131F] border border-slate-700 p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">
                  {user.displayName || 'Authenticated Engineer'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {user.email || 'Private relay email'} · Workspace Token:{' '}
                  <span className={hasWorkspaceToken ? 'text-emerald-400' : 'text-amber-300'}>
                    {hasWorkspaceToken ? 'Active (in-memory)' : 'Re-auth Google for Workspace APIs'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}

          {/* Interactive reCAPTCHA Verification Gate */}
          <div className="rounded-xl bg-[#0D131F] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {recaptchaVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  reCAPTCHA v3 Human Geometry Gate
                </span>
              </div>
              <button
                type="button"
                onClick={refreshChallenge}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-sky-300 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New Challenge
              </button>
            </div>

            <p className="text-sm text-slate-200">{challenge.prompt}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {challenge.options.map((opt) => {
                const isSelected = selectedId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`recaptcha-opt-${opt.id}`}
                    onClick={() => handleVerifyRecaptcha(opt.id)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      isSelected && recaptchaVerified
                        ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                        : isSelected
                          ? 'bg-red-500/15 border-red-400 text-red-200'
                          : 'bg-[#121B2B] border-slate-700/80 hover:border-sky-400/60 text-slate-300'
                    }`}
                  >
                    <ShapeGlyph shape={opt.shape} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {recaptchaToken && (
              <p className="text-xs font-mono text-emerald-400 truncate">
                Verified Token: {recaptchaToken}
              </p>
            )}
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeChat}
              onChange={(e) => setIncludeChat(e.target.checked)}
              className="mt-0.5 rounded border-slate-600 bg-slate-900 text-sky-500"
            />
            <span>
              Include Google Chat enterprise Workspace scopes (enable only for managed Google Workspace domains; leave unchecked for standard @gmail.com accounts).
            </span>
          </label>

          {/* Official Branded OAuth Buttons */}
          <div className="space-y-3">
            {/* Official Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={busyProvider !== null}
              data-testid="btn-oauth-google"
              className={`w-full h-11 px-4 rounded-lg bg-white hover:bg-slate-100 text-[#1F1F1F] border border-[#747775] font-medium text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-60 ${
                !recaptchaVerified ? 'opacity-70' : ''
              }`}
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span>{busyProvider === 'google' ? 'Connecting Google Workspace...' : 'Sign in with Google'}</span>
            </button>

            {/* Official Apple Sign-In Button */}
            <button
              type="button"
              onClick={handleAppleLogin}
              disabled={busyProvider !== null}
              data-testid="btn-oauth-apple"
              className={`w-full h-11 px-4 rounded-lg bg-black hover:bg-neutral-900 text-white border border-neutral-700 font-medium text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-60 ${
                !recaptchaVerified ? 'opacity-70' : ''
              }`}
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 170 170" aria-hidden="true">
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.13-1.9-14.34-6.08-3.69-3.03-7.61-7.84-11.77-14.42-5.04-7.9-9.17-17.07-12.39-27.51-3.44-11.06-5.17-21.75-5.17-32.06 0-12.44 3.11-22.71 9.33-30.82 6.22-8.11 13.97-12.28 23.25-12.51 4.81 0 10.42 1.48 16.84 4.44 6.41 2.97 10.55 4.49 12.4 4.58 1.48 0 6.13-1.76 13.97-5.27 7.83-3.5 14.43-4.96 19.79-4.36 14.52 1.18 25.43 6.94 32.73 17.28-12.98 7.88-19.39 18.87-19.23 32.97.14 10.97 4.28 20.1 12.42 27.39 5.58 5.01 12.01 8.13 19.28 9.37-1.56 4.55-3.22 8.71-4.97 12.48zM119.22 31.01c0 8.6-3.14 16.65-9.41 24.13-7.55 8.85-16.71 13.95-26.64 13.16-.12-1.01-.19-2.08-.19-3.2 0-8.26 3.59-17.1 10.02-24.37 3.21-3.67 7.29-6.72 12.24-9.14 4.94-2.41 9.6-3.75 13.97-4.01.01 1.14.01 2.28.01 3.43z" />
              </svg>
              <span>{busyProvider === 'apple' ? 'Connecting Apple ID...' : 'Sign in with Apple'}</span>
            </button>

            {/* Official Microsoft Sign-In Button */}
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={busyProvider !== null}
              data-testid="btn-oauth-microsoft"
              className={`w-full h-11 px-4 rounded-lg bg-[#2F2F2F] hover:bg-[#3B3B3B] text-white border border-[#8C8C8C]/50 font-medium text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-60 ${
                !recaptchaVerified ? 'opacity-70' : ''
              }`}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              <span>{busyProvider === 'microsoft' ? 'Connecting Microsoft...' : 'Sign in with Microsoft'}</span>
            </button>
          </div>

          {statusMessage && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 text-xs text-emerald-300">
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-300">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
