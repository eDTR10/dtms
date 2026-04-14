import { useState, FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import viteLogo from "/logo.png";
import { ModeToggle } from "../../components/mode-toggle";
import { useAuth } from "./AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    setIsLoading(true);
    try {
      const me = await login(form.email, form.password);
      // Redirect to ?next= param first; otherwise route by acc_lvl
      const next = searchParams.get("next");
      if (next) {
        navigate(next, { replace: true });
      } else if (me.acc_lvl === 0) {
        navigate("/dtms/admin/dashboard", { replace: true });
      } else {
        navigate("/dtms/user/documents", { replace: true });
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.non_field_errors?.[0] ||
        err?.response?.data?.detail ||
        "Invalid credentials. Please try again.";
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
                Sign in to your account
              </h1>
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link to="/dtms/register" className="text-primary font-medium hover:underline">
                  Register
                </Link>
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                <span>⚠</span><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
                <input
                  id="email" name="email" type="email" autoComplete="email"
                  value={form.email} onChange={handleChange}
                  placeholder="Enter your email"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
                <input
                  id="password" name="password" type="password" autoComplete="current-password"
                  value={form.password} onChange={handleChange}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                />
              </div>

              <button
                type="submit" disabled={isLoading}
                className="w-full mt-1 bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : "Sign In"}
              </button>

              <div className="flex justify-center">
                <Link to="/dtms/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors">
                  Forgot your password?
                </Link>
              </div>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            &copy; {new Date().getFullYear()} DTMS. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
