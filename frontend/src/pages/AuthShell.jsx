import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { MessageCircle, ShieldCheck } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function AuthShell() {
  const { token, verifyOtp, updateProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState("phone");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [profile, setProfile] = useState({ name: "", about: "Building better conversations." });
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/chats" replace />;

  const sendOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/send-otp", { countryCode, phone });
      setPhone(data.phone);
      setDevOtp(data.devOtp || "");
      setStep("otp");
      showToast("Verification code sent");
    } catch (error) {
      showToast(error.response?.data?.message || "Could not send OTP", "error");
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await verifyOtp(phone, otp);
      if (result.requiresProfile) setStep("profile");
      else navigate("/chats", { replace: true });
    } catch (error) {
      showToast(error.response?.data?.message || "Invalid OTP", "error");
    } finally {
      setBusy(false);
    }
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    await updateProfile(profile);
    navigate("/chats", { replace: true });
  };

  return (
    <main className="auth-page">
      {/* =====================================================
        LEFT SIDE — BRAND / INTRO
        ===================================================== */}
      <section className="auth-hero">
        <div className="auth-hero-content">

          <div className="brand-lockup">
            <span className="brand-mark large">C</span>

            <div className="brand-text">
              <p className="eyebrow">Chilling Chat</p>

              <h1>
                Simple.
                <br />
                Private.
                <br />
                Connected.
              </h1>

              <p className="hero-description">
                Stay connected with the people who matter.
                Send messages, share moments, and make calls
                from one beautiful workspace.
              </p>
            </div>
          </div>

          <div className="auth-features">
            <div className="auth-feature">
              <span className="feature-icon">✓</span>
              <div>
                <strong>Private conversations</strong>
                <span>Your conversations stay protected.</span>
              </div>
            </div>

            <div className="auth-feature">
              <span className="feature-icon">✓</span>
              <div>
                <strong>Live presence</strong>
                <span>See when your contacts are available.</span>
              </div>
            </div>

            <div className="auth-feature">
              <span className="feature-icon">✓</span>
              <div>
                <strong>Messages & calls</strong>
                <span>Everything you need in one place.</span>
              </div>
            </div>
          </div>

        </div>

        <div className="auth-proof">
          <ShieldCheck size={18} />

          <span>
            Your account is protected with secure OTP verification.
          </span>
        </div>
      </section>


      {/* =====================================================
        RIGHT SIDE — AUTH
        ===================================================== */}
      <section className="auth-panel">

        {/* PHONE */}
        {step === "phone" && (
          <form onSubmit={sendOtp} className="stack auth-form">

            <div className="auth-form-icon">
              <MessageCircle size={27} />
            </div>

            <div className="auth-form-heading">
              <h2>Welcome to Chilling Chat</h2>

              <p>
                Enter your phone number to get started.
              </p>
            </div>

            <div className="phone-input-row">

              <label className="country-field">
                Country
                <input
                  value={countryCode}
                  onChange={(event) =>
                    setCountryCode(event.target.value)
                  }
                  placeholder="+1"
                />
              </label>

              <label className="phone-field">
                Phone number
                <input
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  placeholder="5551234567"
                  inputMode="tel"
                />
              </label>

            </div>

            <button
              className="primary-button auth-submit"
              disabled={busy}
            >
              {busy ? "Sending..." : "Continue"}
            </button>

            <p className="auth-footer-text">
              We'll send you a verification code to confirm
              your phone number.
            </p>

          </form>
        )}


        {/* OTP */}
        {step === "otp" && (
          <form onSubmit={submitOtp} className="stack auth-form">

            <div className="auth-form-icon">
              <ShieldCheck size={27} />
            </div>

            <div className="auth-form-heading">
              <h2>Verify your number</h2>

              <p>
                We sent a verification code to
                <strong> {phone}</strong>.
              </p>
            </div>

            {devOtp && (
              <div className="dev-otp">
                <span>Development OTP</span>
                <strong>{devOtp}</strong>
              </div>
            )}

            <label>
              Verification code
              <input
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value)
                }
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
              />
            </label>

            <button
              className="primary-button auth-submit"
              disabled={busy}
            >
              {busy ? "Verifying..." : "Verify & Continue"}
            </button>

            <button
              type="button"
              className="text-button"
              onClick={() => setStep("phone")}
            >
              ← Use another number
            </button>

          </form>
        )}


        {/* PROFILE */}
        {step === "profile" && (
          <form
            onSubmit={submitProfile}
            className="stack auth-form"
          >

            <div className="auth-form-icon profile-icon">
              <span>👤</span>
            </div>

            <div className="auth-form-heading">
              <h2>Create your profile</h2>

              <p>
                Add a few details so people can recognize you.
              </p>
            </div>

            <label>
              Display name
              <input
                value={profile.name}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    name: event.target.value,
                  })
                }
                placeholder="Enter your name"
                autoComplete="name"
                required
              />
            </label>

            <label>
              About
              <textarea
                value={profile.about}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    about: event.target.value,
                  })
                }
                placeholder="Tell people a little about yourself"
              />
            </label>

            <button className="primary-button auth-submit">
              Start chatting
            </button>

          </form>
        )}

      </section>
    </main>
  );
}
