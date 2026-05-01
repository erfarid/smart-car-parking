import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApiClient from '../services/ApiClient';

function mockResponse({ ok = true, status = 200, jsonData = {}, textData = 'error' } = {}) {
  return {
    ok,
    status,
    json: vi.fn(async () => jsonData),
    text: vi.fn(async () => textData),
  };
}

describe('ApiClient', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('registers and logs in a user', async () => {
    global.fetch
      .mockResolvedValueOnce(mockResponse({ jsonData: { user_id: 'u1', role: 'user' } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { user_id: 'u1', role: 'user' } }));

    await expect(ApiClient.register('Farid', 'farid@example.com', 'secret12')).resolves.toEqual({ user_id: 'u1', role: 'user' });
    await expect(ApiClient.login('farid@example.com', 'secret12')).resolves.toEqual({ user_id: 'u1', role: 'user' });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/auth/register'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws API detail messages on auth failure', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, jsonData: { detail: 'Invalid credentials' } }));
    await expect(ApiClient.login('a', 'b')).rejects.toThrow('Invalid credentials');
  });

  it('builds list queries for users, messages, sessions, vehicles and payments', async () => {
    global.fetch
      .mockResolvedValueOnce(mockResponse({ jsonData: [{ user_id: '1' }] }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [{ user_id: '1' }] }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [] }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [] }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [] }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [] }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [] }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [] }));

    await ApiClient.listUsers('worker');
    await ApiClient.getUsersSummary('worker');
    await ApiClient.getSentMessages('u1', 'worker', 5);
    await ApiClient.listSessions('2026-01-01', '2026-01-31', 'u1', 'user', 'ABC123');
    await ApiClient.listVehicles('u1', 'user');
    await ApiClient.getUnpaidSessions('ABC123', 'u1', 'user');
    await ApiClient.checkPenalty('ABC123', 'u1', 'user');
    await ApiClient.getNotices('u1', 'user');

    const urls = global.fetch.mock.calls.map((call) => call[0]);
    expect(urls[0]).toContain('/auth/users?role=worker');
    expect(urls[1]).toContain('/auth/users-summary?role=worker');
    expect(urls[2]).toContain('/auth/messages/sent?sender_user_id=u1&sender_role=worker&limit=5');
    expect(urls[3]).toContain('/sessions/?date_from=2026-01-01&date_to=2026-01-31&user_id=u1&role=user&plate_number=ABC123');
    expect(urls[4]).toContain('/vehicles/?user_id=u1&role=user');
    expect(urls[5]).toContain('/payments/unpaid/ABC123?user_id=u1&role=user');
    expect(urls[6]).toContain('/payments/check-penalty/ABC123?user_id=u1&role=user');
    expect(urls[7]).toContain('/payments/notices?user_id=u1&role=user');
  });

  it('creates, updates and deletes zones and vehicles', async () => {
    global.fetch
      .mockResolvedValueOnce(mockResponse({ jsonData: { zone_id: 'D01' } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { zone_id: 'D01' } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { ok: true } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { plate_number: 'ABC123' } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { ok: true } }));

    await ApiClient.createZone({ zone_id: 'D01' });
    await ApiClient.updateZone('D01', { zone_name: 'Updated' });
    await ApiClient.deleteZone('D01');
    await ApiClient.createVehicle({ plate_number: 'ABC123' });
    await ApiClient.deleteVehicle('ABC123');
  });

  it('handles vehicle lookup cases including not found', async () => {
    global.fetch
      .mockResolvedValueOnce(mockResponse({ jsonData: { plate_number: 'ABC123' } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { vehicle_type: 'car' } }))
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 404, jsonData: { detail: 'missing' } }));

    await expect(ApiClient.getVehicle('ABC123', 'u1', 'user')).resolves.toEqual({ plate_number: 'ABC123' });
    await expect(ApiClient.getVehicleDetails('ABC123', 'u1', 'user')).resolves.toEqual({ vehicle_type: 'car' });
    await expect(ApiClient.findVehicle('XYZ999', 'u1', 'user')).resolves.toBeNull();
  });

  it('creates, quotes and closes sessions', async () => {
    global.fetch
      .mockResolvedValueOnce(mockResponse({ jsonData: { session_id: 's1' } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { final_fee: 1000 } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { final_fee: 1500 } }));

    await expect(ApiClient.createSession('ABC123', 'D01', null, 'u1', 'user')).resolves.toEqual({ session_id: 's1' });
    await expect(ApiClient.getSessionQuote('s1', 'u1', 'user')).resolves.toEqual({ final_fee: 1000 });
    await expect(ApiClient.closeSession('s1', null, 'u1', 'user')).resolves.toEqual({ final_fee: 1500 });
  });

  it('uploads images and pays sessions', async () => {
    const file = new File(['plate'], 'plate.png', { type: 'image/png' });
    global.fetch
      .mockResolvedValueOnce(mockResponse({ jsonData: { plate_text: 'ABC123' } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { receipts: [] } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { receipts: [] } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { receipts: [] } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [] }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [] }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [] }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [] }));

    await expect(ApiClient.uploadPlateImage(file)).resolves.toEqual({ plate_text: 'ABC123' });
    await expect(ApiClient.paySessions(['s1'], 'u1', 'Farid', '1234', 'user')).resolves.toEqual({ receipts: [] });
    await expect(ApiClient.checkoutActiveSession('s1', 'u1', 'Farid', '1234', 'user')).resolves.toEqual({ receipts: [] });
    await expect(ApiClient.payAllByPlate('ABC123', 'u1', 'Farid', '1234', 'user')).resolves.toEqual({ receipts: [] });
    await expect(ApiClient.getPaymentHistory('u1')).resolves.toEqual([]);
    await expect(ApiClient.getAdminPaymentRecords()).resolves.toEqual([]);
    await expect(ApiClient.revenueByZone()).resolves.toEqual([]);
    await expect(ApiClient.revenueSummary()).resolves.toEqual([]);
  });

  it('supports health and worker/admin messaging endpoints', async () => {
    global.fetch
      .mockResolvedValueOnce(mockResponse({ jsonData: { ok: true } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { message_id: 'm1' } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { fine_id: 'f1' } }))
      .mockResolvedValueOnce(mockResponse({ jsonData: [{ fine_id: 'f1' }] }))
      .mockResolvedValueOnce(mockResponse({ jsonData: { ok: true } }));

    await expect(ApiClient.healthCheck()).resolves.toEqual({ ok: true });
    await expect(ApiClient.sendAdminMessage('u1', 'driver@example.com', 'Notice', 'Hello', 'admin')).resolves.toEqual({ message_id: 'm1' });
    await expect(ApiClient.scanVehicleAsWorker('u2', 'ABC123', 'driver@example.com', 'missing session')).resolves.toEqual({ fine_id: 'f1' });
    await expect(ApiClient.getWorkerFines('u2', 'worker', 5)).resolves.toEqual([{ fine_id: 'f1' }]);
    await expect(ApiClient.sendWorkerFineNotice('u2', 'f1', 'Please pay')).resolves.toEqual({ ok: true });
  });
});
