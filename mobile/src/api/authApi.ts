import client from './client';

export interface AuthResponse {
  token: string;
  user: User;
  isNew: boolean;
}

export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  created_at: number;
  last_seen_at: number;
}

export async function sendCode(target: string): Promise<void> {
  await client.post('/auth/send-code', { target });
}

export async function verifyCode(
  target: string,
  code: string
): Promise<AuthResponse> {
  const res = await client.post('/auth/verify', { target, code });
  return res.data;
}
