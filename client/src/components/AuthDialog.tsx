import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import type { AuthReason } from '../services/apiService';

/** Map a server reason code to a localized sentence. */
function reasonMessage(t: (key: string) => string, reason: AuthReason | null, status: number): string {
  if (reason) {
    const known = [
      'qqRequired',
      'qqNotNumeric',
      'qqTooShort',
      'qqTooLong',
      'emailRequired',
      'emailNotQq',
      'emailMismatch',
      'passwordTooShort',
      'passwordTooLong',
      'alreadyRegistered',
    ];
    // An unrecognized code means the server is newer than this client; fall
    // back to the generic error rather than showing a raw key.
    if (known.includes(reason)) return t('auth.error.' + reason);
  }
  if (status === 429) return t('auth.error.rateLimited');
  if (status === 0) return t('auth.error.network');
  return t('auth.error.generic');
}

export interface AuthDialogProps {
  /** Label of the control that opens the dialog. */
  triggerLabel: string;
}

// Sign-in dialog for QQ accounts, with a GitHub fallback. Both paths coexist:
// GitHub OAuth for anyone already using it, QQ + password for everyone else.
export const AuthDialog: React.FC<AuthDialogProps> = ({ triggerLabel }) => {
  const { t } = useI18n();
  const { login, loginWithPassword, registerWithPassword } = useAuth();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [qq, setQq] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setQq('');
    setEmail('');
    setPassword('');
    setError(null);
    setBusy(false);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const attempt = mode === 'register'
      ? await registerWithPassword({ qq, email, password })
      : await loginWithPassword({ qq, email, password });
    setBusy(false);
    if (attempt.ok) {
      // Success: the context already holds the session, so just dismiss.
      setOpen(false);
      return;
    }
    setError(reasonMessage(t, attempt.reason, attempt.status));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title={triggerLabel} aria-label={triggerLabel}>
          <LogIn className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t(mode === 'login' ? 'auth.loginTitle' : 'auth.registerTitle')}</DialogTitle>
          <DialogDescription>{t('auth.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex rounded-lg bg-gh-inset p-1 text-xs font-medium">
          {(['login', 'register'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
                mode === value
                  ? 'bg-gh-surface text-gh-fg shadow-sm'
                  : 'text-gh-muted hover:text-gh-fg'
              }`}
            >
              {t(value === 'login' ? 'auth.loginTitle' : 'auth.registerTitle')}
            </button>
          ))}
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-gh-muted">
            {t('auth.qqNumber')}
            <Input
              value={qq}
              onChange={(event) => setQq(event.target.value)}
              inputMode="numeric"
              autoComplete="username"
              placeholder="123456"
              autoFocus
            />
          </label>

          {mode === 'register' && (
            <label className="flex flex-col gap-1.5 text-xs font-medium text-gh-muted">
              {t('auth.qqEmail')}
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="123456@qq.com"
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-xs font-medium text-gh-muted">
            {t('auth.password')}
            <Input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <div className="rounded-lg bg-gh-error-bg px-3 py-2 text-xs text-gh-danger">{error}</div>}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={login}
            className="text-xs text-gh-muted"
            disabled={busy}
          >
            {t('auth.continueWithGitHub')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close} disabled={busy}>{t('common.cancel')}</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? t('common.loading') : t(mode === 'login' ? 'auth.loginTitle' : 'auth.registerTitle')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
