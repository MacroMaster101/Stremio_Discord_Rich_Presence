; Custom NSIS include for Stremio Discord Presence.
;
; The app uses a one-click installer (oneClick:true), which has no wizard or
; Finish page — so there is no customFinishPage here. Desktop and Start Menu
; shortcuts are created natively by electron-builder (createDesktopShortcut /
; createStartMenuShortcut in package.json).
;
; This file only provides uninstall-time cleanup of legacy "run at startup"
; registry values, so the app's autostart entries are fully removed on
; uninstall regardless of which historical key name created them.

!macro deleteStartupValue VALUE_NAME
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${VALUE_NAME}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${VALUE_NAME}"
!macroend

!macro cleanupLegacyStartupValues
  !insertmacro deleteStartupValue "electron.app.Stremio Discord Presence"
  !insertmacro deleteStartupValue "StremioDiscordPresence"
  !insertmacro deleteStartupValue "com.kavishalakshan.stremiodiscordpresence"
!macroend

!macro cleanupAllStartupValues
  !insertmacro deleteStartupValue "Stremio Discord Presence"
  !insertmacro cleanupLegacyStartupValues
!macroend


!macro customUnInstall
  !insertmacro cleanupAllStartupValues
!macroend