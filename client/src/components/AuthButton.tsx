import React from 'react';
import { LogIn } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

// Login/logout control shown in the top navigation.
// Signed in: avatar with the GitHub login, click to sign out.
// Signed out: login icon, click to start the GitHub OAuth flow.
export const AuthButton: React.FC = () => {
  const { t } = useI18n();
  const { user, login, logout } = useAuth();

  if (user) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={logout}
        title={`${user.login} - ${t('auth.logoutTitle')}`}
        aria-label={t('auth.logoutTitle')}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="h-6 w-6 rounded-full ring-1 ring-gh-border"
            draggable={false}
          />
        ) : (
          <span className="text-xs font-medium text-gh-fg">{user.login.slice(0, 2).toUpperCase()}</span>
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={login}
      title={t('auth.loginTitle')}
      aria-label={t('auth.loginTitle')}
    >
      <LogIn className="h-4 w-4" />
    </Button>
  );
};
