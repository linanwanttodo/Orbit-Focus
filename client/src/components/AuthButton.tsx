import React from 'react';
import { Button } from './ui/button';
import { AuthDialog } from './AuthDialog';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

// Login/logout control shown in the top navigation.
// Signed in: avatar with the account name, click to sign out.
// Signed out: opens the sign-in dialog, which offers a QQ account and keeps
// the GitHub OAuth option that already existed.
export const AuthButton: React.FC = () => {
  const { t } = useI18n();
  const { user, logout } = useAuth();

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

  return <AuthDialog triggerLabel={t('auth.loginTitle')} />;
};
