"use client";

import { useEffect, useState } from "react";
import {
  updatePatientApi,
  changePasswordApi,
  type LoggedInUser,
} from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import toast from "react-hot-toast";
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Lock,
  Save,
} from "lucide-react";
import { formatDate, toDateInputValue } from "../utils";

type ProfileTabProps = {
  editing: boolean;
  setEditing: (value: boolean) => void;
};

export default function ProfileTab({ editing, setEditing }: ProfileTabProps) {
  const { user, token, setAuth, initialized } = useAuth();

  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    phone: "",
    dob: "",
    address_line1: "",
    address_line2: "",
    city: "",
    county: "",
    postalcode: "",
    country: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const isLoadingAuth = !initialized;

  // Sync edit form whenever user changes
  useEffect(() => {
    if (!user) return;
    setEditForm({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      gender: user.gender ?? "",
      phone: user.phone ?? "",
      dob: toDateInputValue(user.dob),
      address_line1: user.address_line1 ?? "",
      address_line2: user.address_line2 ?? "",
      city: user.city ?? "",
      county: user.county ?? "",
      postalcode: user.postalcode ?? "",
      country: user.country ?? "",
    });
  }, [user]);

  const fullName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()
      : "Your profile";

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      toast.error("You must be logged in to update your profile.");
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        firstName: editForm.firstName || undefined,
        lastName: editForm.lastName || undefined,
        gender: editForm.gender || undefined,
        phone: editForm.phone || undefined,
        dob: editForm.dob || undefined,
        address_line1: editForm.address_line1 || undefined,
        address_line2: editForm.address_line2 || undefined,
        city: editForm.city || undefined,
        county: editForm.county || undefined,
        postalcode: editForm.postalcode || undefined,
        country: editForm.country || undefined,
      };

      const id =
        (user as any)._id ??
        (user as any).id ??
        (user as any).user_id;

      const updated = await updatePatientApi(id, payload);
      setAuth(updated as LoggedInUser, token);
      toast.success("Your details have been updated.");
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      toast.error("You must be logged in to change your password.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const id =
        (user as any)._id ??
        (user as any).id ??
        (user as any).user_id;

      await changePasswordApi(id, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      toast.success("Your password has been updated.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        Loading your profile…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        You&apos;re not logged in. Please log in to see your profile details.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Profile info / edit form */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-slate-500" />
          <p className="text-xs font-semibold text-slate-800">
            Personal details
          </p>
        </div>

        {!editing ? (
          <>
            {/* Read-only view */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  Name
                </p>
                <p className="text-sm text-slate-900">
                  {fullName || "Not set"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  Email
                </p>
                <p className="flex items-center gap-1.5 text-sm text-slate-900">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>{user.email || "Not set"}</span>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  Phone
                </p>
                <p className="flex items-center gap-1.5 text-sm text-slate-900">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{user.phone || "Not set"}</span>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  Gender
                </p>
                <p className="text-sm text-slate-900">
                  {user.gender || "Not set"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  Date of birth
                </p>
                <p className="flex items-center gap-1.5 text-sm text-slate-900">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>{formatDate(user.dob)}</span>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  Joined
                </p>
                <p className="text-sm text-slate-900">
                  {formatDate(user.createdAt)}
                </p>
              </div>
            </div>

            {/* Address */}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  Address line 1
                </p>
                <p className="flex items-center gap-1.5 text-sm text-slate-900">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{user.address_line1 || "Not set"}</span>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  Address line 2
                </p>
                <p className="text-sm text-slate-900">
                  {user.address_line2 || "Not set"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  City
                </p>
                <p className="text-sm text-slate-900">
                  {user.city || "Not set"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  County
                </p>
                <p className="text-sm text-slate-900">
                  {user.county || "Not set"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  Postcode
                </p>
                <p className="text-sm text-slate-900">
                  {user.postalcode || "Not set"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">
                  Country
                </p>
                <p className="text-sm text-slate-900">
                  {user.country || "Not set"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Edit form */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  First name
                </p>
                <input
                  name="firstName"
                  value={editForm.firstName}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="John"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  Last name
                </p>
                <input
                  name="lastName"
                  value={editForm.lastName}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="Man"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  Phone
                </p>
                <input
                  name="phone"
                  value={editForm.phone}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="e.g. 01234 567890"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  Gender
                </p>
                <select
                  name="gender"
                  value={editForm.gender}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / prefer not to say</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  Date of birth
                </p>
                <input
                  type="date"
                  name="dob"
                  value={editForm.dob}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  Address line 1
                </p>
                <input
                  name="address_line1"
                  value={editForm.address_line1}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="123 Baker Street"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  Address line 2
                </p>
                <input
                  name="address_line2"
                  value={editForm.address_line2}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="Apartment, building, etc."
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  City
                </p>
                <input
                  name="city"
                  value={editForm.city}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="London"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  County
                </p>
                <input
                  name="county"
                  value={editForm.county}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="Greater London"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  Postcode
                </p>
                <input
                  name="postalcode"
                  value={editForm.postalcode}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="NW1 6XE"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500">
                  Country
                </p>
                <input
                  name="country"
                  value={editForm.country}
                  onChange={handleEditChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="UK"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold text-white shadow-soft-card hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingProfile ? (
                  "Saving…"
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </form>

      {/* Change password */}
      <form
        onSubmit={handleChangePassword}
        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-slate-500" />
          <p className="text-xs font-semibold text-slate-800">
            Change password
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500">
              Current password
            </p>
            <input
              type="password"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500">
              New password
            </p>
            <input
              type="password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500">
              Confirm password
            </p>
            <input
              type="password"
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              placeholder="Repeat new password"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={changingPassword}
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-[11px] font-semibold text-white shadow-soft-card hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {changingPassword ? (
              "Updating…"
            ) : (
              <>
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                Update password
              </>
            )}
          </button>
        </div>
      </form>

      <p className="mt-3 text-[11px] text-slate-500">
        If any of your details are incorrect, please contact the pharmacy team
        so we can update your records.
      </p>
    </div>
  );
}
