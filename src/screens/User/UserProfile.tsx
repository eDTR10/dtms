import { useState } from "react";
import { Save, CheckCircle2 } from "lucide-react";
import UserLayout from "./UserLayout";
import { useAuth } from "../Auth/AuthContext";

const ACC_LEVEL_LABELS: Record<number, string> = {
  0: "Super Admin",
  1: "Admin",
  2: "Manager",
  3: "Signatory",
  4: "Staff",
};

const UserProfile = () => {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // TODO: call PATCH /auth/users/me/ with updated data
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
            {[
              { label: "First Name",  value: user?.first_name },
              { label: "Last Name",   value: user?.last_name },
              { label: "Email",       value: user?.email },
              { label: "Position",    value: user?.position },
            ].map(f => (
              <div key={f.label} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{f.label}</label>
                <input defaultValue={f.value ?? ""}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
              </div>
            ))}
          </div>

          <button onClick={handleSave}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition">
            {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </div>
    </UserLayout>
  );
};

export default UserProfile;
