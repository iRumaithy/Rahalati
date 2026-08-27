window.RAHALATI_CONFIG = Object.freeze({
  appName: 'رحلاتي',
  appVersion: '3.0.0',
  supabaseUrl: 'https://itcbahydyqhlybofcyuh.supabase.co',
  supabasePublishableKey: 'sb_publishable_qL-6DKVkAc3XWJ7JH-p2_A_-8myYRgp',
  functions: {
    login: 'rahalati-login',
    adminUsers: 'rahalati-admin-users',
    releaseManager: 'rahalati-release-manager',
    destinationSuggestions: 'rahalati-destination-suggestions'
  }
});

// Load the release/update bridge separately so stable builds can move between immutable version paths.
(()=>{const s=document.createElement('script');s.type='module';s.src='./release-bridge.js';document.head.appendChild(s)})();
