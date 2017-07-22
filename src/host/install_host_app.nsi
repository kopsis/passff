!define MUI_PRODUCT "passff"
!define MUI_FILE "savefile"
!define MUI_VERSION ""
!define MUI_BRANDIGTEXT "PassFF Native Messaging Host"
CRCCheck On

!include "MUI2.nsh"
!include "TextFunc.nsh"
!include "WordFunc.nsh"

; General

Name "PassFF Native Messaging Host"
OutFile "install_host_app.exe"
ShowInstDetails "nevershow"
ShowUninstDetails "nevershow"

InstallDir "$LOCALAPPDATA\Mozilla\NativeMessagingHosts"

RequestExecutionLevel user

!define MUI_ABORTWARNING

;--------------------------------
;Modern UI Configuration

!define MUI_PAGE_HEADER_TEXT "PassFF Native Messaging Host"
!define MUI_WELCOMEPAGE_TEXT "This installs the native messaging host used by the PassFF browser extension."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

;--------------------------------
;Language

  !insertmacro MUI_LANGUAGE "English"

;-------------------------------- 
;Installer Sections
Section "Native Messaging Host"


;Add files
  SetOutPath "$INSTDIR"

  Var /GLOBAL ESCINSTDIR
  ${WordReplace} '$INSTDIR' '\' '\\' '+*' $ESCINSTDIR

  File passff.py

  File /oname=passff_.json passff.json
  ${LineFind} "passff_.json" "$INSTDIR\passff.json" "1:-1" "UpdateBatPath"
  IfErrors 0 +2
  MessageBox MB_OK "LineFind error"
  Delete "$INSTDIR\passff_.json"

  File /oname=passff_.bat passff.bat
  ${LineFind} "passff_.bat" "$INSTDIR\passff.bat" "1:-1" "UpdatePyPath"
  IfErrors 0 +2
  MessageBox MB_OK "LineFind error"
  Delete "$INSTDIR\passff_.bat"

;write uninstall information to the registry
  WriteRegStr HKCU "Software\Mozilla\NativeMessagingHosts\passff" "" "$INSTDIR\${MUI_PRODUCT}.json"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${MUI_PRODUCT}" "DisplayName" "${MUI_PRODUCT} (remove only)"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${MUI_PRODUCT}" "UninstallString" "$INSTDIR\Uninstall.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

SectionEnd

Function UpdateBatPath
  ${WordReplace} '$R9' 'PLACEHOLDER' '$ESCINSTDIR\\${MUI_PRODUCT}.bat' '+*' $R9
  Push $0
FunctionEnd

Function UpdatePyPath
  ${WordReplace} '$R9' 'PLACEHOLDER' '$INSTDIR\${MUI_PRODUCT}.py' '+*' $R9
  Push $0
FunctionEnd

;--------------------------------
;Uninstaller Section
Section "Uninstall"

;Delete Files
  Delete "$INSTDIR\${MUI_PRODUCT}.py"
  Delete "$INSTDIR\${MUI_PRODUCT}.json"
  Delete "$INSTDIR\${MUI_PRODUCT}.bat"

;Delete Uninstaller And Unistall Registry Entries
  DeleteRegKey HKCU "Software\Mozilla\NativeMessagingHosts\${MUI_PRODUCT}"
  DeleteRegKey HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\${MUI_PRODUCT}"

Delete $INSTDIR\Uninstall.exe
rmDir $INSTDIR

SectionEnd
