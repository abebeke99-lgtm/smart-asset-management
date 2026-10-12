import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage, useTranslation } from '../../contexts/UiContext';
import apiClient from '../../services/apiClient';
import './Register.css';

const initialForm = {
  fullName: '',
  username: '',
  email: '',
  phone: '',
  department: '',
  role: 'student',
  password: '',
  confirmPassword: '',
};

const Register = () => {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (savingRef.current) return;
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = 'Full name is required.';
    if (form.username.trim().length < 3) errors.username = 'Username must be at least 3 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
    if (!form.password || form.password.length < 8 || form.password.length > 16 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errors.password = 'Password must be 8–16 characters and contain a letter and a number.';
    }
    if (!form.confirmPassword) errors.confirmPassword = 'Confirm Password is required.';
    else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await apiClient.post('/api/auth/register', {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        department: form.department.trim(),
        password: form.password,
        role: form.role,
      });
      if (!response.data?.success) throw new Error(response.data?.message || 'Unable to create your account.');
      setForm(initialForm);
      setSuccess('Account created. You can now sign in.');
    } catch (requestError) {
      const message = requestError.response?.data?.message || requestError.message || 'Unable to complete registration.';
      const field = /username/i.test(message) ? 'username' : /email/i.test(message) ? 'email' : '';
      if (field) setFieldErrors({ [field]: message });
      else setError(message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <main className="public-register-page">
      <section className="public-register-card">
        <header>
          <h1>{t('auth.registerPage.title')}</h1>
          <p>{language === 'am'
            ? 'እንደ ተማሪ ወይም ሰራተኛ ይመዝገቡ። ልዩ ፈቃድ ያላቸው መለያዎች በተፈቀደላቸው አስተዳዳሪዎች ይፈጠራሉ።'
            : 'Register as a student or staff member. Privileged accounts are provisioned by authorized administrators.'}</p>
        </header>
        {error && <p className="public-register-error" role="alert">{error}</p>}
        {success && <p className="public-register-success" role="status">{success}</p>}
        <form onSubmit={submit} noValidate>
          <label htmlFor="registration-full-name">Full Name *
            <input id="registration-full-name" name="fullName" autoComplete="name" value={form.fullName} onChange={update} required aria-invalid={Boolean(fieldErrors.fullName)} />
            {fieldErrors.fullName && <span role="alert">{fieldErrors.fullName}</span>}
          </label>
          <label htmlFor="registration-username">Username *
            <input id="registration-username" name="username" autoComplete="username" minLength={3} maxLength={100} value={form.username} onChange={update} required aria-invalid={Boolean(fieldErrors.username)} />
            {fieldErrors.username && <span role="alert">{fieldErrors.username}</span>}
          </label>
          <label htmlFor="registration-email">Email *
            <input id="registration-email" name="email" type="email" autoComplete="email" maxLength={255} value={form.email} onChange={update} required aria-invalid={Boolean(fieldErrors.email)} />
            {fieldErrors.email && <span role="alert">{fieldErrors.email}</span>}
          </label>
          <label htmlFor="registration-phone">Phone
            <input id="registration-phone" name="phone" type="tel" autoComplete="tel" maxLength={50} value={form.phone} onChange={update} />
          </label>
          <label htmlFor="registration-department">Department
            <input id="registration-department" name="department" maxLength={255} value={form.department} onChange={update} />
          </label>
          <label htmlFor="registration-role">Account type *
            <select id="registration-role" name="role" value={form.role} onChange={update}>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </label>
          <label htmlFor="registration-password">Password *
            <input id="registration-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={16} value={form.password} onChange={update} required aria-invalid={Boolean(fieldErrors.password)} />
            {fieldErrors.password && <span role="alert">{fieldErrors.password}</span>}
          </label>
          <label htmlFor="registration-confirm-password">Confirm Password *
            <input id="registration-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={16} value={form.confirmPassword} onChange={update} required aria-invalid={Boolean(fieldErrors.confirmPassword)} />
            {fieldErrors.confirmPassword && <span role="alert">{fieldErrors.confirmPassword}</span>}
          </label>
          <button type="submit" disabled={saving}>{saving ? 'Creating account…' : 'Create Account'}</button>
        </form>
        <footer>Already registered? <Link to="/login">Sign in</Link></footer>
      </section>
    </main>
  );
};

export default Register;
