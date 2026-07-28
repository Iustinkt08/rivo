import { api } from './client';
import { normalizeUsername } from '../../utils/loginIdentifier';
import { mapStaffLoginResponse, StaffSession } from '../../utils/staffSession';

// Staff accounts authenticate against the backend (username + password),
// completely independent of Supabase — see auth/staff-* endpoints.
export const staffAuthApi = {
  async login(username: string, password: string): Promise<StaffSession> {
    const { data } = await api.post('/auth/staff/login', {
      username: normalizeUsername(username),
      password,
    });
    return mapStaffLoginResponse(data);
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await api.post('/auth/staff/change-password', {
      currentPassword,
      newPassword,
    });
  },
};
