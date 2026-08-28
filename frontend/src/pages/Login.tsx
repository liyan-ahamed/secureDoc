import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Shield, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';
import api from '../api/axios';
import type { LoginFormData } from '../types';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const Login = () => {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const { isDark, toggleTheme } = useTheme();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setApiError(null);
    try {
      const res = await api.post('/auth/login', data);
      const { user, token } = res.data.data;
      login(user, token);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message || 'Something went wrong. Please try again.';
      setApiError(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg relative transition-colors">
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute top-5 right-5 w-9 h-9 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-surface border border-border transition-colors cursor-pointer shadow-sm"
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent text-bg mb-4 shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-primary">SecureDoc</h1>
          <p className="text-muted text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-xl p-8 shadow-sm dark:shadow-2xl dark:shadow-black/50 border border-border transition-colors">
          {/* API Error */}
          {apiError && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-primary mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted" />
                <input
                  id="login-email"
                  type="email"
                  {...register('email')}
                  className="w-full pl-10 pr-4 py-2 rounded-lg text-primary bg-bg border border-border placeholder-muted/60 transition-all focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-primary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted" />
                <input
                  id="login-password"
                  type="password"
                  {...register('password')}
                  className="w-full pl-10 pr-4 py-2 rounded-lg text-primary bg-bg border border-border placeholder-muted/60 transition-all focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  placeholder="Enter your password"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-accent text-bg font-medium text-sm transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted text-sm">
              Don't have an account?{' '}
              <Link to="/signup" className="text-accent hover:text-accent-hover font-medium transition-colors">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
