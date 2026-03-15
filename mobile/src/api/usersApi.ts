import client from './client';
import { User } from './authApi';

export async function getMe(): Promise<User> {
  const res = await client.get('/users/me');
  return res.data;
}

export async function updateMe(fields: Partial<Pick<User, 'username' | 'display_name' | 'avatar_url'> & { username: string | null }>): Promise<User> {
  const res = await client.patch('/users/me', fields);
  return res.data;
}

export async function searchUsers(query: string): Promise<User[]> {
  const res = await client.get('/users/search', { params: { q: query } });
  return res.data;
}

export async function getUserById(id: string): Promise<User> {
  const res = await client.get(`/users/${id}`);
  return res.data;
}
