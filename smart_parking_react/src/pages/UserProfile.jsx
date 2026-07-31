import React, { useState, useEffect } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function UserProfile() {
  const { user: authUser, updateUser } = useAuth();
  const toast = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (authUser) {
      const parts = (authUser.name || '').split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setEmail(authUser.email || '');
    }
  }, [authUser]);

  const roleLabel = (authUser?.role || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser?.name || 'User')}&background=0D8BFF&color=fff&size=128`;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!authUser?.id) return;
    setIsSaving(true);
    try {
      const res = await authFetch(`/api/users/${authUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: `${firstName} ${lastName}`.trim(), email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      updateUser({ name: `${firstName} ${lastName}`.trim(), email });
      toast.success('Profile updated successfully!', 'Profile Saved');
    } catch (err) {
      toast.error(err.message, 'Save Failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.', 'Password Mismatch');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.', 'Too Short');
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password change failed');
      toast.success('Password changed successfully!', 'Password Updated');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.message, 'Change Failed');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDiscard = () => {
    const parts = (authUser?.name || '').split(' ');
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
    setEmail(authUser?.email || '');
    toast.info('Changes discarded.');
  };

  return (
    <>
      <div className="max-w-[1440px] mx-auto">
        <div className="mb-xl">
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Profile Settings</h2>
          <p className="font-body-md text-on-surface-variant">Manage your account preferences and security settings.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
          {/* Profile Header Card */}
          <div className="lg:col-span-12 bg-surface rounded-xl border border-outline-variant shadow-sm p-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-lg opacity-5">
              <span className="material-symbols-outlined text-[120px]">person</span>
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-lg">
              <div className="relative">
                <img
                  className="w-32 h-32 rounded-full object-cover border-4 border-primary-fixed shadow-md"
                  alt="Profile"
                  src={avatarUrl}
                />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-secondary rounded-full flex items-center justify-center border-2 border-white">
                  <span className="material-symbols-outlined text-on-secondary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
              </div>
              <div className="text-center md:text-left flex-1">
                <h3 className="font-headline-lg text-headline-lg mb-1">{authUser?.name || 'User'}</h3>
                <p className="font-body-lg text-on-surface-variant mb-4">{roleLabel} • Active</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-sm">
                  <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-label-md font-bold">
                    {authUser?.email}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Information Form */}
          <div className="lg:col-span-8 space-y-lg">
            <section className="bg-surface rounded-xl border border-outline-variant shadow-sm p-lg">
              <div className="flex items-center gap-sm mb-lg">
                <span className="material-symbols-outlined text-primary">badge</span>
                <h3 className="font-headline-md text-headline-md">Personal Information</h3>
              </div>
              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-on-surface-variant">First Name</label>
                  <input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="border border-outline-variant rounded-lg p-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all bg-surface text-on-surface placeholder:text-on-surface-variant"
                    type="text"
                    placeholder="First Name"
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-on-surface-variant">Last Name</label>
                  <input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="border border-outline-variant rounded-lg p-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all bg-surface text-on-surface placeholder:text-on-surface-variant"
                    type="text"
                    placeholder="Last Name"
                  />
                </div>
                <div className="flex flex-col gap-xs md:col-span-2">
                  <label className="font-label-md text-on-surface-variant">Email Address</label>
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="border border-outline-variant rounded-lg p-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all bg-surface text-on-surface placeholder:text-on-surface-variant"
                    type="email"
                    placeholder="Email Address"
                  />
                </div>
                <div className="md:col-span-2 pt-md border-t border-outline-variant flex justify-end gap-md">
                  <button onClick={handleDiscard} className="px-lg py-md rounded-lg font-label-md text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer" type="button">
                    Discard Changes
                  </button>
                  <button disabled={isSaving} className="bg-primary text-white px-xl py-md rounded-lg font-label-md hover:brightness-95 transition-all cursor-pointer disabled:opacity-60 flex items-center gap-sm" type="submit">
                    {isSaving && <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>}
                    {isSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </section>

            {/* Security Section */}
            <section className="bg-surface rounded-xl border border-outline-variant shadow-sm p-lg">
              <div className="flex items-center gap-sm mb-lg">
                <span className="material-symbols-outlined text-primary">security</span>
                <h3 className="font-headline-md text-headline-md">Security & Privacy</h3>
              </div>
              <div className="space-y-lg">
                <div className="flex items-center justify-between p-md bg-surface-container-low rounded-lg border border-outline-variant">
                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 bg-primary-fixed rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">lock</span>
                    </div>
                    <div>
                      <p className="font-label-md">Password</p>
                      <p className="text-[12px] text-on-surface-variant">Keep your account secure with a strong password</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                    className="border border-primary text-primary px-lg py-sm rounded-lg font-label-md hover:bg-primary-fixed transition-colors cursor-pointer"
                  >
                    {showPasswordForm ? 'Cancel' : 'Change'}
                  </button>
                </div>

                {showPasswordForm && (
                  <form onSubmit={handleChangePassword} className="border border-outline-variant rounded-lg p-lg space-y-md bg-surface-container-lowest">
                    <div className="flex flex-col gap-xs">
                      <label className="font-label-md text-on-surface-variant">Current Password</label>
                      <input
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        type="password"
                        required
                        placeholder="••••••••"
                        className="border border-outline-variant rounded-lg p-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-xs">
                      <label className="font-label-md text-on-surface-variant">New Password</label>
                      <input
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        type="password"
                        required
                        placeholder="Min. 6 characters"
                        className="border border-outline-variant rounded-lg p-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-xs">
                      <label className="font-label-md text-on-surface-variant">Confirm New Password</label>
                      <input
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        type="password"
                        required
                        placeholder="Re-enter new password"
                        className="border border-outline-variant rounded-lg p-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="bg-primary text-white px-xl py-md rounded-lg font-label-md hover:brightness-95 transition-all cursor-pointer disabled:opacity-60 flex items-center gap-sm"
                      >
                        {isChangingPassword && <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>}
                        {isChangingPassword ? 'Changing...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>
          </div>

          {/* Quick Info Panel */}
          <div className="lg:col-span-4 space-y-lg">
            <section className="bg-surface rounded-xl border border-outline-variant shadow-sm p-lg">
              <div className="flex items-center gap-sm mb-lg">
                <span className="material-symbols-outlined text-primary">info</span>
                <h3 className="font-headline-md text-headline-md">Account Info</h3>
              </div>
              <div className="space-y-md">
                {[
                  { label: 'Role', value: roleLabel, icon: 'badge' },
                  { label: 'Status', value: 'Active', icon: 'check_circle' },
                  { label: 'User ID', value: `#${authUser?.id || '—'}`, icon: 'tag' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-sm rounded-lg bg-surface-container-low">
                    <div className="flex items-center gap-sm">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{item.icon}</span>
                      <span className="font-label-md text-on-surface-variant">{item.label}</span>
                    </div>
                    <span className="font-bold text-body-md text-on-surface">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

