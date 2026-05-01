import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import RegisterPage from '../pages/RegisterPage';
import ApiClient from '../services/ApiClient';

vi.mock('../services/ApiClient', () => ({
  default: {
    register: vi.fn(),
  },
}));

function renderRegisterPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/driver" element={<div>Driver Dashboard</div>} />
          <Route path="/worker" element={<div>Worker Dashboard</div>} />
          <Route path="/" element={<div>Admin Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('RegisterPage', () => {
  it('registers a normal user and redirects to the driver dashboard', async () => {
    const user = userEvent.setup();
    ApiClient.register.mockResolvedValue({ name: 'New User', role: 'user' });

    renderRegisterPage();

    await user.type(screen.getByPlaceholderText('Enter your name'), 'New User');
    await user.type(screen.getByPlaceholderText('Enter your email'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('Create a password'), 'secret12');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(ApiClient.register).toHaveBeenCalledWith('New User', 'new@example.com', 'secret12', 'user', '');
    });
    expect(await screen.findByText('Driver Dashboard')).toBeInTheDocument();
  });

  it('shows the worker authorization field and backend errors', async () => {
    const user = userEvent.setup();
    ApiClient.register.mockRejectedValue(new Error('Invalid worker code'));

    renderRegisterPage();

    await user.type(screen.getByPlaceholderText('Enter your name'), 'Worker Willa');
    await user.type(screen.getByPlaceholderText('Enter your email'), 'worker@example.com');
    await user.type(screen.getByPlaceholderText('Create a password'), 'secret12');
    await user.selectOptions(screen.getByRole('combobox'), 'worker');
    expect(screen.getByPlaceholderText('Enter worker code')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Enter worker code'), 'bad-code');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Invalid worker code')).toBeInTheDocument();
  });
});
