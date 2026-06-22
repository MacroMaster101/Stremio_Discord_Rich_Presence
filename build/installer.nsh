; Custom NSIS include for Stremio Discord Presence.
;
; Replaces electron-builder's default Finish page with one that keeps the
; standard "Run <app>" checkbox AND adds a "Create a desktop shortcut"
; checkbox. The desktop shortcut is created only if the user ticks the box.
;
; We turn off electron-builder's automatic desktop shortcut
; (createDesktopShortcut: false in package.json) so this is the single source
; of truth for whether the shortcut exists.
;
; The "Create a desktop shortcut" checkbox reuses MUI's SHOWREADME control,
; a standard NSIS technique for adding an extra checkbox to the Finish page.

!macro customFinishPage
  ; --- "Run <app>" checkbox (same behaviour as electron-builder default) ---
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif

  ; --- "Create a desktop shortcut" checkbox (ticked by default) ------------
  ; Mirrors electron-builder's own addDesktopLink so the resulting shortcut is
  ; identical to a natively created one (icon, AppUserModelID, desktop refresh).
  Function CreateDesktopShortcutFinish
    CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$DESKTOP\${SHORTCUT_NAME}.lnk" "${APP_ID}"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  FunctionEnd

  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Create a desktop shortcut"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "CreateDesktopShortcutFinish"

  !insertmacro MUI_PAGE_FINISH
!macroend
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