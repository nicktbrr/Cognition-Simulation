"use client";

import React, { useEffect, useRef, useState } from "react";
import { User, CreditCard, Pencil, Coins, Download } from "lucide-react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import AuthLoading from "../components/auth-loading";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";
import { Button } from "../components/ui/button";

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  institution: string;
  department: string;
  academicTitle: string;
  orcid: string;
  researchInterests: string;
  bio: string;
}

const emptyProfile: ProfileData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  institution: "",
  department: "",
  academicTitle: "",
  orcid: "",
  researchInterests: "",
  bio: "",
};

interface Transaction {
  id: string;
  label: string;
  date: string; // pre-formatted for display, e.g. "Apr 5, 2026"
  amount: number; // positive = credits added
}

interface BillingData {
  balance: number;
  transactions: Transaction[];
}

const formatDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Default billing state mirrors the reference design so the tab is populated
// out of the box. Replace with real balance/transactions once payments exist.
const defaultBilling: BillingData = {
  balance: 47.5,
  transactions: [
    { id: "seed-1", label: "Credit purchase", date: "Apr 5, 2026", amount: 50 },
    { id: "seed-2", label: "Credit purchase", date: "Mar 22, 2026", amount: 10 },
    { id: "seed-3", label: "Credit purchase", date: "Mar 1, 2026", amount: 50 },
  ],
};

// --- Profile persistence boundary -------------------------------------------
// For now the profile is stored in the browser (localStorage) only. When the
// backend is ready, swap these two helpers to read/write a Supabase table
// (e.g. a `profile` JSON column on `user_emails`) keyed by user_id; the rest of
// the page does not need to change.
const profileStorageKey = (userId: string) => `psycsim-profile-${userId}`;

const loadProfile = (userId: string): Partial<ProfileData> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(profileStorageKey(userId));
    return raw ? (JSON.parse(raw) as Partial<ProfileData>) : {};
  } catch {
    return {};
  }
};

const saveProfile = (userId: string, profile: ProfileData) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(profileStorageKey(userId), JSON.stringify(profile));
  } catch (error) {
    console.error("Error saving profile:", error);
  }
};

// Billing is also browser-only for now. When payments are wired up, these
// helpers become the read/write path to the real balance + transactions, and
// the "Add" buttons should hit the payment/checkout flow instead of mutating
// local state directly.
const billingStorageKey = (userId: string) => `psycsim-billing-${userId}`;

const loadBilling = (userId: string): BillingData => {
  if (typeof window === "undefined") return defaultBilling;
  try {
    const raw = localStorage.getItem(billingStorageKey(userId));
    return raw ? (JSON.parse(raw) as BillingData) : defaultBilling;
  } catch {
    return defaultBilling;
  }
};

const saveBilling = (userId: string, billing: BillingData) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(billingStorageKey(userId), JSON.stringify(billing));
  } catch (error) {
    console.error("Error saving billing:", error);
  }
};
// ----------------------------------------------------------------------------

