'use strict';
// Google sign-in for sync. The real IDs are not kept in the public code: local builds read them
// from google-config.local.js (git-ignored), and release builds get that file from repository secrets.
window.MADAR_GOOGLE = Object.assign({ desktopId: '', desktopSecret: '', iosId: '' }, window.MADAR_GOOGLE_LOCAL || {});
