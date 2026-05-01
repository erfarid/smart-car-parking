import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';

function mockPage(label) {
  return { default: () => <div>{label}</div> };
}

vi.mock('../pages/LandingPage', () => mockPage('Landing Page'));
vi.mock('../pages/LoginPage', () => mockPage('Login Page'));
vi.mock('../pages/RegisterPage', () => mockPage('Register Page'));
vi.mock('../pages/AdminDashboardPage', () => mockPage('Admin Dashboard Page'));
vi.mock('../pages/DriverDashboardPage', () => mockPage('Driver Dashboard Page'));
vi.mock('../pages/SessionsPage', () => mockPage('Sessions Page'));
vi.mock('../pages/ZoneConfigPage', () => mockPage('Zone Config Page'));
vi.mock('../pages/UploadImagePage', () => mockPage('Upload Image Page'));
vi.mock('../pages/ReportsPage', () => mockPage('Reports Page'));
vi.mock('../pages/ProfilePage', () => mockPage('Profile Page'));
vi.mock('../pages/PaymentPage', () => mockPage('Payment Page'));
vi.mock('../pages/UsersPage', () => mockPage('Users Page'));
vi.mock('../pages/WorkersPage', () => mockPage('Workers Page'));
vi.mock('../pages/MessagesPage', () => mockPage('Messages Page'));
vi.mock('../pages/WorkerDashboardPage', () => mockPage('Worker Dashboard Page'));

function setLoggedInUser(user) {
  localStorage.setItem('sp_user', JSON.stringify(user));
}

describe('App routing', () => {
  it('redirects guests to the landing page for protected routes', async () => {
    window.history.pushState({}, '', '/driver');

    render(<App />);

    expect(await screen.findByText('Landing Page')).toBeInTheDocument();
  });

  it('shows the admin dashboard for an admin user on the root route', async () => {
    setLoggedInUser({ name: 'Alice Admin', role: 'admin' });
    window.history.pushState({}, '', '/');

    render(<App />);

    expect(await screen.findByText('Admin Dashboard Page')).toBeInTheDocument();
    expect(screen.getByText('Welcome, Alice Admin')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('redirects worker users away from the payment page to the worker dashboard', async () => {
    setLoggedInUser({ name: 'Wendy Worker', role: 'worker' });
    window.history.pushState({}, '', '/payment');

    render(<App />);

    expect(await screen.findByText('Worker Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('Payment Page')).not.toBeInTheDocument();
  });
});