export default function AccountPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "billing">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [draft, setDraft] = useState<ProfileData>(emptyProfile);
  const [billing, setBilling] = useState<BillingData>(defaultBilling);
  const [customAmount, setCustomAmount] = useState("");
  const hasLoadedRef = useRef(false);

  const getUserData = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_emails")
      .select("user_email, user_id, pic_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user data:", error);
      setUserData(null);
    } else {
      setUserData(data ?? null);
    }
  };

  useEffect(() => {
    if (user && isAuthenticated && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      getUserData(user.user_id);

      // Seed the form with what we already know from auth, then layer any
      // previously saved edits on top.
      const nameParts = (user.name || "").trim().split(/\s+/).filter(Boolean);
      const authDefaults: Partial<ProfileData> = {
        firstName: nameParts[0] || "",
        lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
        email: user.user_email || "",
      };
      const merged: ProfileData = {
        ...emptyProfile,
        ...authDefaults,
        ...loadProfile(user.user_id),
        // Email always reflects the authenticated account.
        email: user.user_email || "",
      };
      setProfile(merged);
      setDraft(merged);
      setBilling(loadBilling(user.user_id));
    } else if (!user || !isAuthenticated) {
      hasLoadedRef.current = false;
      setProfile(emptyProfile);
      setDraft(emptyProfile);
      setBilling(defaultBilling);
      setIsEditing(false);
    }
  }, [user?.user_id, isAuthenticated]);

  const handleEdit = () => {
    setDraft(profile);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft(profile);
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!user) return;
    setProfile(draft);
    saveProfile(user.user_id, draft);
    setIsEditing(false);
  };

  const updateDraft = (field: keyof ProfileData, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  // Prototype only: locally credits the balance and records a transaction.
  // Swap for a real checkout/payment flow when billing is implemented.
  const handleAddCredits = (amount: number) => {
    if (!user || !(amount > 0)) return;
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      label: "Credit purchase",
      date: formatDate(new Date()),
      amount,
    };
    const next: BillingData = {
      balance: Math.round((billing.balance + amount) * 100) / 100,
      transactions: [newTransaction, ...billing.transactions],
    };
    setBilling(next);
    saveBilling(user.user_id, next);
  };

  const handleAddCustom = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) return;
    handleAddCredits(Math.round(amount * 100) / 100);
    setCustomAmount("");
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return <AuthLoading message="Loading account..." />;
  }

  // If not authenticated, don't render anything (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  const values = isEditing ? draft : profile;

  const fieldClass = (editable: boolean) =>
    `w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
      editable
        ? "bg-white border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        : "bg-gray-50 border border-gray-200 text-gray-500 cursor-default"
    }`;

  // Email is tied to the login provider and is not editable here.
  const renderField = (
    label: string,
    field: keyof ProfileData,
    placeholder: string,
    options?: { editable?: boolean }
  ) => {
    const editable = isEditing && options?.editable !== false;
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
        <input
          type="text"
          value={values[field]}
          placeholder={placeholder}
          disabled={!editable}
          onChange={(e) => updateDraft(field, e.target.value)}
          className={fieldClass(editable)}
        />
      </div>
    );
  };

  return (
    <AppLayout currentPage="account" headerTitle="" userData={userData}>
      <SubHeader title="Account Settings" description="Manage your profile and billing" />

      <div className="flex-1 p-8 bg-gray-100 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "profile"
                  ? "bg-white border border-gray-200 shadow-sm text-blue-600"
                  : "text-gray-500 hover:bg-gray-200"
              }`}
            >
              <User className="w-4 h-4" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab("billing")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "billing"
                  ? "bg-white border border-gray-200 shadow-sm text-blue-600"
                  : "text-gray-500 hover:bg-gray-200"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Billing &amp; Credits
            </button>
          </div>

          {activeTab === "profile" && (
            <>
          {/* Profile Settings header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-blue-600">Profile Settings</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage your academic profile and contact information
              </p>
            </div>
            {isEditing ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleCancel}
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Save Changes
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleEdit}
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Edit Profile
              </Button>
            )}
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-semibold text-blue-600 mb-4">Personal Information</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {renderField("First Name", "firstName", "First name")}
                  {renderField("Last Name", "lastName", "Last name")}
                </div>
                {renderField("Email Address", "email", "you@university.edu", { editable: false })}
                {renderField("Phone Number", "phone", "+1 (555) 123-4567")}
              </div>
            </div>

            {/* Academic Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="text-sm font-semibold text-blue-600 mb-4">Academic Information</h4>
              <div className="space-y-4">
                {renderField("Institution", "institution", "e.g. Stanford University")}
                {renderField("Department", "department", "e.g. Department of Psychology")}
                {renderField("Academic Title", "academicTitle", "e.g. Associate Professor")}
                {renderField("ORCID ID", "orcid", "0000-0002-1234-5678")}
              </div>
            </div>
          </div>

          {/* Research Profile */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
            <h4 className="text-sm font-semibold text-blue-600 mb-4">Research Profile</h4>
            <div className="space-y-4">
              {renderField(
                "Research Interests",
                "researchInterests",
                "e.g. Consumer behavior, cognitive modeling, decision-making under uncertainty"
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
                <textarea
                  rows={4}
                  value={values.bio}
                  placeholder="Tell us about your research and background..."
                  disabled={!isEditing}
                  onChange={(e) => updateDraft("bio", e.target.value)}
                  className={`${fieldClass(isEditing)} resize-none`}
                />
              </div>
            </div>
          </div>
            </>
          )}

          {activeTab === "billing" && (
            <>
              {/* Billing header */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-blue-600">Billing &amp; Credits</h3>
                <p className="text-sm text-gray-500 mt-0.5">Add funds and manage your credit balance</p>
              </div>

              {/* Credit Balance */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Credit Balance</p>
                <div className="flex items-center gap-2 mt-1">
                  <Coins className="w-6 h-6 text-blue-600" />
                  <span className="text-3xl font-bold text-blue-600">${billing.balance.toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  Credits are used for running simulations. Add funds anytime.
                </p>
              </div>

              {/* Add Credits */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
                <h4 className="text-sm font-semibold text-blue-600">Add Credits</h4>
                <p className="text-sm text-gray-500 mt-0.5 mb-5">Choose an amount to add to your balance</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* $10 */}
                  <div className="border border-gray-200 rounded-xl p-5 flex flex-col">
                    <div className="flex-1 flex items-center justify-center py-3">
                      <span className="text-2xl font-bold text-gray-900">$10</span>
                    </div>
                    <button
                      onClick={() => handleAddCredits(10)}
                      className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      Add $10
                    </button>
                  </div>

                  {/* $50 - Most Popular */}
                  <div className="relative border-2 border-blue-500 rounded-xl p-5 flex flex-col">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
                      Most Popular
                    </span>
                    <div className="flex-1 flex items-center justify-center py-3">
                      <span className="text-2xl font-bold text-gray-900">$50</span>
                    </div>
                    <button
                      onClick={() => handleAddCredits(50)}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      Add $50
                    </button>
                  </div>

                  {/* Custom */}
                  <div className="border border-gray-200 rounded-xl p-5 flex flex-col">
                    <div className="flex-1 flex items-center justify-center py-3">
                      <div className="relative w-full">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={customAmount}
                          placeholder="Amount"
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setCustomAmount(v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddCustom();
                          }}
                          className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddCustom}
                      className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      Add Custom
                    </button>
                  </div>
                </div>
              </div>

              {/* Transaction History */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
                <h4 className="text-sm font-semibold text-blue-600">Transaction History</h4>
                <p className="text-sm text-gray-500 mt-0.5 mb-2">Recent credit purchases</p>
                {billing.transactions.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4">No transactions yet.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {billing.transactions.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{t.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{t.date}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-md">
                            +${t.amount.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            title="Invoice downloads coming soon"
                            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Invoice
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
