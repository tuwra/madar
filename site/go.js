'use strict';
/* the app lives in app/. Two kinds of visit belong there straight away, before this page draws:
 * Google sign-in coming back (it returns here, the address it was registered with), and the
 * Home Screen icon on an iPad or iPhone, which was added when the app was at this address */
(function () {
  const h = location.hash;
  if (/(^|[#&])(state|access_token|error)=/.test(h)) return location.replace('app/' + h);
  if (navigator.standalone || matchMedia('(display-mode: standalone)').matches) location.replace('app/');
})();
