import React, { createContext, useContext, useEffect, useState } from 'react';

export type AppLanguage = 'en' | 'si' | 'ta';

const LANG_STORAGE_KEY = 'wg_v2_language';

const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  en: {
    brandSubtitle: 'Commercial Credit · Leasing & Finance Recovery Control',
    adminMode: 'Admin Mode',
    viewOnlyMode: 'Live View-Only',
    navOverview: 'Dashboard',
    navAssignUser: 'Assign User',
    navBelowOne: 'Below 1 (90R)',
    navBelowThree: 'Below 3 Coll.',
    navBorderline: 'Borderline',
    navWorst: 'Worst (W)',
    navAlerts: 'Alerts',
    navRewards: 'XP Rewards',
    navFbIncentive: 'FB Incentive',
    navTools: 'Analytics',
    navSettings: 'Settings',
    breadcrumbOverview: 'Executive Treasury & Recovery Command',
    breadcrumbAssignUser: 'Assign User Follow-Up & 30-Day Performance History',
    breadcrumbBelowOne: 'Below 1 (≤ 1.00) · 90 Ratio Control Plan',
    breadcrumbBelowThree: 'Below 3 (< 3.00 Age) Collection & Due Variance Control',
    breadcrumbBorderline: 'Next-Month Borderline 91-DPD Shield',
    breadcrumbWorst: 'Worst Case (W) Asset Recovery Radar',
    breadcrumbAlerts: 'Alerts & Desktop Pop-Up Center',
    breadcrumbRewards: 'XP & Performance Rewards Arena',
    breadcrumbFbIncentive: 'FB Incentive Calculator & Payout Hub',
    breadcrumbTools: 'Office Type Breakdown & BM Portfolio Analytics',
    breadcrumbSettings: 'Settings · AERS Master Lookup & Admin Vault',
    snapExport: 'Snap / Export',
    pickingSection: 'Picking Section…',
    areaSnap: 'Area Snap',
    installApp: 'Install PC App',
    refreshLive: 'Refresh Live',
    syncing: 'Syncing...',
    uploadAers: 'Upload AERS',
    adminActive: 'Admin Active',
    adminLogin: 'Admin Login',
    hoverSnap: 'Hover Snap',
    testPopup: 'Test Pop-up',
    heroEyebrow: 'Commercial Credit · Executive Recovery Command',
    heroTitle: 'Current NPL, 90 Ratio & Portfolio Control',
    heroDesc:
      'Precision leasing & finance recovery intelligence isolating 91+ DPD Classified, Opening NPL, Below 1 (90 Ratio) quick-wins, and critical borderline exposures.',
    officeTypes: 'Office Types',
    nextMoBorderline: 'Next-Mo Borderline',
    worstCase: 'WORST (W)',
    uploadDailyAers: 'Upload Daily AERS',
    adminLoginToUpload: 'Admin Login to Upload Data',
    belowOnePlan: 'Below 1 · 90 Ratio Plan',
    liveAlertsPrefix: 'LIVE AERS ALERTS:',
    shareWhatsApp: 'WhatsApp',
    tabOverviewCards: 'Overview & User Cards',
    tabPerfHistory: 'Performance History (30d)',
    logTodaySnapshot: 'Log Today Snapshot',
    xpTitle: 'Officer & Assign User XP Rewards Hub',
    xpSubtitle:
      'Merit-based banking performance XP calculated live from collection efficiency, Below-1 (90 Ratio), NPL reduction, and call effort consistency.',
    fbTitle: 'FB Incentive Hub',
    fbSubtitle:
      'Dedicated Commercial Credit Financial Business (FB) Incentive workspace — connected to live branch portfolio KPIs and ready for your custom slab & payout rules.',
  },
  si: {
    brandSubtitle: 'කොමර්ෂල් ක්‍රෙඩිට් · ලීසිං සහ මූල්‍ය අයකිරීම් පාලනය',
    adminMode: 'පරිපාලක මාදිලිය',
    viewOnlyMode: 'සජීවී නැරඹුම් මාදිලිය',
    navOverview: 'මුල් පුවරුව',
    navAssignUser: 'පවරන ලද පරිශීලක',
    navBelowOne: 'Below 1 (90R)',
    navBelowThree: 'Below 3 අයකිරීම්',
    navBorderline: 'සීමාසන්න (91 DPD)',
    navWorst: 'අවදානම් (W)',
    navAlerts: 'දැනුම්දීම්',
    navRewards: 'XP ත්‍යාග',
    navFbIncentive: 'FB දිරිදීමනා',
    navTools: 'විශ්ලේෂණ',
    navSettings: 'සැකසුම්',
    breadcrumbOverview: 'ප්‍රධාන අයකිරීම් සහ කළමනාකරණ පුවරුව',
    breadcrumbAssignUser: 'පවරන ලද නිලධාරීන්ගේ පසුවිපරම් සහ දින 30 ප්‍රගති ඉතිහාසය',
    breadcrumbBelowOne: 'Below 1 (≤ 1.00) · 90 අනුපාත ක්‍රියාකාරී සැලැස්ම',
    breadcrumbBelowThree: 'Below 3 (< 3.00 වයස) අයකිරීම් සහ Due වෙනස (Variance) පාලනය',
    breadcrumbBorderline: 'ඊළඟ මාසයේ 91-DPD සීමාසන්න ආරක්ෂණ පුවරුව',
    breadcrumbWorst: 'අවදානම් (W) ගිණුම් අධීක්ෂණ රේඩාර්',
    breadcrumbAlerts: 'දැනුම්දීම් සහ පරිගණක පොප්-අප් මධ්‍යස්ථානය',
    breadcrumbRewards: 'XP ලකුණු සහ දක්ෂතා ඇගයීම් මධ්‍යස්ථානය',
    breadcrumbFbIncentive: 'FB දිරිදීමනා (Incentive) කළමනාකරණ පුවරුව',
    breadcrumbTools: 'කාර්යාල වර්ගීකරණය සහ BM කළඹ විශ්ලේෂණය',
    breadcrumbSettings: 'සැකසුම් · AERS දත්ත පරීක්ෂාව සහ උපස්ථ',
    snapExport: 'ස්නැප් / අපනයනය',
    pickingSection: 'කොටස තෝරන්න…',
    areaSnap: 'ප්‍රදේශ ස්නැප්',
    installApp: 'PC ඇප් ස්ථාපනය',
    refreshLive: 'සජීවී යාවත්කාලීනය',
    syncing: 'යාවත්කාලීන වේ...',
    uploadAers: 'AERS උඩුගත කරන්න',
    adminActive: 'පරිපාලක සක්‍රීයයි',
    adminLogin: 'පරිපාලක පිවිසුම',
    hoverSnap: 'හොවර් ස්නැප්',
    testPopup: 'පොප්-අප් පරීක්ෂාව',
    heroEyebrow: 'කොමර්ෂල් ක්‍රෙඩිට් · ප්‍රධාන අයකිරීම් පාලනය',
    heroTitle: 'වත්මන් NPL, 90 අනුපාත සහ කළඹ පාලනය',
    heroDesc:
      '91+ DPD අක්‍රිය ණය, ආරම්භක NPL, Below 1 (90 අනුපාත) ක්ෂණික ඉලක්ක සහ සීමාසන්න අවදානම් ගිණුම් නිවැරදිව වෙන්කර අධීක්ෂණය කිරීමේ පද්ධතිය.',
    officeTypes: 'කාර්යාල වර්ග',
    nextMoBorderline: 'සීමාසන්න ගිණුම්',
    worstCase: 'අවදානම් (W)',
    uploadDailyAers: 'දෛනික AERS උඩුගත කරන්න',
    adminLoginToUpload: 'දත්ත උඩුගත කිරීමට පිවිසෙන්න',
    belowOnePlan: 'Below 1 · 90 අනුපාත සැලැස්ම',
    liveAlertsPrefix: 'සජීවී AERS දැනුම්දීම්:',
    shareWhatsApp: 'WhatsApp',
    tabOverviewCards: 'දළ විශ්ලේෂණය සහ කාඩ්පත්',
    tabPerfHistory: 'දින 30 ප්‍රගති ඉතිහාසය',
    logTodaySnapshot: 'අද ප්‍රගතිය සුරකින්න',
    xpTitle: 'නිලධාරීන්ගේ XP ලකුණු සහ ත්‍යාග පද්ධතිය',
    xpSubtitle:
      'අයකිරීම් කාර්යක්ෂමතාව, Below-1 (90 අනුපාතය), NPL අඩුකිරීම සහ දුරකථන පසුවිපරම් මත සජීවීව ගණනය වන දක්ෂතා XP ලකුණු සහ ශ්‍රේණිගත කිරීම්.',
    fbTitle: 'FB දිරිදීමනා (FB Incentive) මධ්‍යස්ථානය',
    fbSubtitle:
      'කොමර්ෂල් ක්‍රෙඩිට් FB දිරිදීමනා ගණනය කිරීම සඳහා වෙන්කරන ලද පුවරුව — ඔබගේ දිරිදීමනා කොන්දේසි සහ ස්ලැබ් විස්තර එක් කිරීමට සූදානම්ය.',
  },
  ta: {
    brandSubtitle: 'கமர்ஷியல் கிரெடிட் · லீசிங் மற்றும் நிதி வசூல் கட்டுப்பாடு',
    adminMode: 'நிர்வாக முறை',
    viewOnlyMode: 'நேரடி பார்வை முறை',
    navOverview: 'முகப்பு',
    navAssignUser: 'நியமித்த பயனர்',
    navBelowOne: 'Below 1 (90R)',
    navBelowThree: 'Below 3 வசூல்',
    navBorderline: 'எல்லைக்கோடு',
    navWorst: 'மிக ஆபத்து (W)',
    navAlerts: 'எச்சரிக்கை',
    navRewards: 'XP வெகுமதி',
    navFbIncentive: 'FB ஊக்கத்தொகை',
    navTools: 'பகுப்பாய்வு',
    navSettings: 'அமைப்புகள்',
    breadcrumbOverview: 'முதன்மை நிதி மற்றும் வசூல் கட்டுப்பாட்டு மையம்',
    breadcrumbAssignUser: 'நியமிக்கப்பட்ட அலுவலர் தொடர் நடவடிக்கை மற்றும் 30-நாள் வரலாறு',
    breadcrumbBelowOne: 'Below 1 (≤ 1.00) · 90 விகித செயல் திட்டம்',
    breadcrumbBelowThree: 'Below 3 (< 3.00 வயது) வசூல் & Due வேறுபாடு (Variance) கட்டுப்பாடு',
    breadcrumbBorderline: 'அடுத்த மாத 91-DPD எல்லைக்கோடு பாதுகாப்பு',
    breadcrumbWorst: 'மிக ஆபத்தான (W) கணக்கு கண்காணிப்பு',
    breadcrumbAlerts: 'எச்சரிக்கைகள் மற்றும் கணினி அறிவிப்பு மையம்',
    breadcrumbRewards: 'XP புள்ளிகள் மற்றும் செயல்திறன் வெகுமதி மையம்',
    breadcrumbFbIncentive: 'FB ஊக்கத்தொகை (Incentive) கணக்கீட்டு மையம்',
    breadcrumbTools: 'அலுவலக வகை பிரிவு மற்றும் BM போர்ட்ஃபோலியோ பகுப்பாய்வு',
    breadcrumbSettings: 'அமைப்புகள் · AERS முதன்மை தேடல் & காப்பு',
    snapExport: 'ஸ்னாப் / ஏற்றுமதி',
    pickingSection: 'பகுதியைத் தேர்ந்தெடுக்கவும்…',
    areaSnap: 'பகுதி ஸ்னாப்',
    installApp: 'PC செயலி நிறுவு',
    refreshLive: 'நேரடி புதுப்பிப்பு',
    syncing: 'புதுப்பிக்கிறது...',
    uploadAers: 'AERS பதிவேற்றம்',
    adminActive: 'நிர்வாகம் செயலில்',
    adminLogin: 'நிர்வாக உள்நுழைவு',
    hoverSnap: 'ஹோவர் ஸ்னாப்',
    testPopup: 'அறிவிப்பு சோதனை',
    heroEyebrow: 'கமர்ஷியல் கிரெடிட் · முதன்மை வசூல் கட்டுப்பாடு',
    heroTitle: 'தற்போதைய NPL, 90 விகிதம் மற்றும் போர்ட்ஃபோலியோ கட்டுப்பாடு',
    heroDesc:
      '91+ DPD வாராக்கடன், தொடக்க NPL, Below 1 (90 விகிதம்) விரைவு இலக்குகள் மற்றும் எல்லைக்கோடு ஆபத்துக் கணக்குகளைத் துல்லியமாகக் கண்காணிக்கும் தளம்.',
    officeTypes: 'அலுவலக வகைகள்',
    nextMoBorderline: 'எல்லைக்கோடு கணக்குகள்',
    worstCase: 'மிக ஆபத்து (W)',
    uploadDailyAers: 'தினசரி AERS பதிவேற்றம்',
    adminLoginToUpload: 'பதிவேற்ற நிர்வாக உள்நுழைவு',
    belowOnePlan: 'Below 1 · 90 விகித திட்டம்',
    liveAlertsPrefix: 'நேரடி AERS எச்சரிக்கைகள்:',
    shareWhatsApp: 'WhatsApp',
    tabOverviewCards: 'மேலோட்டம் மற்றும் அட்டைகள்',
    tabPerfHistory: '30-நாள் செயல்திறன் வரலாறு',
    logTodaySnapshot: 'இன்றைய நிலையை சேமி',
    xpTitle: 'அலுவலர் மற்றும் பயனர் XP வெகுமதி மையம்',
    xpSubtitle:
      'வசூல் திறன், Below-1 (90 விகிதம்), NPL குறைப்பு மற்றும் அழைப்பு முயற்சிகள் அடிப்படையில் நேரடியாக கணக்கிடப்படும் செயல்திறன் XP புள்ளிகள்.',
    fbTitle: 'FB ஊக்கத்தொகை (FB Incentive) மையம்',
    fbSubtitle:
      'கமர்ஷியல் கிரெடிட் FB ஊக்கத்தொகை கணக்கீட்டிற்கான பிரத்யேக பக்கம் — உங்கள் நிபந்தனைகள் மற்றும் ஸ்லாப் விதிகளைச் சேர்க்கத் தயாராக உள்ளது.',
  },
};

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (next: AppLanguage) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => TRANSLATIONS.en[key] ?? key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang] = useState<AppLanguage>('en');

  useEffect(() => {
    document.documentElement.lang = 'en';
    try {
      localStorage.setItem(LANG_STORAGE_KEY, 'en');
    } catch {
      // Ignore
    }
  }, []);

  const setLang = (_next: AppLanguage) => {
    // Language toggle removed per corporate standard (English only)
  };

  const t = (key: string): string => {
    return TRANSLATIONS.en[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
