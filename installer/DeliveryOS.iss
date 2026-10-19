#define AppName "Delivery OS"
#define AppVersion "1.0.0"
#define AppPublisher "Delivery OS"

[Setup]
AppId={{FBB7F288-BA94-4AF1-BB05-8C1CF9716E03}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\DeliveryOS
DefaultGroupName={#AppName}
UninstallDisplayName={#AppName}
OutputDir=..\dist
OutputBaseFilename=DeliveryOS-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
Uninstallable=yes

[Files]
Source: "..\dist\installer\app\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Iniciar Delivery OS"; Filename: "{app}\start.vbs"
Name: "{group}\Parar Delivery OS"; Filename: "{app}\stop.vbs"
Name: "{autodesktop}\Delivery OS"; Filename: "{app}\start.vbs"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos:"

[Run]
Filename: "{app}\start.vbs"; Description: "Iniciar o Delivery OS"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{app}\runtime\node.exe"; Parameters: """{app}\launcher.cjs"" --stop"; Flags: runhidden
