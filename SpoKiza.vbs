' SpoKiza: abre el programa como una app (sin ventana negra).
' La primera vez crea el icono "SpoKiza" en el escritorio.
Option Explicit
Dim sh, fso, dir, url, i, edge, chrome, lnkPath, lnk
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
url = "http://localhost:3000"

' Icono en el escritorio
lnkPath = sh.SpecialFolders("Desktop") & "\SpoKiza.lnk"
If Not fso.FileExists(lnkPath) Then
  Set lnk = sh.CreateShortcut(lnkPath)
  lnk.TargetPath = "wscript.exe"
  lnk.Arguments = """" & WScript.ScriptFullName & """"
  lnk.WorkingDirectory = dir
  lnk.IconLocation = dir & "\spokiza.ico"
  lnk.Description = "SpoKiza"
  lnk.Save
End If

' Node.js instalado?
If sh.Run("cmd /c where node", 0, True) <> 0 Then
  MsgBox "Falta instalar Node.js. Se va a abrir la pagina: descarga la version LTS, instalala y vuelve a abrir SpoKiza.", 48, "SpoKiza"
  sh.Run "https://nodejs.org"
  WScript.Quit
End If

' Primera vez: instalar lo necesario (se ve el progreso)
If Not fso.FolderExists(dir & "\node_modules") Then
  MsgBox "SpoKiza se va a preparar por primera vez. Tarda unos minutos; espera a que se cierre la ventana negra.", 64, "SpoKiza"
  sh.Run "cmd /c npm install", 1, True
End If

' Encender el programa en segundo plano si no esta encendido
If Not Encendido() Then
  ' Buscar actualizaciones en GitHub antes de encender
  sh.Run "cmd /c node scripts\update.mjs", 0, True
  sh.Run "cmd /c npm run dev -- -p 3000", 0, False
  For i = 1 To 90
    WScript.Sleep 1000
    If Encendido() Then Exit For
  Next
End If

' Abrir en su propia ventana (sin barras del navegador)
edge = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
chrome = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe"
If fso.FileExists(edge) Then
  sh.Run """" & edge & """ --app=" & url & " --window-size=1500,950", 1, False
ElseIf fso.FileExists(chrome) Then
  sh.Run """" & chrome & """ --app=" & url & " --window-size=1500,950", 1, False
Else
  sh.Run url
End If

Function Encendido()
  Dim http
  Encendido = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 1500, 1500, 3000, 3000
  http.open "GET", url & "/api/setup", False
  http.send
  If Err.Number = 0 Then
    If http.status = 200 Then Encendido = True
  End If
  On Error GoTo 0
End Function
