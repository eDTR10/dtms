import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import viteLogo from "/logo.png";
import { ModeToggle } from "../../components/mode-toggle";
import { authApi } from "../../services/api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.email?.[0] ||
        err?.response?.data?.detail ||
        "Something went wrong. Please try again.";
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
                Forgot your password?
              </h1>
              <p className="text-sm text-muted-foreground text-center">
                Enter your email and we'll send you a link to reset your password.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
                <span>⚠</span><span>{error}</span>
              </div>
            )}

            {sent ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm rounded-lg px-4 py-3 w-full">
                  <span>✓</span>
                  <span>Password reset email sent. Check your inbox.</span>
                </div>
                <Link
                  to="/dtms/login"
                  className="text-sm text-primary font-medium hover:underline"
                >
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="Enter your email"
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
                      Sending...
                    </span>
                  ) : "Send Reset Link"}
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

export default ForgotPassword;
