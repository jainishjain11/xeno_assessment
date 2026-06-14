import { useMutation } from '@tanstack/react-query';
import api from '@/lib/axios';
import { useAuthStore, type AuthUser } from '@/store/auth';

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  user: AuthUser;
}

/**
 * Calls POST /auth/login, then stores token + user in Zustand.
 */
export function useLogin() {
  const { login } = useAuthStore();

  return useMutation<LoginResponse, Error, LoginPayload>({
    mutationFn: async (payload) => {
      const { data } = await api.post<LoginResponse>('/auth/login', payload);
      return data;
    },
    onSuccess: (data) => {
      login(data.access_token, data.user);
    },
  });
}

/**
 * Returns current auth state helpers.
 */
export function useCurrentUser() {
  const { user, token } = useAuthStore();
  return { user, token, isAuthenticated: !!token };
}

/**
 * Logout — clears store and navigates to /login (navigation handled at call site).
 */
export function useLogout() {
  const { logout } = useAuthStore();
  return logout;
}
