# Installed PWA device acceptance

Run this after the production host and final frontend design are ready. Record
device model, OS/browser version, production commit, date, and result.

## iOS

- Open the production HTTPS URL in Safari, add it to the Home Screen, and launch
  from the icon.
- Confirm standalone launch, icon and app name, signup email callback, login,
  session survival after closing/reopening, match submission, confirmation,
  standings, profile update, logout, and useful offline/network-error behavior.
- Check keyboard navigation, zoom, safe areas, rotation, and text at the largest
  supported text size.

## Android

- Open the production HTTPS URL in Chrome, install the app, and launch it from
  the launcher.
- Repeat the authentication and match lifecycle above, including app resume after
  backgrounding and a network interruption.
- Check back navigation, keyboard behavior, rotation, and large text.

Status: pending production deployment, physical devices, and the deferred final
frontend-design pass.
