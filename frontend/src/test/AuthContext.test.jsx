import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';

function AuthHarness() {
  const { user, loginUser, logout } = useAuth();

  return (
    <div>
      <div data-testid="current-user">{user ? `${user.name}:${user.role}` : 'guest'}</div>
      <button onClick={() => loginUser({ name: 'Driver Dana', role: 'driver' })}>Log in</button>
      <button onClick={logout}>Log out</button>
    </div>
  );
}

describe('AuthProvider', () => {
  it('loads an existing user from localStorage on startup', () => {
    localStorage.setItem('sp_user', JSON.stringify({ name: 'Existing Emma', role: 'admin' }));

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    expect(screen.getByTestId('current-user')).toHaveTextContent('Existing Emma:admin');
  });

  it('persists login and clears storage on logout', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    expect(screen.getByTestId('current-user')).toHaveTextContent('guest');

    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByTestId('current-user')).toHaveTextContent('Driver Dana:driver');
    expect(JSON.parse(localStorage.getItem('sp_user'))).toEqual({
      name: 'Driver Dana',
      role: 'driver',
    });

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(screen.getByTestId('current-user')).toHaveTextContent('guest');
    expect(localStorage.getItem('sp_user')).toBeNull();
  });
});
