; Kill any running agent before install or uninstall so files are not locked.
!macro killRunningAgent
  nsExec::ExecToLog 'taskkill /F /T /IM "Flex HRM Connect.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM "Flex HRM Agent.exe"'
  Pop $0
!macroend

; Register auto-start at Windows login and a watchdog task to restart if killed.
!macro registerAutoStart
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Flex HRM Connect" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --background'
  nsExec::ExecToLog 'schtasks /Create /TN "FlexHRM Connect Watchdog" /SC MINUTE /MO 5 /TR "\"$INSTDIR\${APP_EXECUTABLE_FILENAME}\" --background" /F /RL LIMITED'
  Pop $0
!macroend

!macro unregisterAutoStart
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Flex HRM Connect"
  nsExec::ExecToLog 'schtasks /Delete /TN "FlexHRM Connect Watchdog" /F'
  Pop $0
!macroend

!macro customInit
  !insertmacro killRunningAgent
!macroend

!macro customInstall
  !insertmacro killRunningAgent
  !insertmacro registerAutoStart
  ; App launch is handled by runAfterFinish — do not ExecToLog the exe here (it never exits).
!macroend

!macro customUnInstall
  !insertmacro killRunningAgent
  !insertmacro unregisterAutoStart
!macroend
