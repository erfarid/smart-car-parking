import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';
import ApiClient from '../services/ApiClient';

vi.mock('../services/ApiClient', () => ({
  default: {
    login: vi.fn(),
  },
}));

function renderLoginPage(initialPath = '/login') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/driver" element={<div>Driver Dashboard</div>} />
          <Route path="/worker" element={<div>Worker Dashboard</div>} />
          <Route path="/" element={<div>Admin Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('LoginPage', () => {
  it('logs in a driver and navigates to the driver dashboard', async () => {
    const user = userEvent.setup();
    ApiClient.login.mockResolvedValue({ name: 'Driver Dana', role: 'driver' });

    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'driver@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(ApiClient.login).toHaveBeenCalledWith('driver@example.com', 'secret123');
    expect(await screen.findByText('Driver Dashboard')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('sp_user'))).toEqual({
      name: 'Driver Dana',
      role: 'driver',
    });
  });

  it('shows an error when the login request fails', async () => {
    const user = userEvent.setup();
    ApiClient.login.mockRejectedValue(new Error('Invalid credentials'));

    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'driver@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
    });
  });
});
