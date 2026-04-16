export interface SignatureProfile {
  id: string;
  name: string;
  password: string;
  displayName: string;
  position: string;
  textSizePct: number;
  imgWidthPct: number;
  stampWidth: number;
  stampHeight: number;
  lockRatio: boolean;
  imgTop: number;
  imgLeft: number;
  txtTop: number;
  txtLeft: number;
  showSignedBy: boolean;
  fontFamily: string;
  isItalic: boolean;
  isBold: boolean;
  nameColor: string;
  positionColor: string;
  signedByColor: string;
  signImageData: string | null;
  p12Name: string;
  p12Data: string | null;
  updatedAt: number;
}

const PROFILES_KEY = "sig_profiles_v1";
const ACTIVE_PROFILE_KEY = "sig_active_profile_id";

const safeNumber = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const createSignatureProfileId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sig-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const readSignatureProfiles = (): SignatureProfile[] => {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SignatureProfile[];
  } catch {
    return [];
  }
};

export const writeSignatureProfiles = (profiles: SignatureProfile[]) => {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
};

export const getActiveSignatureProfileId = (): string | null => {
  return localStorage.getItem(ACTIVE_PROFILE_KEY);
};

export const setActiveSignatureProfileId = (id: string) => {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
};

export const buildLegacySignatureProfile = (): SignatureProfile => {
  return {
    id: createSignatureProfileId(),
    name: "Default Signature",
    password: localStorage.getItem("sig_password") || "",
    displayName: localStorage.getItem("sig_displayName") || "",
    position: localStorage.getItem("sig_position") || "",
    textSizePct: safeNumber(localStorage.getItem("sig_text_size_pct"), 18),
    imgWidthPct: safeNumber(localStorage.getItem("sig_image_width_pct"), 35),
    stampWidth: safeNumber(localStorage.getItem("sig_stamp_width"), 140),
    stampHeight: safeNumber(localStorage.getItem("sig_stamp_height"), 50),
    lockRatio: localStorage.getItem("sig_lock_ratio") === "true",
    imgTop: safeNumber(localStorage.getItem("sig_img_top"), 5),
    imgLeft: safeNumber(localStorage.getItem("sig_img_left"), 50),
    txtTop: safeNumber(localStorage.getItem("sig_txt_top"), 55),
    txtLeft: safeNumber(localStorage.getItem("sig_txt_left"), 50),
    showSignedBy: localStorage.getItem("sig_show_signed_by") === "true",
    fontFamily: localStorage.getItem("sig_font_family") || "Inter, sans-serif",
    isItalic: localStorage.getItem("sig_is_italic") === "true",
    isBold: localStorage.getItem("sig_is_bold") !== "false",
    nameColor: localStorage.getItem("sig_name_color") || "#1e3a5f",
    positionColor: localStorage.getItem("sig_pos_color") || "#2563eb",
    signedByColor: localStorage.getItem("sig_signed_by_color") || "#64748b",
    signImageData: localStorage.getItem("sig_image_data"),
    p12Name: localStorage.getItem("sig_p12_name") || "",
    p12Data: localStorage.getItem("sig_p12_data"),
    updatedAt: Date.now(),
  };
};

export const ensureSignatureProfiles = (): { profiles: SignatureProfile[]; activeId: string } => {
  let profiles = readSignatureProfiles();
  if (!profiles.length) {
    const legacy = buildLegacySignatureProfile();
    profiles = [legacy];
    writeSignatureProfiles(profiles);
    setActiveSignatureProfileId(legacy.id);
    return { profiles, activeId: legacy.id };
  }

  const requestedActiveId = getActiveSignatureProfileId();
  const resolved = profiles.find(p => p.id === requestedActiveId) || profiles[0];
  setActiveSignatureProfileId(resolved.id);
  return { profiles, activeId: resolved.id };
};

export const syncLegacyStorageFromProfile = (profile: SignatureProfile) => {
  localStorage.setItem("sig_password", profile.password || "");
  localStorage.setItem("sig_displayName", profile.displayName || "");
  localStorage.setItem("sig_position", profile.position || "");
  localStorage.setItem("sig_text_size_pct", String(profile.textSizePct));
  localStorage.setItem("sig_image_width_pct", String(profile.imgWidthPct));
  localStorage.setItem("sig_stamp_width", String(profile.stampWidth));
  localStorage.setItem("sig_stamp_height", String(profile.stampHeight));
  localStorage.setItem("sig_lock_ratio", String(profile.lockRatio));
  localStorage.setItem("sig_img_top", String(profile.imgTop));
  localStorage.setItem("sig_img_left", String(profile.imgLeft));
  localStorage.setItem("sig_txt_top", String(profile.txtTop));
  localStorage.setItem("sig_txt_left", String(profile.txtLeft));
  localStorage.setItem("sig_show_signed_by", String(profile.showSignedBy));
  localStorage.setItem("sig_font_family", profile.fontFamily || "Inter, sans-serif");
  localStorage.setItem("sig_is_italic", String(profile.isItalic));
  localStorage.setItem("sig_is_bold", String(profile.isBold));
  localStorage.setItem("sig_name_color", profile.nameColor || "#1e3a5f");
  localStorage.setItem("sig_pos_color", profile.positionColor || "#2563eb");
  localStorage.setItem("sig_signed_by_color", profile.signedByColor || "#64748b");

  if (profile.signImageData) localStorage.setItem("sig_image_data", profile.signImageData);
  else localStorage.removeItem("sig_image_data");

  if (profile.p12Data) localStorage.setItem("sig_p12_data", profile.p12Data);
  else localStorage.removeItem("sig_p12_data");

  if (profile.p12Name) localStorage.setItem("sig_p12_name", profile.p12Name);
  else localStorage.removeItem("sig_p12_name");
};
