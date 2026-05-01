import { useState, FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import viteLogo from "./../../assets/logo.png";
import { ModeToggle } from "../../components/mode-toggle";
import { authApi } from "../../services/api";

const ResetPassword = () => {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState({ new_password: "", re_new_password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.new_password || !form.re_new_password) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.new_password !== form.re_new_password) {
      setError("Passwords do not match.");
      return;
    }
    if (!uid || !token) {
      setError("Invalid reset link.");
      return;
    }
    setIsLoading(true);
    try {
      await authApi.resetPasswordConfirm(uid, token, form.new_password, form.re_new_password);
      setDone(true);
    } catch (err: any) {
      const data = err?.response?.data;
      const msg =
        data?.token?.[0] ||
        data?.uid?.[0] ||
        data?.new_password?.[0] ||
        data?.non_field_errors?.[0] ||
        data?.detail ||
        "Something went wrong. The link may have expired.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="flex justify-end px-6 py-4">
        <ModeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-10">
        <div className="w-full max-w-[420px] sm:max-w-full">
          <div className="bg-card border border-border rounded-2xl shadow-lg px-8 py-10 sm:px-5 sm:py-8">

            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="flex gap-[.8] items-center">
                <img src={viteLogo} alt="Logo" className="w-5 h-5" />
                <span className="text-foreground text-[30px] font-extrabold tracking-wide uppercase">DTMS</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Set new password
              </h1>
              <p className="text-sm text-muted-foreground text-center">
                Enter and confirm your new password below.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                <span>⚠</span><span>{error}</span>
              </div>
            )}

            {done ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm rounded-lg px-4 py-3 w-full">
                  <span>✓</span>
                  <span>Password reset successfully.</span>
                </div>
                <button
                  onClick={() => navigate("/dtms/login", { replace: true })}
                  className="text-sm text-primary font-medium hover:underline"
                >
                  Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="new_password" className="text-sm font-medium text-foreground">New Password</label>
                  <input
                    id="new_password"
                    name="new_password"
                    type="password"
                    autoComplete="new-password"
                    value={form.new_password}
                    onChange={handleChange}
                    placeholder="Enter new password"
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="re_new_password" className="text-sm font-medium text-foreground">Confirm Password</label>
                  <input
                    id="re_new_password"
                    name="re_new_password"
                    type="password"
                    autoComplete="new-password"
                    value={form.re_new_password}
                    onChange={handleChange}
                    placeholder="Confirm new password"
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-1 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Resetting...
                    </span>
                  ) : "Reset Password"}
                </button>

                <div className="flex justify-center">
                  <Link to="/dtms/login" className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors">
                    Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            &copy; {new Date().getFullYear()} DTMS. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
