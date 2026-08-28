import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Shield, Building2, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import type { SignupFormData } from '../types';

const signupSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    accountType: z.enum(['INDIVIDUAL', 'ORGANIZATION']),
    orgName: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine(
    (d) => d.accountType !== 'ORGANIZATION' || (d.orgName && d.orgName.length >= 2),
    {
      message: 'Organization name is required',
      path: ['orgName'],
    }
  );

const Signup = () => {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [accountType, setAccountType] = useState<'INDIVIDUAL' | 'ORGANIZATION'>('INDIVIDUAL');
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { accountType: 'INDIVIDUAL' },
  });

  const onSubmit = async (data: SignupFormData) => {
    setApiError(null);
    try {
      const res = await api.post('/auth/signup', {
        email: data.email,
        password: data.password,
        name: data.name,
        accountType: data.accountType,
        ...(data.accountType === 'ORGANIZATION' && { orgName: data.orgName }),
      });
      const { user, token } = res.data.data;
      login(user, token);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message || 'Something went wrong. Please try again.';
      setApiError(message);
    }
  };

  const handleAccountType = (type: 'INDIVIDUAL' | 'ORGANIZATION') => {
    setAccountType(type);
    setValue('accountType', type);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent text-white mb-4 shadow-xl shadow-indigo-500/25">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-primary">SecureDoc</h1>
          <p className="text-muted text-sm mt-1">Create your account</p>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl p-8">
          {/* API Error */}
          {apiError && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Account Type Toggle */}
            <div>
              <label className="block text-sm font-medium text-primary mb-2">Account Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleAccountType('INDIVIDUAL')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                    accountType === 'INDIVIDUAL'
                      ? 'border-accent bg-accent/10 text-accent ring-1 ring-accent/30'
                      : 'border-white/10 bg-white/5 text-muted hover:border-white/25 hover:text-primary'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => handleAccountType('ORGANIZATION')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                    accountType === 'ORGANIZATION'
                      ? 'border-accent bg-accent/10 text-accent ring-1 ring-accent/30'
                      : 'border-white/10 bg-white/5 text-muted hover:border-white/25 hover:text-primary'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Organization
                </button>
              </div>
              <input type="hidden" {...register('accountType')} />
            </div>

            {/* Name */}
            <div>
              <label htmlFor="signup-name" className="block text-sm font-medium text-primary mb-1.5">
                Full Name
              </label>
              <input
                id="signup-name"
                type="text"
                {...register('name')}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-primary placeholder-muted transition-all focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                placeholder="John Doe"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
              )}
            </div>

            {/* Org Name (conditional) */}
            {accountType === 'ORGANIZATION' && (
              <div>
                <label htmlFor="signup-orgname" className="block text-sm font-medium text-primary mb-1.5">
                  Organization Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted" />
                  <input
                    id="signup-orgname"
                    type="text"
                    {...register('orgName')}
                    className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-primary placeholder-muted transition-all focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    placeholder="Acme Inc."
                  />
                </div>
                {errors.orgName && (
                  <p className="mt-1 text-xs text-danger">{errors.orgName.message}</p>
                )}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-primary mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted" />
                <input
                  id="signup-email"
                  type="email"
                  {...register('email')}
                  className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-primary placeholder-muted transition-all focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-primary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted" />
                <input
                  id="signup-password"
                  type="password"
                  {...register('password')}
                  className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-primary placeholder-muted transition-all focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  placeholder="Min. 8 characters"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="signup-confirm" className="block text-sm font-medium text-primary mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted" />
                <input
                  id="signup-confirm"
                  type="password"
                  {...register('confirmPassword')}
                  className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-primary placeholder-muted transition-all focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  placeholder="Re-enter your password"
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-danger">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-accent text-white font-medium text-sm transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? 'Creating Account…' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-accent hover:text-accent-hover font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
