import { useState } from "react";
import Swal from "sweetalert2";
import { Save, CheckCircle2 } from "lucide-react";
import UserLayout from "./UserLayout";
import { useAuth } from "../Auth/AuthContext";
import { userApi } from "../../services/api";

const ACC_LEVEL_LABELS: Record<number, string> = {
  0: "Super Admin",
  1: "Admin",
  2: "Manager",
  3: "Signatory",
  4: "Staff",
};

const UserProfile = () => {

  const { user, setUser }:any = useAuth();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    position: user?.position || "",
  });
  // Change password state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      const updated = await userApi.patchMe(form);
      setUser && setUser(updated); // update context if possible
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      // Optionally show error
    }
  };

  // Change password handler
  const handleChangePassword = async () => {
    setPwError("");
    if (!password || !confirmPassword) {
      setPwError("Please fill in both fields.");
      return;
    }
    if (password !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    try {
      await userApi.changePassword(password);
      setPwSaved(true);
      setPassword("");
      setConfirmPassword("");
      Swal.fire({
        icon: "success",
        title: "Password Changed",
        text: "Your password has been updated successfully.",
        timer: 2000,
        showConfirmButton: false
      });
      setTimeout(() => setPwSaved(false), 2500);
    } catch (e: any) {
      setPwError(e?.response?.data?.password?.[0] || e?.response?.data?.detail || "Failed to change password.");
    }
  };

  return (
    <UserLayout title="Profile" subtitle="Your account information">
      <div className="max-w-xl">
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold uppercase">
              {user?.first_name?.slice(0, 1) ?? "U"}
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{user?.first_name} {user?.last_name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                {ACC_LEVEL_LABELS[user?.acc_lvl ?? 4] ?? `Level ${user?.acc_lvl}`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">First Name</label>
              <input
                name="first_name"
                type="text"
                value={form.first_name}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Last Name</label>
              <input
                name="last_name"
                type="text"
                value={form.last_name}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Position</label>
              <input
                name="position"
                type="text"
                value={form.position}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>
          </div>

          <button onClick={handleSave}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition">
            {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>

          {/* Change Password Section */}
          <div className="mt-10 pt-6 border-t border-border">
            <h3 className="text-base font-semibold mb-2 text-foreground">Change Password</h3>
            <div className="flex flex-col gap-3 max-w-sm">
              <input
                type="password"
                placeholder="New Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
              {pwError && <div className="text-sm text-red-500">{pwError}</div>}
              <button
                onClick={handleChangePassword}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
                type="button"
              >
                {pwSaved ? <><CheckCircle2 className="w-4 h-4" /> Password Changed!</> : <><Save className="w-4 h-4" /> Change Password</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default UserProfile;
